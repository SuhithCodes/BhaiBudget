'use server';

import nodemailer from 'nodemailer';
import {
    renderTestEmail,
    renderBudgetAlertEmail,
    renderMonthlyReportEmail,
    type BudgetAlertEmailData,
    type MonthlyReportEmailData,
} from '@/lib/email-templates';

export type { MonthlyReportEmailData };

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true, // SSL on port 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

const FROM = process.env.SMTP_FROM || 'noreply@yaba.app';

// ── Generic sender ──────────────────────────────────────────────

export async function sendEmail(to: string, subject: string, html: string) {
    return transporter.sendMail({
        from: `"YABA" <${FROM}>`,
        to,
        subject,
        html,
    });
}

// ── Senders ─────────────────────────────────────────────────────

export async function sendTestEmail(to: string) {
    const { subject, html } = renderTestEmail();
    return sendEmail(to, subject, html);
}

export async function sendBudgetAlert(to: string, data: BudgetAlertEmailData) {
    const { subject, html } = renderBudgetAlertEmail(data);
    return sendEmail(to, subject, html);
}

export async function sendMonthlyReport(to: string, data: MonthlyReportEmailData) {
    const { subject, html } = renderMonthlyReportEmail(data);
    return sendEmail(to, subject, html);
}
