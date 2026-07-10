/**
 * Canonical Firestore collection names.
 *
 * Every reader and writer must import from here — a one-character typo in a
 * collection name fails silently in Firestore (queries just return nothing).
 */
export const COLLECTIONS = {
    expenses: 'expenses',
    incomes: 'incomes',
    budgets: 'budgets',
    savingsGoals: 'savingsGoals',
    userPreferences: 'userPreferences',
} as const;
