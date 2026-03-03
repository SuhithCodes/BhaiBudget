'use server';

import nodemailer from 'nodemailer';

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

// ── Email templates ─────────────────────────────────────────────

function wrapTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0c0c14;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="margin-bottom:32px;">
      <h1 style="color:#a78bfa;font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px;">YABA</h1>
    </div>
    <div style="background-color:#16162a;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:28px;">
      ${content}
    </div>
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="color:#555;font-size:11px;margin:0;line-height:1.5;">
        This is an automated notification from YABA. You can manage your preferences in Settings.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Shared styles ───────────────────────────────────────────────

const STYLES = {
    heading: 'color:#fff;font-size:16px;font-weight:600;margin:0 0 6px;letter-spacing:-0.2px;',
    subheading: 'color:#888;font-size:12px;font-weight:400;margin:0 0 20px;',
    sectionTitle: 'color:#999;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px;',
    body: 'color:#bbb;font-size:13px;line-height:1.65;margin:0;',
    dataBox: 'background-color:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:16px;',
    rowLabel: 'color:#777;font-size:13px;padding:5px 0;',
    rowValue: 'color:#fff;font-size:13px;text-align:right;padding:5px 0;font-weight:500;',
    divider: 'border:none;border-top:1px solid rgba(255,255,255,0.06);margin:20px 0;',
} as const;

// ── Test email ──────────────────────────────────────────────────

export async function sendTestEmail(to: string) {
    const html = wrapTemplate(`
        <h2 style="${STYLES.heading}">Connection Verified</h2>
        <p style="${STYLES.subheading}">Email delivery is working correctly</p>
        <p style="${STYLES.body}">
            Your SMTP configuration has been validated. YABA will use this channel for budget alerts,
            spending summaries, and monthly reports when enabled.
        </p>
    `);
    return sendEmail(to, 'YABA — Email Verified', html);
}

// ── Budget alert ────────────────────────────────────────────────

export async function sendBudgetAlert(
    to: string,
    budgetName: string,
    category: string,
    spent: number,
    limit: number,
) {
    const overBy = spent - limit;
    const pct = Math.round((spent / limit) * 100);
    const html = wrapTemplate(`
        <h2 style="${STYLES.heading}">Budget Limit Reached</h2>
        <p style="${STYLES.subheading}">${budgetName} · ${category}</p>
        <div style="${STYLES.dataBox}">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="${STYLES.rowLabel}">Allocated</td>
                    <td style="${STYLES.rowValue}">$${limit.toFixed(2)}</td>
                </tr>
                <tr>
                    <td style="${STYLES.rowLabel}">Spent</td>
                    <td style="${STYLES.rowValue}color:#ef4444;">$${spent.toFixed(2)}</td>
                </tr>
                <tr>
                    <td style="border-top:1px solid rgba(255,255,255,0.06);${STYLES.rowLabel}">Over by</td>
                    <td style="border-top:1px solid rgba(255,255,255,0.06);${STYLES.rowValue}color:#ef4444;">$${overBy.toFixed(2)} (${pct}%)</td>
                </tr>
            </table>
        </div>
        <hr style="${STYLES.divider}" />
        <p style="${STYLES.body}">
            Review your recent transactions in this category to identify opportunities to adjust spending.
        </p>
    `);
    return sendEmail(to, `YABA — ${budgetName} Over Budget`, html);
}

// ── Weekly summary ──────────────────────────────────────────────

export interface WeeklySummaryData {
    totalSpent: number;
    transactionCount: number;
    topCategory: string;
    topCategoryAmount: number;
    dateRange: string;
}

export async function sendWeeklySummary(to: string, data: WeeklySummaryData) {
    const html = wrapTemplate(`
        <h2 style="${STYLES.heading}">Weekly Overview</h2>
        <p style="${STYLES.subheading}">${data.dateRange}</p>
        <div style="${STYLES.dataBox}">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="${STYLES.rowLabel}">Total spent</td>
                    <td style="${STYLES.rowValue}">$${data.totalSpent.toFixed(2)}</td>
                </tr>
                <tr>
                    <td style="${STYLES.rowLabel}">Transactions</td>
                    <td style="${STYLES.rowValue}">${data.transactionCount}</td>
                </tr>
                <tr>
                    <td style="${STYLES.rowLabel}">Top category</td>
                    <td style="${STYLES.rowValue}color:#a78bfa;">${data.topCategory} · $${data.topCategoryAmount.toFixed(2)}</td>
                </tr>
            </table>
        </div>
        <hr style="${STYLES.divider}" />
        <p style="${STYLES.body}">
            Sign in to your dashboard for detailed analytics and AI-powered insights.
        </p>
    `);
    return sendEmail(to, 'YABA — Weekly Overview', html);
}

// ── Monthly report email ────────────────────────────────────────

export interface MonthlyReportEmailData {
    monthLabel: string;
    totalIncome: number;
    totalSpending: number;
    netBalance: number;
    savingsRate: number;
    topCategories: { name: string; amount: number }[];
    aiInsights: { emoji: string; title: string; detail: string }[];
}

export async function sendMonthlyReport(to: string, data: MonthlyReportEmailData) {
    const categoriesHtml = data.topCategories
        .slice(0, 5)
        .map(
            (c) =>
                `<tr><td style="${STYLES.rowLabel}">${c.name}</td><td style="${STYLES.rowValue}">$${c.amount.toFixed(2)}</td></tr>`,
        )
        .join('');

    const insightsHtml = data.aiInsights
        .map(
            (i) =>
                `<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);"><strong style="color:#e0e0e0;font-size:13px;">${i.title}</strong><p style="color:#999;font-size:12px;margin:4px 0 0;line-height:1.5;">${i.detail}</p></div>`,
        )
        .join('');

    const html = wrapTemplate(`
        <h2 style="${STYLES.heading}">Monthly Financial Report</h2>
        <p style="${STYLES.subheading}">${data.monthLabel}</p>

        <p style="${STYLES.sectionTitle}">Summary</p>
        <div style="${STYLES.dataBox};margin-bottom:20px;">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="${STYLES.rowLabel}">Income</td>
                    <td style="${STYLES.rowValue}color:#10b981;">$${data.totalIncome.toFixed(2)}</td>
                </tr>
                <tr>
                    <td style="${STYLES.rowLabel}">Spending</td>
                    <td style="${STYLES.rowValue}color:#ef4444;">$${data.totalSpending.toFixed(2)}</td>
                </tr>
                <tr>
                    <td style="border-top:1px solid rgba(255,255,255,0.06);${STYLES.rowLabel}">Net balance</td>
                    <td style="border-top:1px solid rgba(255,255,255,0.06);${STYLES.rowValue}color:${data.netBalance >= 0 ? '#10b981' : '#ef4444'};">$${data.netBalance.toFixed(2)}</td>
                </tr>
                <tr>
                    <td style="${STYLES.rowLabel}">Savings rate</td>
                    <td style="${STYLES.rowValue}color:#a78bfa;">${data.savingsRate.toFixed(1)}%</td>
                </tr>
            </table>
        </div>

        ${categoriesHtml ? `
            <p style="${STYLES.sectionTitle}">Spending by Category</p>
            <div style="${STYLES.dataBox};margin-bottom:20px;">
                <table style="width:100%;border-collapse:collapse;">${categoriesHtml}</table>
            </div>
        ` : ''}

        ${insightsHtml ? `
            <p style="${STYLES.sectionTitle}">Insights</p>
            <div style="${STYLES.dataBox};margin-bottom:20px;">
                ${insightsHtml}
            </div>
        ` : ''}

        <p style="${STYLES.body}">
            The full report with detailed breakdowns is available on your YABA dashboard.
        </p>
    `);
    return sendEmail(to, `YABA — ${data.monthLabel} Report`, html);
}
