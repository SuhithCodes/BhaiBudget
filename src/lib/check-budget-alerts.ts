/**
 * Client-side helper: after saving an expense, check if any budget is now exceeded
 * and fire the budget-alert API if email notifications are enabled.
 */
export async function checkBudgetAlerts(
    userId: string,
    userEmail: string,
    expenseCategory: string,
    allExpenses: { category: string; totalAmount: number }[],
    budgets: { name: string; category: string; amount: number }[],
) {
    // Find budgets matching this expense's category
    const matchingBudgets = budgets.filter(
        (b) => b.category.toLowerCase() === expenseCategory.toLowerCase(),
    );

    if (matchingBudgets.length === 0) return;

    // Calculate total spent in this category
    const totalSpent = allExpenses
        .filter((e) => e.category.toLowerCase() === expenseCategory.toLowerCase())
        .reduce((sum, e) => sum + e.totalAmount, 0);

    // Fire alerts for each exceeded budget
    for (const budget of matchingBudgets) {
        if (totalSpent > budget.amount) {
            try {
                await fetch('/api/notifications/budget-alert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        userEmail,
                        budgetName: budget.name,
                        category: budget.category,
                        spent: totalSpent,
                        limit: budget.amount,
                    }),
                });
            } catch (error) {
                console.error('Budget alert failed:', error);
            }
        }
    }
}
