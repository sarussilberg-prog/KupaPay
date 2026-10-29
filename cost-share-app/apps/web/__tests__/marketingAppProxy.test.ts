import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const WEB_DIR = path.join(import.meta.dirname, '..');

test('committed app-proxy defaults exist for prod and dev', () => {
    const prod = fs.readFileSync(path.join(WEB_DIR, 'app-proxy.production.defaults'), 'utf8');
    const dev = fs.readFileSync(path.join(WEB_DIR, 'app-proxy.development.defaults'), 'utf8');
    assert.match(prod, /^APP_PROXY_ORIGIN=https:\/\//m);
    assert.match(dev, /^APP_PROXY_ORIGIN=https:\/\//m);
    assert.notEqual(prod.trim(), dev.trim());
});

test('build-web-next.sh loads app-proxy defaults and requires origin on Vercel', () => {
    const script = fs.readFileSync(path.join(WEB_DIR, 'scripts/build-web-next.sh'), 'utf8');
    assert.match(script, /app-proxy\.production\.defaults/);
    assert.match(script, /app-proxy\.development\.defaults/);
    assert.match(script, /Missing APP_PROXY_ORIGIN/);
});

test('next.config defines fallback rewrite when APP_PROXY_ORIGIN is set at build time', async () => {
    const previous = process.env.APP_PROXY_ORIGIN;
    process.env.APP_PROXY_ORIGIN = 'https://app-proxy.example.test';
    try {
        const configModule = await import('../next.config.ts');
        const config = configModule.default as {
            rewrites?: () => Promise<{ fallback?: { source: string; destination: string }[] }>;
        };
        const rewrites = await config.rewrites?.();
        const fallback = rewrites && 'fallback' in rewrites ? rewrites.fallback : undefined;
        assert.ok(fallback?.some((rule) => rule.destination.includes('app-proxy.example.test')));
    } finally {
        if (previous === undefined) {
            delete process.env.APP_PROXY_ORIGIN;
        } else {
            process.env.APP_PROXY_ORIGIN = previous;
        }
    }
});
