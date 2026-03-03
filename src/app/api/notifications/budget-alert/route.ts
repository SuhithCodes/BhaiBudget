import { NextRequest, NextResponse } from 'next/server';
import { sendBudgetAlert } from '@/lib/email';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
    try {
        const { userId, userEmail, budgetName, category, spent, limit } = await req.json();

        if (!userId || !userEmail || !budgetName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if user has email notifications enabled
        const prefDoc = await getDoc(doc(db, 'userPreferences', userId));
        const prefs = prefDoc.exists() ? prefDoc.data() : null;

        if (!prefs?.emailNotifications) {
            return NextResponse.json({ skipped: true, reason: 'Email notifications disabled' });
        }

        await sendBudgetAlert(userEmail, budgetName, category, spent, limit);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Budget alert email failed:', error);
        return NextResponse.json(
            { error: 'Failed to send budget alert' },
            { status: 500 },
        );
    }
}
