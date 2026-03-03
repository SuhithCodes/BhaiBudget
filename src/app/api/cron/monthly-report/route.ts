import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { generateReport } from '@/ai/flows/generate-monthly-report';
import { sendMonthlyReport, type MonthlyReportEmailData } from '@/lib/email';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

/**
 * Monthly report cron job.
 * Runs on the 1st of each month — generates AI report for the PREVIOUS month
 * and emails it to all users who have `monthlyReports` enabled.
 *
 * Vercel Cron: configured in vercel.json
 * Manual trigger: POST /api/cron/monthly-report with CRON_SECRET header
 */
export async function POST(req: NextRequest) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
            query(collection(db, 'userPreferences'), where('monthlyReports', '==', true)),
        );

        if (prefsSnapshot.empty) {
            return NextResponse.json({ message: 'No users with monthly reports enabled', sent: 0 });
        }

        let sent = 0;
        let failed = 0;

        for (const prefDoc of prefsSnapshot.docs) {
            const userId = prefDoc.id;

            try {
                // Get user email from Firebase Auth users collection or use the preference doc
                // Since we saved preferences by userId, we need to find the user's email
                const usersSnapshot = await getDocs(
                    query(collection(db, 'expenses'), where('userId', '==', userId)),
                );

                // Skip users with no data
                if (usersSnapshot.empty) continue;

                // Generate the AI report
                const reportData = await generateReport(userId, startDate, endDate);

                // Get user email — we'll look it up from any doc that might have it,
                // or use a users collection if available
                const userEmail = await getUserEmail(userId);
                if (!userEmail) {
                    console.warn(`No email found for user ${userId}, skipping`);
                    continue;
                }

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

/**
 * Helper to find user email. Checks the 'users' collection first,
 * then falls back to any stored email in userPreferences.
 */
async function getUserEmail(userId: string): Promise<string | null> {
    // Try users collection
    try {
        const { doc, getDoc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists() && userDoc.data().email) {
            return userDoc.data().email;
        }
    } catch { }

    // Try userPreferences for stored email
    try {
        const { doc, getDoc } = await import('firebase/firestore');
        const prefDoc = await getDoc(doc(db, 'userPreferences', userId));
        if (prefDoc.exists() && prefDoc.data().email) {
            return prefDoc.data().email;
        }
    } catch { }

    return null;
}
