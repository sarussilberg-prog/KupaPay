/** Monthly roommates / bills cycle helpers (#407). */

export function monthlyCycleBounds(reference: Date, cycleDay: number): { start: Date; end: Date } {
    const day = Math.min(Math.max(cycleDay, 1), 28);
    const y = reference.getUTCFullYear();
    const m = reference.getUTCMonth();
    const d = reference.getUTCDate();

    let startMonth = m;
    let startYear = y;
    if (d < day) {
        startMonth -= 1;
        if (startMonth < 0) {
            startMonth = 11;
            startYear -= 1;
        }
    }
    const start = new Date(Date.UTC(startYear, startMonth, day, 0, 0, 0, 0));

    let endMonth = startMonth + 1;
    let endYear = startYear;
    if (endMonth > 11) {
        endMonth = 0;
        endYear += 1;
    }
    const end = new Date(Date.UTC(endYear, endMonth, day, 0, 0, 0, 0));

    return { start, end };
}

export function expenseInMonthlyCycle(expenseDateIso: string, cycleDay: number, reference = new Date()): boolean {
    const { start, end } = monthlyCycleBounds(reference, cycleDay);
    const d = new Date(expenseDateIso);
    if (Number.isNaN(d.getTime())) return false;
    return d >= start && d < end;
}
