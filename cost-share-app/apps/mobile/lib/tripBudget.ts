/** Pro trip budget progress (pure). */

export function tripBudgetPercent(spent: number, budget: number): number {
    if (budget <= 0) return 0;
    return Math.min(999, (spent / budget) * 100);
}

export function sumExpensesInCurrency(
    expenses: Array<{ amount: number; currency: string; isDeleted?: boolean }>,
    currency: string,
): number {
    const code = currency.toUpperCase();
    let total = 0;
    for (const e of expenses) {
        if (e.isDeleted) continue;
        if (e.currency.toUpperCase() !== code) continue;
        total += e.amount;
    }
    return Number(total.toFixed(2));
}
