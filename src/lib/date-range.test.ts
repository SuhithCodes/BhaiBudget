import { describe, it, expect } from 'vitest';
import {
    filterByDateRange,
    getDatePresetRange,
    getCurrentBalance,
    isDateInRange,
    formatRangeLabel,
} from '@/lib/date-range';
import { format } from 'date-fns';

describe('getDatePresetRange', () => {
    // Friday 2026-07-10
    const ref = new Date('2026-07-10T15:30:00');

    it('This Week is Monday–Sunday (not Sunday–Saturday)', () => {
        const { from, to } = getDatePresetRange('thisWeek', ref);
        expect(format(from, 'yyyy-MM-dd')).toBe('2026-07-06'); // Monday
        expect(format(to, 'yyyy-MM-dd')).toBe('2026-07-12'); // Sunday
    });

    it('Last Week is the previous Monday–Sunday', () => {
        const { from, to } = getDatePresetRange('lastWeek', ref);
        expect(format(from, 'yyyy-MM-dd')).toBe('2026-06-29');
        expect(format(to, 'yyyy-MM-dd')).toBe('2026-07-05');
    });

    it('Last 7 Days is inclusive of today', () => {
        const { from, to } = getDatePresetRange('last7Days', ref);
        expect(format(from, 'yyyy-MM-dd')).toBe('2026-07-04');
        expect(format(to, 'yyyy-MM-dd')).toBe('2026-07-10');
    });
});

describe('filterByDateRange / isDateInRange', () => {
    const week = getDatePresetRange('thisWeek', new Date('2026-07-10T12:00:00'));

    it('includes Monday and Sunday of the ISO week', () => {
        expect(isDateInRange('2026-07-06', week)).toBe(true);
        expect(isDateInRange('2026-07-12', week)).toBe(true);
    });

    it('excludes the previous Sunday and next Monday', () => {
        expect(isDateInRange('2026-07-05', week)).toBe(false);
        expect(isDateInRange('2026-07-13', week)).toBe(false);
    });

    it('filters a list down to in-range items', () => {
        const items = [
            { date: '2026-07-05', id: 'out' },
            { date: '2026-07-08', id: 'in' },
            { date: '2026-07-13', id: 'out2' },
        ];
        expect(filterByDateRange(items, week).map((i) => i.id)).toEqual(['in']);
    });

    it('returns everything when no range is set', () => {
        const items = [{ date: '2020-01-01' }, { date: '2030-01-01' }];
        expect(filterByDateRange(items, undefined)).toHaveLength(2);
    });
});

describe('getCurrentBalance', () => {
    it('is all-time income − expenses (matches the header)', () => {
        const incomes = [{ amount: 1000 }, { amount: 250 }];
        const expenses = [{ totalAmount: 200 }, { totalAmount: 50.5 }];
        // 1250 - 250.5 = 999.5
        expect(getCurrentBalance(incomes, expenses)).toBe(999.5);
    });

    it('does not change when the dashboard date filter changes — only the input lists do', () => {
        // Simulate: lifetime has income outside the week; weekly filter would
        // drop it. Current Balance must still use the full lists.
        const allIncomes = [{ amount: 5000 }]; // salary earlier this month
        const allExpenses = [{ totalAmount: 100 }, { totalAmount: 50 }]; // some this week
        const weekExpenses = [{ totalAmount: 100 }]; // filtered
        const weekIncomes: { amount: number }[] = []; // no income this week

        expect(getCurrentBalance(allIncomes, allExpenses)).toBe(4850);
        // Period net would be 0 - 100 = -100, but current balance stays 4850
        expect(getCurrentBalance(weekIncomes, weekExpenses)).toBe(-100);
        expect(getCurrentBalance(allIncomes, allExpenses)).not.toBe(
            getCurrentBalance(weekIncomes, weekExpenses),
        );
    });

    it('is float-safe', () => {
        expect(getCurrentBalance([{ amount: 0.1 }], [{ totalAmount: 0.2 }])).toBe(-0.1);
    });
});

describe('formatRangeLabel', () => {
    it('labels a multi-day range', () => {
        const week = getDatePresetRange('thisWeek', new Date('2026-07-10T12:00:00'));
        expect(formatRangeLabel(week)).toBe('Jul 6 – Jul 12');
    });

    it('labels all-time when unset', () => {
        expect(formatRangeLabel(undefined)).toBe('All time');
    });
});
