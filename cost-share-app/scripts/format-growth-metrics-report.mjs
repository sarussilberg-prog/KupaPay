/**
 * Markdown report for weekly CI / ops (#422).
 */

/** @param {Record<string, unknown> | null | undefined} data */
export function formatGrowthMetricsMarkdown(data) {
    const ns = data?.north_star ?? {};
    const authors = data?.active_expense_authors ?? {};
    const series = Array.isArray(data?.north_star_monthly_series) ? data.north_star_monthly_series : [];
    const mau = Number(authors.mau ?? 0);
    const target = 1000;
    const pct = target > 0 ? Math.min(100, Math.round((mau / target) * 100)) : 0;

    const lines = [
        '## Growth metrics (Postgres)',
        '',
        `_As of ${data?.as_of ?? 'unknown'}_`,
        '',
        '| Metric | Value |',
        '|--------|------:|',
        `| North star (${ns.current_month ?? '—'}) | ${ns.current_month_count ?? 0} groups |`,
        `| North star (${ns.previous_month ?? '—'}) | ${ns.previous_month_count ?? 0} groups |`,
        `| DAU (expense authors) | ${authors.dau ?? 0} |`,
        `| WAU (expense authors) | ${authors.wau ?? 0} |`,
        `| MAU proxy (expense authors) | ${mau} / ${target} (${pct}% of epic) |`,
        '',
        '**North-star definition:** groups with ≥2 distinct members adding expenses in the calendar month.',
        '',
        'Complement PostHog MAU/WAU/DAU from `app_open` on the [MAU dashboard](https://eu.posthog.com) (see `cost-share-app/analytics/README.md`).',
    ];

    if (series.length) {
        lines.push('', '### North star — last 12 months', '', '| Month | Groups |', '|-------|-------:|');
        for (const row of series) {
            lines.push(`| ${row.month ?? '—'} | ${row.north_star_groups ?? 0} |`);
        }
    }

    return lines.join('\n');
}
