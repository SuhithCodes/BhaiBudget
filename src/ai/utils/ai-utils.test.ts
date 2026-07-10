import { describe, it, expect, vi } from 'vitest';
import { parseInsights } from '@/ai/utils/parse-insights';
import { isValidIsoDate } from '@/ai/utils/validation';
import { withRetry } from '@/ai/utils/retry';

describe('parseInsights', () => {
    const good = { emoji: '💡', title: 'Title', detail: 'Detail' };

    it('parses the documented { insights: [...] } shape', () => {
        const text = JSON.stringify({ insights: [good, good, good] });
        expect(parseInsights(text)).toHaveLength(3);
    });

    it('accepts a bare array defensively', () => {
        expect(parseInsights(JSON.stringify([good, good]))).toHaveLength(2);
    });

    it('returns [] for malformed text without throwing', () => {
        expect(parseInsights('The model rambled instead of returning JSON')).toEqual([]);
        expect(parseInsights('')).toEqual([]);
    });

    it('filters out items with missing fields and caps at 3', () => {
        const text = JSON.stringify({
            insights: [good, { emoji: '⚠️' }, good, good, good],
        });
        const parsed = parseInsights(text);
        expect(parsed).toHaveLength(3);
        expect(parsed.every((i) => i.title === 'Title')).toBe(true);
    });
});

describe('isValidIsoDate', () => {
    it('accepts a real YYYY-MM-DD date', () => {
        expect(isValidIsoDate('2026-01-15')).toBe(true);
    });

    it.each(['01/15/26', 'N/A', '2026-1-5', '2026-01-15T00:00:00', 42, null, undefined])(
        'rejects %o',
        (value) => {
            expect(isValidIsoDate(value)).toBe(false);
        },
    );
});

describe('withRetry', () => {
    it('succeeds on the 2nd attempt after a 500', async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce({ status: 500 })
            .mockResolvedValueOnce('ok');
        await expect(withRetry(fn, 3)).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on 429', async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce({ status: 429 })
            .mockResolvedValueOnce('ok');
        await expect(withRetry(fn, 3)).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws immediately on a non-retryable 400', async () => {
        const fn = vi.fn().mockRejectedValue({ status: 400 });
        await expect(withRetry(fn, 3)).rejects.toEqual({ status: 400 });
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('gives up after the configured attempts', async () => {
        const fn = vi.fn().mockRejectedValue({ status: 503 });
        await expect(withRetry(fn, 2)).rejects.toEqual({ status: 503 });
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
