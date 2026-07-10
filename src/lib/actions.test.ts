import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processReceipt } from '@/lib/actions';
import { extractReceiptData } from '@/ai/flows/extract-receipt-data';
import { categorizeExpense } from '@/ai/flows/categorize-expenses';

vi.mock('next/headers', () => ({
    headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}));
vi.mock('@/ai/flows/extract-receipt-data', () => ({
    extractReceiptData: vi.fn(),
}));
vi.mock('@/ai/flows/categorize-expenses', () => ({
    categorizeExpense: vi.fn(),
}));

const mockExtract = vi.mocked(extractReceiptData);
const mockCategorize = vi.mocked(categorizeExpense);

describe('processReceipt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCategorize.mockResolvedValue({ category: 'Food', confidence: 0.9 });
    });

    it('feeds line-item NAMES (not "[object Object]") to the categorizer', async () => {
        mockExtract.mockResolvedValue({
            isReceipt: true,
            vendorName: 'Grocery Mart',
            totalAmount: 8,
            date: '2026-07-01',
            lineItems: [
                { name: 'Milk', amount: 3 },
                { name: 'Eggs', amount: 5 },
            ],
        });

        await processReceipt('data:image/jpeg;base64,abc');

        expect(mockCategorize).toHaveBeenCalledWith(
            expect.objectContaining({ description: 'Grocery Mart Milk, Eggs' }),
        );
        expect(mockCategorize.mock.calls[0][0].description).not.toContain('[object Object]');
    });

    it('rejects oversized payloads before calling the AI', async () => {
        const huge = `data:image/jpeg;base64,${'a'.repeat(7_000_001)}`;
        const result = await processReceipt(huge);
        expect(result).toHaveProperty('error');
        expect(mockExtract).not.toHaveBeenCalled();
    });

    it('errors when the extracted date is missing (invalid dates are stripped upstream)', async () => {
        mockExtract.mockResolvedValue({
            isReceipt: true,
            vendorName: 'Grocery Mart',
            totalAmount: 8,
            // no date — extraction rejected a malformed value like "01/15/26"
        });

        const result = await processReceipt('data:image/jpeg;base64,abc');
        expect(result).toHaveProperty('error');
        expect(mockCategorize).not.toHaveBeenCalled();
    });
});
