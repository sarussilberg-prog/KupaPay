const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Two Release-only fixes added to ios/.xcode.env so the JS bundler sees the prod env:
//
// 1. NODE_ENV=production: makes @expo/env load .env.production with priority over .env.
//    Without it, the loader defaults to development and .env wins for shared keys.
//
// 2. SENTRY_LOAD_DOTENV=0: stops sentry-cli (the wrapper around `expo export:embed`)
//    from auto-loading .env at startup. Without this, sentry-cli pre-populates
//    process.env with .env (dev) values, and @expo/env's first-set-wins behavior
//    means it never overrides them from .env.production. Result: dev Supabase URL
//    inlined into release bundles. Sentry CLI doesn't need .env for its own work —
//    SENTRY_AUTH_TOKEN is injected into the gitignored .xcode.env.local (see below),
//    which the bundle phase sources directly (independent of SENTRY_LOAD_DOTENV).
// Use `if/then/fi` (not `[ … ] && export …`) so the block can't end on a
// falsy expression. expo-configure-project.sh runs `set -eo pipefail` and
// `source`s this file; if the last sourced line exits non-zero (Debug builds
// taking the false branch of `&&`), set -e silently kills the script before
// expo-modules autolinking runs, causing a no-message build failure.
const MARKER = '# [withReleaseNodeEnv] env fixes for Release/Archive builds';
const BLOCK = `${MARKER}
if [ "$CONFIGURATION" = "Release" ]; then
  export NODE_ENV=production
  export SENTRY_LOAD_DOTENV=0
fi
`;

function appendBlock(filePath) {
    const contents = fs.readFileSync(filePath, 'utf8');
    if (contents.includes(MARKER)) return;
    const sep = contents.endsWith('\n') ? '\n' : '\n\n';
    fs.writeFileSync(filePath, `${contents}${sep}${BLOCK}`);
}

// Read SENTRY_AUTH_TOKEN from the process env (CI/EAS may export it) or, as a
// fallback, straight out of the .env files. Canonical home is .env.production —
// it's a Release-only secret and lives alongside the other prod-only secrets there.
function resolveSentryAuthToken(appRoot) {
    if (process.env.SENTRY_AUTH_TOKEN) return process.env.SENTRY_AUTH_TOKEN.trim();
    for (const name of ['.env.production', '.env.local', '.env']) {
        const file = path.join(appRoot, name);
        if (!fs.existsSync(file)) continue;
        const m = fs.readFileSync(file, 'utf8').match(/^SENTRY_AUTH_TOKEN=(.*)$/m);
        if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
    return undefined;
}

// .xcode.env.local is gitignored and wiped by `prebuild --clean`, so re-inject the
// Sentry auth token on every prebuild. The bundle phase sources this file, making
// source-map upload work for local Release/Archive builds without manual setup.
function injectSentryAuthToken(platformProjectRoot, appRoot) {
    const token = resolveSentryAuthToken(appRoot);
    if (!token) return; // CI/EAS provide it differently; nothing to inject locally.
    const filePath = path.join(platformProjectRoot, '.xcode.env.local');
    let contents = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    if (/^export SENTRY_AUTH_TOKEN=/m.test(contents)) return; // already present
    const sep = contents && !contents.endsWith('\n') ? '\n' : '';
    fs.writeFileSync(filePath, `${contents}${sep}export SENTRY_AUTH_TOKEN=${token}\n`);
}

module.exports = function withReleaseNodeEnv(config) {
    return withDangerousMod(config, [
        'ios',
        (cfg) => {
            const platformProjectRoot = cfg.modRequest.platformProjectRoot;
            const appRoot = cfg.modRequest.projectRoot;
            const xcodeEnv = path.join(platformProjectRoot, '.xcode.env');
            if (fs.existsSync(xcodeEnv)) appendBlock(xcodeEnv);
            injectSentryAuthToken(platformProjectRoot, appRoot);
            return cfg;
        },
    ]);
};
