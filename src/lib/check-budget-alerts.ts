/**
 * Client-side helper: after saving or editing an expense, check whether any
 * budget in that category crossed the 80% warning or 100% exceeded threshold
 * for its CURRENT period, and fire a push notification + alert email.
 *
 * Each tier fires at most once per budget period (tracked via `alertedAt` on
 * the budget doc), so repeated expenses don't spam the user.
 */

import { format } from 'date-fns';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/collections';
import { getBudgets } from '@/lib/actions/budgets';
import { getExpenses } from '@/lib/actions/expenses';
import {
    getBudgetSpent,
    getPeriodDateRange,
    getAlertTier,
    shouldSendAlert,
} from '@/lib/budget-spent';
import { notifyBudgetExceeded } from '@/lib/push-notifications';

export async function checkBudgetAlerts(userId: string, expenseCategory: string): Promise<void> {
    const budgets = await getBudgets(userId);
    const matchingBudgets = budgets.filter((b) => b.category === expenseCategory);
    if (matchingBudgets.length === 0) return;

    const expenses = await getExpenses(userId);
    const idToken = await auth.currentUser?.getIdToken();

    for (const budget of matchingBudgets) {
        const spent = getBudgetSpent(budget, expenses);
        const tier = getAlertTier(spent, budget.amount);
        if (!tier) continue;

        const periodKey = format(getPeriodDateRange(budget.period).start, 'yyyy-MM-dd');
        if (!shouldSendAlert(budget.alertedAt, tier, periodKey)) continue;

        notifyBudgetExceeded(budget.name, spent, budget.amount);

        if (idToken) {
            try {
                await fetch('/api/notifications/budget-alert', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({
                        budgetName: budget.name,
                        category: budget.category,
                        spent,
                        limit: budget.amount,
                        tier,
                    }),
                });
            } catch (error) {
                console.error('Budget alert email failed:', error);
            }
        }

        try {
            await updateDoc(doc(db, COLLECTIONS.budgets, budget.id), {
                alertedAt: { ...budget.alertedAt, [tier]: periodKey },
            });
        } catch (error) {
            console.error('Failed to persist budget alert state:', error);
        }
    }
}
