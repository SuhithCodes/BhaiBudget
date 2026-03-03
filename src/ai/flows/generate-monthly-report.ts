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
import { db } from '@/lib/firebase';
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

export interface InsightItem {
    emoji: string;
    title: string;
    detail: string;
}

// ── Server Action ────────────────────────────────────────────────

export async function generateReport(
    userId: string,
    startDate: string,
    endDate: string,
): Promise<ReportData> {
    // 1. Fetch all data in parallel
    const [expenses, incomes, budgets, goals, balances] = await Promise.all([
        fetchExpenses(userId, startDate, endDate),
        fetchIncomes(userId, startDate, endDate),
        fetchBudgets(userId),
        fetchSavingsGoals(userId),
        fetchBalances(userId),
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

    // Budget performance
    let budgetAdherence = 100;
    const overBudgetCategories: { category: string; limit: number; spent: number; overage: number }[] = [];
    const budgetPerformance: BudgetPerformance[] = budgets.map((b) => {
        const spent = expenses
            .filter((e) => e.category === b.category)
            .reduce((sum, e) => sum + e.totalAmount, 0);
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

    // Executive Metrics
    let totalNetWorth = 0;
    if (balances.length > 0) {
        balances.forEach(b => totalNetWorth += (b.amount || 0));
    } else {
        totalNetWorth = totalIncome - totalSpending;
    }

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
    const prompt = `You are an elite personal wealth advisor (GPT OSS 120B). Analyze the following financial data for the period ${data.startDate} to ${data.endDate}.

Financial Summary:
- Total Income: $${data.totalIncome.toFixed(2)}
- Total Spending: $${data.totalSpending.toFixed(2)}
- Net Balance: $${data.netBalance.toFixed(2)}
- Savings Rate: ${data.savingsRate.toFixed(1)}%

Budget Leaks:
${data.budgetPerformance.filter(b => b.status === 'over-budget').length > 0 ?
            data.budgetPerformance.filter(b => b.status === 'over-budget').map((b) => `- ${b.category}: $${b.spent.toFixed(2)} / $${b.limit.toFixed(2)} [OVER by $${Math.abs(b.remaining).toFixed(2)}]`).join('\n')
            : 'No budget overages detected.'}

Savings Goals & Velocity:
${data.savingsGoals.length > 0 ? data.savingsGoals.map((g) => `- ${g.name}: ${g.progressPercent.toFixed(0)}%`).join('\n') : 'No active savings goals.'}

Return EXACTLY 3 structured, highly insightful points as a JSON array. Each insight must have:
- "emoji": a single relevant emoji
- "title": a powerful, executive-style short title (3-5 words)
- "detail": a sophisticated recommendation or observation using specific numbers

Focus on:
1. Executive summary of liquidity/health
2. Strategic cost reduction targeting the exact leak categories
3. Goal acceleration optimization

Return ONLY a valid JSON array, no markdown.`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are a JSON-only financial strategist. Return a valid JSON array.' },
                { role: 'user', content: prompt },
            ],
            model: REPORT_MODEL,
            temperature: 0.3,
            max_tokens: DEFAULT_SETTINGS.max_tokens,
            top_p: DEFAULT_SETTINGS.top_p,
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content?.trim() || '';

        let parsed = null;
        try {
            parsed = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\[[\s\S]*\]/);
            if (match) parsed = JSON.parse(match[0]);
        }

        let insights = Array.isArray(parsed) ? parsed : (parsed?.insights || []);

        return insights.filter((i: any) => i.emoji && i.title && i.detail).slice(0, 3);
    } catch (error) {
        console.error('AI Strategy generation failed:', error);
        return [
            { emoji: '⚠️', title: 'Analysis Offline', detail: 'The AI strategist engine was unable to parse current data.' }
        ];
    }
}

// ── Data Fetching ────────────────────────────────────────────────

async function fetchExpenses(userId: string, startDate: string, endDate: string): Promise<Expense[]> {
    const q = query(
        collection(db, 'expenses'),
        where('userId', '==', userId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Expense))
        .filter((e) => e.date >= startDate && e.date <= endDate);
}

async function fetchIncomes(userId: string, startDate: string, endDate: string): Promise<Income[]> {
    const q = query(
        collection(db, 'incomes'),
        where('userId', '==', userId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Income))
        .filter((i) => i.date >= startDate && i.date <= endDate);
}

async function fetchBudgets(userId: string): Promise<Budget[]> {
    const q = query(collection(db, 'budgets'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Budget));
}

async function fetchSavingsGoals(userId: string): Promise<SavingsGoal[]> {
    const q = query(collection(db, 'savings-goals'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SavingsGoal));
}

async function fetchBalances(userId: string): Promise<any[]> {
    const q = query(collection(db, 'balances'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
