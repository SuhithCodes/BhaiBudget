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
    };
    spendingByCategory: CategoryBreakdown[];
    budgetPerformance: BudgetPerformance[];
    savingsGoals: GoalProgress[];
    aiInsights: InsightItem[];
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

    // Budget performance
    const budgetPerformance: BudgetPerformance[] = budgets.map((b) => {
        const spent = expenses
            .filter((e) => e.category === b.category)
            .reduce((sum, e) => sum + e.totalAmount, 0);
        const remaining = b.amount - spent;
        const ratio = b.amount > 0 ? spent / b.amount : 0;
        const status: BudgetPerformance['status'] =
            ratio > 1 ? 'over-budget' : ratio > 0.8 ? 'warning' : 'on-track';
        return { name: b.name, category: b.category, period: b.period, limit: b.amount, spent, remaining, status };
    });

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
        },
        spendingByCategory,
        budgetPerformance,
        savingsGoals,
        aiInsights,
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
    const prompt = `You are a personal finance advisor. Analyze the following financial data for the period ${data.startDate} to ${data.endDate}.

Financial Summary:
- Total Income: $${data.totalIncome.toFixed(2)}
- Total Spending: $${data.totalSpending.toFixed(2)}
- Net Balance: $${data.netBalance.toFixed(2)}
- Savings Rate: ${data.savingsRate.toFixed(1)}%

Spending by Category:
${data.spendingByCategory.map((c) => `- ${c.category}: $${c.amount.toFixed(2)} (${c.percentage.toFixed(1)}%)`).join('\n')}

Budget Performance:
${data.budgetPerformance.length > 0 ? data.budgetPerformance.map((b) => `- ${b.name} (${b.category}): $${b.spent.toFixed(2)} / $${b.limit.toFixed(2)} [${b.status}]`).join('\n') : 'No budgets set.'}

Savings Goals:
${data.savingsGoals.length > 0 ? data.savingsGoals.map((g) => `- ${g.name}: $${g.current.toFixed(2)} / $${g.target.toFixed(2)} (${g.progressPercent.toFixed(0)}%)`).join('\n') : 'No savings goals set.'}

Return EXACTLY 4 structured insights as a JSON array. Each insight should have:
- "emoji": a single relevant emoji
- "title": a short 3-5 word title
- "detail": one sentence with specific numbers

Categories to cover:
1. Overall financial health
2. Biggest spending area
3. Budget or savings performance
4. One actionable tip

Return ONLY valid JSON array, no markdown, no explanation.`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are a JSON-only personal finance analyst. Always respond with a valid JSON array, no explanation or markdown.' },
                { role: 'user', content: prompt },
            ],
            model: REPORT_MODEL,
            temperature: 0.4,
            max_tokens: DEFAULT_SETTINGS.max_tokens,
            top_p: DEFAULT_SETTINGS.top_p,
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content?.trim() || '';
        const parsed = JSON.parse(responseText);
        const insights: InsightItem[] = Array.isArray(parsed) ? parsed : parsed.insights || [];

        // Validate structure
        return insights
            .filter((i: InsightItem) => i.emoji && i.title && i.detail)
            .slice(0, 5);
    } catch (error) {
        console.error('AI insights generation failed:', error);
        return [
            { emoji: '📊', title: 'Report Generated', detail: 'AI insights are temporarily unavailable, but your financial data summary is ready above.' },
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
