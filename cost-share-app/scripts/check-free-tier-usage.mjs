#!/usr/bin/env node
/**
 * Free-tier usage snapshot (#426). Read-only; exits 0 unless thresholds breached with --strict.
 */
const WARN_RATIO = 0.7;

function log(line) {
    process.stdout.write(`${line}\n`);
}

async function fetchJson(url, headers) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
        throw new Error(`${url} → ${res.status}`);
    }
    return res.json();
}

async function checkSentry() {
    const token = process.env.FREE_TIER_SENTRY_AUTH_TOKEN?.trim();
    const org = process.env.FREE_TIER_SENTRY_ORG?.trim();
    if (!token || !org) {
        log('- Sentry: skipped (set FREE_TIER_SENTRY_AUTH_TOKEN + FREE_TIER_SENTRY_ORG)');
        return [];
    }
    const stats = await fetchJson(`https://sentry.io/api/0/organizations/${org}/stats_v2/?statsPeriod=30d`, {
        Authorization: `Bearer ${token}`,
    });
    const events = stats?.groups?.[0]?.totals?.['sum(quantity)'];
    const quota = Number(process.env.FREE_TIER_SENTRY_EVENTS_QUOTA || 5000);
    if (typeof events === 'number') {
        const ratio = events / quota;
        log(`- Sentry events (30d): ${events} / ${quota} (${(ratio * 100).toFixed(1)}%)`);
        if (ratio >= WARN_RATIO) {
            return [`Sentry usage ≥70% (${events}/${quota})`];
        }
    }
    return [];
}

async function checkPostHog() {
    const key = process.env.FREE_TIER_POSTHOG_PERSONAL_API_KEY?.trim();
    const projectId = process.env.FREE_TIER_POSTHOG_PROJECT_ID?.trim();
    if (!key || !projectId) {
        log('- PostHog: skipped (set FREE_TIER_POSTHOG_PERSONAL_API_KEY + FREE_TIER_POSTHOG_PROJECT_ID)');
        return [];
    }
    const host = (process.env.FREE_TIER_POSTHOG_HOST || 'https://eu.i.posthog.com').replace(/\/$/, '');
    const billing = await fetchJson(`${host}/api/projects/${projectId}/billing/`, {
        Authorization: `Bearer ${key}`,
    });
    const used = billing?.event_count ?? billing?.usage?.events;
    const quota = Number(process.env.FREE_TIER_POSTHOG_EVENTS_QUOTA || 1_000_000);
    if (typeof used === 'number') {
        const ratio = used / quota;
        log(`- PostHog events: ${used} / ${quota} (${(ratio * 100).toFixed(1)}%)`);
        if (ratio >= WARN_RATIO) {
            return [`PostHog usage ≥70% (${used}/${quota})`];
        }
    }
    return [];
}

async function main() {
    log('# Free-tier usage check\n');
    log('See docs/SSOT/FREE_TIER_LIMITS.md for manual Supabase/Vercel/Expo checks.\n');

    const warnings = [];
    try {
        warnings.push(...(await checkSentry()));
    } catch (e) {
        log(`- Sentry check failed: ${e.message}`);
    }
    try {
        warnings.push(...(await checkPostHog()));
    } catch (e) {
        log(`- PostHog check failed: ${e.message}`);
    }

    if (warnings.length) {
        log('\n## ⚠️ Alerts (≥70%)\n');
        warnings.forEach(w => log(`- ${w}`));
        if (process.argv.includes('--strict')) {
            process.exitCode = 1;
        }
    } else {
        log('\nNo automated quota warnings (or APIs not configured).');
    }
}

main();
