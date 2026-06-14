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
//    SENTRY_AUTH_TOKEN comes from .xcode.env.local.
const MARKER = '# [withReleaseNodeEnv] env fixes for Release/Archive builds';
const BLOCK = `${MARKER}
[ "$CONFIGURATION" = "Release" ] && export NODE_ENV=production
[ "$CONFIGURATION" = "Release" ] && export SENTRY_LOAD_DOTENV=0
`;

function appendBlock(filePath) {
    const contents = fs.readFileSync(filePath, 'utf8');
    if (contents.includes(MARKER)) return;
    const sep = contents.endsWith('\n') ? '\n' : '\n\n';
    fs.writeFileSync(filePath, `${contents}${sep}${BLOCK}`);
}

module.exports = function withReleaseNodeEnv(config) {
    return withDangerousMod(config, [
        'ios',
        (cfg) => {
            const xcodeEnv = path.join(cfg.modRequest.platformProjectRoot, '.xcode.env');
            if (fs.existsSync(xcodeEnv)) appendBlock(xcodeEnv);
            return cfg;
        },
    ]);
};
