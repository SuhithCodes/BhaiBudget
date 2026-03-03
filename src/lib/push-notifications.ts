/**
 * Browser Push Notifications utility.
 * Uses the Web Notifications API — no service worker needed for basic notifications.
 */

export type NotificationType = 'budget-alert' | 'expense-added' | 'income-added' | 'report-ready';

interface PushNotificationOptions {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
    onClick?: () => void;
}

/**
 * Request permission for browser notifications.
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
        console.warn('Browser does not support notifications');
        return false;
    }

    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
}

/**
 * Get current notification permission status.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
}

/**
 * Send a browser push notification.
 * Silently no-ops if permission not granted or API not available.
 */
export function sendPushNotification(options: PushNotificationOptions): Notification | null {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return null;
    }

    const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag,
    });

    if (options.onClick) {
        notification.onclick = () => {
            window.focus();
            options.onClick?.();
            notification.close();
        };
    }

    return notification;
}

// ── Notification templates ───────────────────────────────────────

export function notifyBudgetExceeded(budgetName: string, spent: number, limit: number) {
    const pct = Math.round((spent / limit) * 100);
    return sendPushNotification({
        title: `YABA — Budget Alert`,
        body: `${budgetName} is at ${pct}% ($${spent.toFixed(2)} of $${limit.toFixed(2)} limit)`,
        tag: `budget-alert-${budgetName}`,
    });
}

export function notifyExpenseAdded(vendorName: string, amount: number) {
    return sendPushNotification({
        title: `YABA — Expense Recorded`,
        body: `$${amount.toFixed(2)} — ${vendorName}`,
        tag: 'expense-added',
    });
}

export function notifyIncomeAdded(sourceName: string, amount: number) {
    return sendPushNotification({
        title: `YABA — Income Recorded`,
        body: `+$${amount.toFixed(2)} — ${sourceName}`,
        tag: 'income-added',
    });
}

export function notifyReportReady() {
    return sendPushNotification({
        title: 'YABA — Report Available',
        body: 'Your financial summary is ready to view.',
        tag: 'report-ready',
    });
}
