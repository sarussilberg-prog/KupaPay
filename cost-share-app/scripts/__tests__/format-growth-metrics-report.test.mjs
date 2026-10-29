import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGrowthMetricsMarkdown } from '../format-growth-metrics-report.mjs';

test('formatGrowthMetricsMarkdown includes north star and MAU epic line', () => {
    const md = formatGrowthMetricsMarkdown({
        as_of: '2026-10-27T08:00:00Z',
        north_star: {
            current_month: '2026-10',
            current_month_count: 7,
            previous_month: '2026-09',
            previous_month_count: 4,
        },
        active_expense_authors: { dau: 2, wau: 15, mau: 250, note: '' },
        north_star_monthly_series: [{ month: '2026-10', north_star_groups: 7 }],
    });
    assert.match(md, /North star \(2026-10\) \| 7 groups/);
    assert.match(md, /250 \/ 1000 \(25% of epic\)/);
    assert.match(md, /2026-10 \| 7/);
});
