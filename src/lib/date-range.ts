/**
 * Shared date-range helpers for dashboard / transactions / budgets.
 *
 * Weeks always start on Monday (ISO) so "This Week" and Weekly budgets agree.
 * Transaction dates are stored as 'YYYY-MM-DD' and compared at local midnight.
 */

import {
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
    startOfQuarter,
    endOfQuarter,
    startOfDay,
    endOfDay,
    subDays,
    format,
} from 'date-fns';

export const WEEK_OPTIONS = { weekStartsOn: 1 as const };

export type DateRangeLike = {
    from?: Date;
    to?: Date;
};

/** Parse a stored 'YYYY-MM-DD' transaction date at local midnight. */
export function parseTransactionDate(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00`);
}

/** Inclusive local-day bounds for a picker/preset range. */
export function getInclusiveDateBounds(range: DateRangeLike | undefined): { start: Date; end: Date } | null {
    if (!range?.from) return null;
    return {
        start: startOfDay(range.from),
        end: endOfDay(range.to ?? range.from),
    };
}

/** True when a 'YYYY-MM-DD' date falls inside the inclusive range. */
export function isDateInRange(dateStr: string, range: DateRangeLike | undefined): boolean {
    const bounds = getInclusiveDateBounds(range);
    if (!bounds) return true;
    const d = parseTransactionDate(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    return d >= bounds.start && d <= bounds.end;
}

export function filterByDateRange<T extends { date: string }>(
    items: T[],
    range: DateRangeLike | undefined,
): T[] {
    if (!range?.from) return items;
    return items.filter((item) => isDateInRange(item.date, range));
}

export type DatePreset =
    | 'today'
    | 'yesterday'
    | 'thisWeek'
    | 'lastWeek'
    | 'last7Days'
    | 'thisMonth'
    | 'thisQuarter'
    | 'thisYear';

/** Build a DateRange for a named preset. Weeks are Monday–Sunday. */
export function getDatePresetRange(preset: DatePreset, ref: Date = new Date()): { from: Date; to: Date } {
    switch (preset) {
        case 'today':
            return { from: startOfDay(ref), to: endOfDay(ref) };
        case 'yesterday': {
            const day = subDays(ref, 1);
            return { from: startOfDay(day), to: endOfDay(day) };
        }
        case 'thisWeek':
            return {
                from: startOfWeek(ref, WEEK_OPTIONS),
                to: endOfWeek(ref, WEEK_OPTIONS),
            };
        case 'lastWeek': {
            const last = subDays(ref, 7);
            return {
                from: startOfWeek(last, WEEK_OPTIONS),
                to: endOfWeek(last, WEEK_OPTIONS),
            };
        }
        case 'last7Days':
            return { from: startOfDay(subDays(ref, 6)), to: endOfDay(ref) };
        case 'thisMonth':
            return { from: startOfMonth(ref), to: endOfMonth(ref) };
        case 'thisQuarter':
            return { from: startOfQuarter(ref), to: endOfQuarter(ref) };
        case 'thisYear':
            return { from: startOfYear(ref), to: endOfYear(ref) };
    }
}

/** Short label for the active range, used in card subtitles. */
export function formatRangeLabel(range: DateRangeLike | undefined): string {
    if (!range?.from) return 'All time';
    const from = format(range.from, 'MMM d');
    if (!range.to || startOfDay(range.from).getTime() === startOfDay(range.to).getTime()) {
        return from;
    }
    return `${from} – ${format(range.to, 'MMM d')}`;
}

/** Lifetime current balance: all income − all expenses (matches the header). */
export function getCurrentBalance(
    incomes: { amount?: number }[],
    expenses: { totalAmount?: number }[],
): number {
    const incomeTotal = incomes.reduce((sum, i) => sum + (i.amount ?? 0), 0);
    const expenseTotal = expenses.reduce((sum, e) => sum + (e.totalAmount ?? 0), 0);
    // Integer-cents to avoid float noise on the header/card pair.
    return (Math.round(incomeTotal * 100) - Math.round(expenseTotal * 100)) / 100;
}
