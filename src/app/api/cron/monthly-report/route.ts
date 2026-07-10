import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/collections';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { generateReport } from '@/ai/flows/generate-monthly-report';
import { sendMonthlyReport, type MonthlyReportEmailData } from '@/lib/email';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

/**
 * Monthly report cron job.
 * Runs on the 1st of each month — generates AI report for the PREVIOUS month
 * and emails it to all users who have `monthlyReports` enabled.
 *
 * Vercel Cron: configured in vercel.json. Vercel invokes cron endpoints with
 * GET, so the handler is exported as both GET (cron) and POST (manual trigger).
 * Both require `Authorization: Bearer <CRON_SECRET>` — and fail closed when
 * CRON_SECRET is unset.
 */
async function handler(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Previous month date range
        const now = new Date();
        const prevMonth = subMonths(now, 1);
        const startDate = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
        const endDate = format(endOfMonth(prevMonth), 'yyyy-MM-dd');
        const monthLabel = format(prevMonth, 'MMMM yyyy');

        // Get all users with monthlyReports enabled
        const prefsSnapshot = await getDocs(
            query(collection(db, COLLECTIONS.userPreferences), where('monthlyReports', '==', true)),
        );

        if (prefsSnapshot.empty) {
            return NextResponse.json({ message: 'No users with monthly reports enabled', sent: 0 });
        }

        let sent = 0;
        let failed = 0;

        for (const prefDoc of prefsSnapshot.docs) {
            const userId = prefDoc.id;

            try {
                // Skip users with no data
                const expensesSnapshot = await getDocs(
                    query(collection(db, COLLECTIONS.expenses), where('userId', '==', userId)),
                );
                if (expensesSnapshot.empty) continue;

                const userEmail = await getUserEmail(userId);
                if (!userEmail) {
                    console.warn(`No email found for user ${userId}, skipping`);
                    continue;
                }

                // Generate the AI report
                const reportData = await generateReport(userId, startDate, endDate);

                // Build email data
                const emailData: MonthlyReportEmailData = {
                    monthLabel,
                    totalIncome: reportData.overview.totalIncome,
                    totalSpending: reportData.overview.totalSpending,
                    netBalance: reportData.overview.netBalance,
                    savingsRate: reportData.overview.savingsRate,
                    topCategories: reportData.spendingByCategory.slice(0, 5).map((c) => ({
                        name: c.category,
                        amount: c.amount,
                    })),
                    aiInsights: reportData.aiInsights,
                };

                await sendMonthlyReport(userEmail, emailData);
                sent++;
            } catch (error) {
                console.error(`Monthly report failed for user ${userId}:`, error);
                failed++;
            }
        }

        return NextResponse.json({
            message: `Monthly reports sent for ${monthLabel}`,
            sent,
            failed,
        });
    } catch (error) {
        console.error('Monthly report cron failed:', error);
        return NextResponse.json({ error: 'Monthly report cron failed' }, { status: 500 });
    }
}

export const GET = handler;
export const POST = handler; // keep for manual trigger

/**
 * The recipient address is stored on the userPreferences doc when the user
 * enables monthly reports (see profile page).
 */
async function getUserEmail(userId: string): Promise<string | null> {
    try {
        const prefDoc = await getDoc(doc(db, COLLECTIONS.userPreferences, userId));
        if (prefDoc.exists() && prefDoc.data().email) {
            return prefDoc.data().email;
        }
    } catch { }
    return null;
}
