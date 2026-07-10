import { NextRequest, NextResponse } from 'next/server';
import { sendBudgetAlert } from '@/lib/email';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/collections';
import { doc, getDoc } from 'firebase/firestore';
import { verifyIdToken } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Sends a budget alert email to the AUTHENTICATED user. Identity and the
 * recipient address are derived from the verified ID token — the body only
 * carries the alert payload (budget name, category, amounts, tier).
 */
export async function POST(req: NextRequest) {
    const user = await verifyIdToken(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(`budget-alert:${user.uid}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const { budgetName, category, spent, limit, tier } = await req.json();

        if (
            typeof budgetName !== 'string' || budgetName.length === 0 || budgetName.length > 200 ||
            typeof category !== 'string' || category.length > 100 ||
            typeof spent !== 'number' || !Number.isFinite(spent) ||
            typeof limit !== 'number' || !Number.isFinite(limit) ||
            (tier !== 'warning' && tier !== 'exceeded')
        ) {
            return NextResponse.json({ error: 'Invalid alert payload' }, { status: 400 });
        }

        // Check if user has email notifications enabled
        const prefDoc = await getDoc(doc(db, COLLECTIONS.userPreferences, user.uid));
        const prefs = prefDoc.exists() ? prefDoc.data() : null;

        if (!prefs?.emailNotifications) {
            return NextResponse.json({ skipped: true, reason: 'Email notifications disabled' });
        }

        const recipient = user.email ?? (typeof prefs.email === 'string' ? prefs.email : null);
        if (!recipient) {
            return NextResponse.json({ error: 'No email address on account' }, { status: 400 });
        }

        await sendBudgetAlert(recipient, { budgetName, category, spent, limit, tier });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Budget alert email failed:', error);
        return NextResponse.json(
            { error: 'Failed to send budget alert' },
            { status: 500 },
        );
    }
}
