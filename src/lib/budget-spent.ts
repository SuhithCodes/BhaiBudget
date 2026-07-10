/**
 * Single source of truth for "how much of this budget has been spent".
 *
 * Used by the budget list, the dashboard/voice alert checks, and the monthly
 * report so that all surfaces agree on the same period window and the same
 * category-matching rule (strict equality — every writer draws from
 * EXPENSE_CATEGORIES, so case-insensitive matching would only mask bad data).
 */

import {
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
} from 'date-fns';
import { WEEK_OPTIONS } from '@/lib/date-range';
import type { Budget, Expense } from '@/types';

export function getPeriodDateRange(period: Budget['period'], ref: Date = new Date()) {
    switch (period) {
        case 'Weekly':
            return { start: startOfWeek(ref, WEEK_OPTIONS), end: endOfWeek(ref, WEEK_OPTIONS) };
        case 'Yearly':
            return { start: startOfYear(ref), end: endOfYear(ref) };
        case 'Monthly':
        default:
            return { start: startOfMonth(ref), end: endOfMonth(ref) };
    }
}

/**
 * Sum of expenses in the budget's category within the budget's current period
 * (relative to `ref`). Uses integer-cents math so float noise never pushes a
 * user over a threshold.
 */
export function getBudgetSpent(
    budget: Pick<Budget, 'category' | 'period'>,
    expenses: Pick<Expense, 'category' | 'date' | 'totalAmount'>[],
    ref: Date = new Date(),
): number {
    const { start, end } = getPeriodDateRange(budget.period, ref);
    const cents = expenses.reduce((sum, e) => {
        if (e.category !== budget.category) return sum;
        // Expense dates are stored as 'YYYY-MM-DD'; parse at local midnight so
        // the comparison happens in the same timezone as the period window.
        const d = new Date(`${e.date}T00:00:00`);
        if (Number.isNaN(d.getTime()) || d < start || d > end) return sum;
        return sum + Math.round((e.totalAmount ?? 0) * 100);
    }, 0);
    return cents / 100;
}

export type AlertTier = 'warning' | 'exceeded';

export const BUDGET_WARNING_RATIO = 0.8;

/** Highest alert tier reached, or null if under the warning threshold. */
export function getAlertTier(spent: number, limit: number): AlertTier | null {
    if (limit <= 0) return null;
    const ratio = spent / limit;
    if (ratio >= 1) return 'exceeded';
    if (ratio >= BUDGET_WARNING_RATIO) return 'warning';
    return null;
}

/**
 * Alert dedup: fire each tier at most once per budget period. `alertedAt`
 * stores the period-start key (YYYY-MM-DD) of the last period each tier fired
 * in; a new period produces a new key, re-arming the alert.
 */
export function shouldSendAlert(
    alertedAt: Partial<Record<AlertTier, string>> | undefined,
    tier: AlertTier,
    periodKey: string,
): boolean {
    return alertedAt?.[tier] !== periodKey;
}
