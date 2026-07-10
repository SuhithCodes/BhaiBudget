import { describe, it, expect } from 'vitest';
import {
    escapeHtml,
    renderBudgetAlertEmail,
    renderMonthlyReportEmail,
} from '@/lib/email-templates';

describe('escapeHtml', () => {
    it('escapes all HTML-significant characters', () => {
        expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    });

    it('stringifies non-string input', () => {
        expect(escapeHtml(42)).toBe('42');
    });
});

describe('renderBudgetAlertEmail', () => {
    it('escapes attacker-controlled budget name and category', () => {
        const { html } = renderBudgetAlertEmail({
            budgetName: '<script>x</script>',
            category: '<img src=x onerror=alert(1)>',
            spent: 120,
            limit: 100,
            tier: 'exceeded',
        });
        expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<img src=x');
    });

    it('renders the warning tier with remaining budget', () => {
        const { subject, html } = renderBudgetAlertEmail({
            budgetName: 'Groceries',
            category: 'Food',
            spent: 80,
            limit: 100,
            tier: 'warning',
        });
        expect(subject).toContain('80%');
        expect(html).toContain('Budget Warning');
        expect(html).toContain('$20.00');
    });

    it('renders the exceeded tier with overage', () => {
        const { subject, html } = renderBudgetAlertEmail({
            budgetName: 'Groceries',
            category: 'Food',
            spent: 120,
            limit: 100,
            tier: 'exceeded',
        });
        expect(subject).toContain('Over Budget');
        expect(html).toContain('Budget Limit Reached');
        expect(html).toContain('$20.00');
    });
});

describe('renderMonthlyReportEmail', () => {
    it('escapes AI-generated insight text and category names', () => {
        const { html } = renderMonthlyReportEmail({
            monthLabel: 'July 2026',
            totalIncome: 1000,
            totalSpending: 500,
            netBalance: 500,
            savingsRate: 50,
            topCategories: [{ name: '<b>Food</b>', amount: 200 }],
            aiInsights: [
                { emoji: '💡', title: '<script>bad</script>', detail: '<a href="evil">Click to verify</a>' },
            ],
        });
        expect(html).toContain('&lt;b&gt;Food&lt;/b&gt;');
        expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<a href="evil">');
    });
});
