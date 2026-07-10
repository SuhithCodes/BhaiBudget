import { NextRequest, NextResponse } from 'next/server';
import { sendTestEmail } from '@/lib/email';
import { verifyIdToken } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends a test email to the AUTHENTICATED user's own address.
 * The recipient comes from the verified ID token, never from the body,
 * so this cannot be used as an open relay.
 */
export async function POST(req: NextRequest) {
    const user = await verifyIdToken(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(`send-test:${user.uid}`, { limit: 3, windowMs: 60 * 60 * 1000 })) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    if (!user.email || !EMAIL_RE.test(user.email)) {
        return NextResponse.json({ error: 'No valid email address on account' }, { status: 400 });
    }

    try {
        await sendTestEmail(user.email);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Test email failed:', error);
        return NextResponse.json(
            { error: 'Failed to send test email. Check SMTP configuration.' },
            { status: 500 },
        );
    }
}
