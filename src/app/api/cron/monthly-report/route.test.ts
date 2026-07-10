import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as route from './route';
import { getDocs, getDoc } from 'firebase/firestore';
import { generateReport } from '@/ai/flows/generate-monthly-report';
import { sendMonthlyReport } from '@/lib/email';

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
}));
vi.mock('@/ai/flows/generate-monthly-report', () => ({
    generateReport: vi.fn(),
}));
vi.mock('@/lib/email', () => ({
    sendMonthlyReport: vi.fn(),
}));

const mockGetDocs = vi.mocked(getDocs);
const mockGetDoc = vi.mocked(getDoc);
const mockGenerateReport = vi.mocked(generateReport);
const mockSendMonthlyReport = vi.mocked(sendMonthlyReport);

const makeRequest = (authorization?: string) =>
    new NextRequest('http://localhost/api/cron/monthly-report', {
        headers: authorization ? { authorization } : {},
    });

describe('monthly-report cron route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';
    });

    afterEach(() => {
        delete process.env.CRON_SECRET;
    });

    it('exports a GET handler (Vercel Cron invokes endpoints with GET)', () => {
        expect(typeof route.GET).toBe('function');
        expect(typeof route.POST).toBe('function');
    });

    it('returns 401 when the Authorization header is missing or wrong', async () => {
        expect((await route.GET(makeRequest())).status).toBe(401);
        expect((await route.GET(makeRequest('Bearer wrong'))).status).toBe(401);
        expect(mockSendMonthlyReport).not.toHaveBeenCalled();
    });

    it('fails closed: returns 401 when CRON_SECRET is unset', async () => {
        delete process.env.CRON_SECRET;
        const res = await route.GET(makeRequest('Bearer anything'));
        expect(res.status).toBe(401);
        expect(mockSendMonthlyReport).not.toHaveBeenCalled();
    });

    it('sends one email per opted-in user on an authorized GET', async () => {
        // 1st getDocs call → userPreferences snapshot; later calls → per-user expenses
        mockGetDocs
            .mockResolvedValueOnce({
                empty: false,
                docs: [{ id: 'user-1' }, { id: 'user-2' }],
            } as never)
            .mockResolvedValue({ empty: false, docs: [{}] } as never);
        mockGetDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({ email: 'user@example.com' }),
        } as never);
        mockGenerateReport.mockResolvedValue({
            overview: { totalIncome: 100, totalSpending: 50, netBalance: 50, savingsRate: 50 },
            spendingByCategory: [],
            aiInsights: [],
        } as never);

        const res = await route.GET(makeRequest('Bearer test-secret'));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.sent).toBe(2);
        expect(mockSendMonthlyReport).toHaveBeenCalledTimes(2);
        expect(mockSendMonthlyReport).toHaveBeenCalledWith('user@example.com', expect.anything());
    });
});
