import { NextRequest, NextResponse } from 'next/server';
import { sendTestEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        await sendTestEmail(email);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Test email failed:', error);
        return NextResponse.json(
            { error: 'Failed to send test email. Check SMTP configuration.' },
            { status: 500 },
        );
    }
}
