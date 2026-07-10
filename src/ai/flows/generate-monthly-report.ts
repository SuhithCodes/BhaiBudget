'use server';

/**
 * @fileOverview AI-powered financial summary report generator.
 *
 * 1. Fetches expenses, incomes, budgets, and savings goals for a date range
 * 2. Aggregates the data into summary statistics
 * 3. Sends to GPT OSS 120B via Groq for AI-generated insights
 * 4. Returns structured report data for client-side rendering
 */

import { groq, DEFAULT_SETTINGS } from '@/ai/groq';
import { withRetry } from '@/ai/utils/retry';
import { parseInsights, type InsightItem } from '@/ai/utils/parse-insights';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/collections';
import { getBudgetSpent } from '@/lib/budget-spent';
import { checkRateLimit } from '@/lib/rate-limit';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { type Expense, type Income, type Budget, type SavingsGoal } from '@/types';

const REPORT_MODEL = 'openai/gpt-oss-120b';

// ── Types ────────────────────────────────────────────────────────

export interface CategoryBreakdown {
    category: string;
    amount: number;
    percentage: number;
}

export interface BudgetPerformance {
    name: string;
    category: string;
    period: string;
    limit: number;
    spent: number;
    remaining: number;
    status: 'on-track' | 'warning' | 'over-budget';
}

export interface GoalProgress {
    name: string;
    target: number;
    current: number;
    progressPercent: number;
    deadline?: string;
}

export interface ReportData {
    dateRange: { start: string; end: string };
    generatedAt: string;
    overview: {
        totalIncome: number;
        totalSpending: number;
        netBalance: number;
        savingsRate: number;
        transactionCount: number;
        totalNetWorth: number;
        runwayMonths: number;
        healthScore: number;
    };
    spendingByCategory: CategoryBreakdown[];
    budgetPerformance: BudgetPerformance[];
    savingsGoals: GoalProgress[];
    topLeaks: { category: string; limit: number; spent: number; overage: number }[];
    aiInsights: InsightItem[];
    rawExpenses: Expense[];
    rawIncomes: Income[];
}

export type { InsightItem };

// ── Server Action ────────────────────────────────────────────────

export async function generateReport(
    userId: string,
    startDate: string,
    endDate: string,
): Promise<ReportData> {
    if (!checkRateLimit(`generate-report:${userId}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
        throw new Error('Too many report requests. Please try again later.');
    }

    // 1. Fetch all data in parallel
    const [expenses, incomes, budgets, goals] = await Promise.all([
        fetchExpenses(userId, startDate, endDate),
        fetchIncomes(userId, startDate, endDate),
        fetchBudgets(userId),
        fetchSavingsGoals(userId),
    ]);

    // 2. Aggregate
    const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalSpending = expenses.reduce((sum, e) => sum + e.totalAmount, 0);
    const netBalance = totalIncome - totalSpending;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpending) / totalIncome) * 100 : 0;

    // Category breakdown
    const categoryMap: Record<string, number> = {};
    expenses.forEach((e) => {
        categoryMap[e.category] = (categoryMap[e.category] || 0) + e.totalAmount;
    });
    const spendingByCategory: CategoryBreakdown[] = Object.entries(categoryMap)
        .map(([category, amount]) => ({
            category,
            amount,
            percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

    // Budget performance — window each budget by its own period, anchored to
    // the end of the report range (shared logic with the budgets page/alerts).
    const periodRef = new Date(`${endDate}T00:00:00`);
    let budgetAdherence = 100;
    const overBudgetCategories: { category: string; limit: number; spent: number; overage: number }[] = [];
    const budgetPerformance: BudgetPerformance[] = budgets.map((b) => {
        const spent = getBudgetSpent(b, expenses, periodRef);
        const remaining = b.amount - spent;
        const ratio = b.amount > 0 ? spent / b.amount : 0;
        const status: BudgetPerformance['status'] =
            ratio > 1 ? 'over-budget' : ratio > 0.8 ? 'warning' : 'on-track';

        if (spent > b.amount) {
            overBudgetCategories.push({ category: b.category, limit: b.amount, spent, overage: spent - b.amount });
            budgetAdherence -= ((spent - b.amount) / b.amount) * 10;
        }

        return { name: b.name, category: b.category, period: b.period, limit: b.amount, spent, remaining, status };
    });

    budgetAdherence = Math.max(0, Math.min(100, budgetAdherence));
    overBudgetCategories.sort((a, b) => b.overage - a.overage);
    const topLeaks = overBudgetCategories.slice(0, 3);

    // Executive metrics. Note: without persisted account balances the "net
    // worth" is just the period's net balance — a rough proxy, not real net worth.
    const totalNetWorth = netBalance;
    const avgMonthlyExpense = totalSpending > 0 ? totalSpending : 1000; // rough approximation for the period
    const runwayMonths = totalNetWorth / (avgMonthlyExpense || 1);
    const healthScore = (budgetAdherence * 0.5) + (Math.min(100, savingsRate * 2) * 0.5);

    // Savings goal progress
    const savingsGoals: GoalProgress[] = goals.map((g) => ({
        name: g.name,
        target: g.targetAmount,
        current: g.currentAmount,
        progressPercent: g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0,
        deadline: g.deadline,
    }));

    // 3. AI Insights
    const aiInsights = await generateAIInsights({
        totalIncome,
        totalSpending,
        netBalance,
        savingsRate,
        spendingByCategory,
        budgetPerformance,
        savingsGoals,
        startDate,
        endDate,
    });

    return {
        dateRange: { start: startDate, end: endDate },
        generatedAt: new Date().toISOString(),
        overview: {
            totalIncome,
            totalSpending,
            netBalance,
            savingsRate,
            transactionCount: expenses.length + incomes.length,
            totalNetWorth,
            runwayMonths,
            healthScore,
        },
        spendingByCategory,
        budgetPerformance,
        savingsGoals,
        topLeaks,
        aiInsights,
        rawExpenses: expenses,
        rawIncomes: incomes,
    };
}

// ── AI Insights ──────────────────────────────────────────────────

interface InsightsInput {
    totalIncome: number;
    totalSpending: number;
    netBalance: number;
    savingsRate: number;
    spendingByCategory: CategoryBreakdown[];
    budgetPerformance: BudgetPerformance[];
    savingsGoals: GoalProgress[];
    startDate: string;
    endDate: string;
}

async function generateAIInsights(data: InsightsInput): Promise<InsightItem[]> {
    const overBudget = data.budgetPerformance.filter((b) => b.status === 'over-budget');
    const topSpending = data.spendingByCategory.slice(0, 5);

    const prompt = `You are an elite personal wealth advisor. Analyze the following financial data for the period ${data.startDate} to ${data.endDate}.

Financial Summary:
- Total Income: $${data.totalIncome.toFixed(2)}
- Total Spending: $${data.totalSpending.toFixed(2)}
- Net Balance: $${data.netBalance.toFixed(2)}
- Savings Rate: ${data.savingsRate.toFixed(1)}%

Top Spending Categories:
${topSpending.length > 0 ? topSpending.map((c) => `- ${c.category}: $${c.amount.toFixed(2)} (${c.percentage.toFixed(0)}% of spending)`).join('\n') : 'No spending recorded.'}

Budget Leaks:
${overBudget.length > 0
            ? overBudget.map((b) => `- ${b.category}: $${b.spent.toFixed(2)} / $${b.limit.toFixed(2)} [OVER by $${Math.abs(b.remaining).toFixed(2)}]`).join('\n')
            : 'No budget overages detected.'}

Savings Goals & Velocity:
${data.savingsGoals.length > 0 ? data.savingsGoals.map((g) => `- ${g.name}: ${g.progressPercent.toFixed(0)}%`).join('\n') : 'No active savings goals.'}

Produce EXACTLY 3 structured, highly insightful points. Each insight must have:
- "emoji": a single relevant emoji
- "title": a powerful, executive-style short title (3-5 words)
- "detail": a sophisticated recommendation or observation using specific numbers

Focus on:
1. Executive summary of liquidity/health
2. Strategic cost reduction targeting the largest spending and leak categories
3. Goal acceleration optimization

Return ONLY this JSON object, no markdown:
{ "insights": [ { "emoji": "...", "title": "...", "detail": "..." }, ... exactly 3 items ] }`;

    try {
        const completion = await withRetry(() =>
            groq.chat.completions.create({
                messages: [
                    { role: 'system', content: 'You are a JSON-only financial strategist. Return a valid JSON object with an "insights" array.' },
                    { role: 'user', content: prompt },
                ],
                model: REPORT_MODEL,
                temperature: 0.3,
                // Reasoning models spend tokens on reasoning before the answer;
                // give them room so the JSON is never truncated.
                max_tokens: 4096,
                reasoning_effort: 'low',
                top_p: DEFAULT_SETTINGS.top_p,
                response_format: { type: 'json_object' },
            }),
        );

        const responseText = completion.choices[0]?.message?.content ?? '';
        return parseInsights(responseText);
    } catch (error) {
        console.error('AI Strategy generation failed:', error);
        return [
            { emoji: '⚠️', title: 'Analysis Offline', detail: 'The AI strategist engine was unable to analyze current data. Try regenerating the report.' },
        ];
    }
}

// ── Data Fetching ────────────────────────────────────────────────

async function fetchExpenses(userId: string, startDate: string, endDate: string): Promise<Expense[]> {
    const q = query(
        collection(db, COLLECTIONS.expenses),
        where('userId', '==', userId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Expense))
        .filter((e) => e.date >= startDate && e.date <= endDate);
}

async function fetchIncomes(userId: string, startDate: string, endDate: string): Promise<Income[]> {
    const q = query(
        collection(db, COLLECTIONS.incomes),
        where('userId', '==', userId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Income))
        .filter((i) => i.date >= startDate && i.date <= endDate);
}

async function fetchBudgets(userId: string): Promise<Budget[]> {
    const q = query(collection(db, COLLECTIONS.budgets), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Budget));
}

async function fetchSavingsGoals(userId: string): Promise<SavingsGoal[]> {
    const q = query(collection(db, COLLECTIONS.savingsGoals), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SavingsGoal));
}
