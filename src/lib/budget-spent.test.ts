import { describe, it, expect } from 'vitest';
import {
    getBudgetSpent,
    getPeriodDateRange,
    getAlertTier,
    shouldSendAlert,
} from '@/lib/budget-spent';
import type { Budget } from '@/types';

const expense = (date: string, totalAmount: number, category = 'Food') => ({
    date,
    totalAmount,
    category,
});

const budget = (period: Budget['period'], category = 'Food'): Pick<Budget, 'category' | 'period'> => ({
    period,
    category,
});

describe('getBudgetSpent', () => {
    it('sums only the current month for a Monthly budget', () => {
        const ref = new Date('2026-07-15T12:00:00');
        const expenses = [
            expense('2026-06-30', 100), // previous month
            expense('2026-07-01', 40),
            expense('2026-07-31', 60),
            expense('2026-08-01', 100), // next month
        ];
        expect(getBudgetSpent(budget('Monthly'), expenses, ref)).toBe(100);
    });

    it('uses a Monday week start for Weekly budgets', () => {
        // Monday 2026-07-06 → the week runs Mon 07-06 through Sun 07-12
        const ref = new Date('2026-07-06T12:00:00');
        const expenses = [
            expense('2026-07-05', 100), // Sunday of the PREVIOUS week — excluded
            expense('2026-07-06', 10), // Monday — included
            expense('2026-07-12', 20), // Sunday of the same week — included
        ];
        expect(getBudgetSpent(budget('Weekly'), expenses, ref)).toBe(30);
    });

    it('sums the whole year for a Yearly budget', () => {
        const ref = new Date('2026-07-15T12:00:00');
        const expenses = [
            expense('2025-12-31', 100), // previous year
            expense('2026-01-01', 5),
            expense('2026-12-31', 7),
        ];
        expect(getBudgetSpent(budget('Yearly'), expenses, ref)).toBe(12);
    });

    it('matches categories with strict equality ("Food" !== "food")', () => {
        const ref = new Date('2026-07-15T12:00:00');
        const expenses = [
            expense('2026-07-10', 25, 'food'),
            expense('2026-07-10', 10, 'Food'),
        ];
        expect(getBudgetSpent(budget('Monthly', 'Food'), expenses, ref)).toBe(10);
    });

    it('is float-safe (0.1 + 0.2 = 0.30, not 0.30000000000000004)', () => {
        const ref = new Date('2026-07-15T12:00:00');
        const expenses = [expense('2026-07-10', 0.1), expense('2026-07-11', 0.2)];
        expect(getBudgetSpent(budget('Monthly'), expenses, ref)).toBe(0.3);
    });

    it('ignores expenses with malformed dates', () => {
        const ref = new Date('2026-07-15T12:00:00');
        const expenses = [expense('not-a-date', 50), expense('2026-07-10', 5)];
        expect(getBudgetSpent(budget('Monthly'), expenses, ref)).toBe(5);
    });
});

describe('getAlertTier', () => {
    it('returns null under 80%', () => {
        expect(getAlertTier(79.99, 100)).toBeNull();
        expect(getAlertTier(0, 100)).toBeNull();
    });

    it('returns warning at 80–99%', () => {
        expect(getAlertTier(80, 100)).toBe('warning');
        expect(getAlertTier(99.99, 100)).toBe('warning');
    });

    it('returns exceeded at 100%+', () => {
        expect(getAlertTier(100, 100)).toBe('exceeded');
        expect(getAlertTier(250, 100)).toBe('exceeded');
    });

    it('never alerts on a non-positive limit', () => {
        expect(getAlertTier(50, 0)).toBeNull();
    });
});

describe('alert dedup (shouldSendAlert)', () => {
    it('fires when the tier has never alerted', () => {
        expect(shouldSendAlert(undefined, 'exceeded', '2026-07-01')).toBe(true);
    });

    it('does not fire twice in the same period', () => {
        expect(shouldSendAlert({ exceeded: '2026-07-01' }, 'exceeded', '2026-07-01')).toBe(false);
    });

    it('re-arms in a new period', () => {
        expect(shouldSendAlert({ exceeded: '2026-07-01' }, 'exceeded', '2026-08-01')).toBe(true);
    });

    it('tracks tiers independently', () => {
        expect(shouldSendAlert({ warning: '2026-07-01' }, 'exceeded', '2026-07-01')).toBe(true);
    });
});

describe('getPeriodDateRange', () => {
    it('produces a stable period key for dedup within one period', () => {
        const early = getPeriodDateRange('Monthly', new Date('2026-07-01T00:00:00'));
        const late = getPeriodDateRange('Monthly', new Date('2026-07-31T23:00:00'));
        expect(early.start.getTime()).toBe(late.start.getTime());
    });
});
