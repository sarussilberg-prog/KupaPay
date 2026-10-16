import fs from 'node:fs';
import path from 'node:path';
import { chromium, type FullConfig } from '@playwright/test';
import { signInDevTestUser } from './helpers/supabaseSession';

const authFile = path.join(__dirname, '.auth', 'expo-dev-user.json');

export default async function globalSetup(config: FullConfig) {
    if (process.env.E2E_SEED_USER === '1') {
        const { spawnSync } = await import('node:child_process');
        const root = path.join(__dirname, '..');
        const res = spawnSync(
            'npx',
            ['ts-node', '-r', 'dotenv/config', 'scripts/seed-e2e-dev-user.ts'],
            {
            cwd: root,
            stdio: 'inherit',
                env: {
                    ...process.env,
                    DOTENV_CONFIG_PATH: process.env.DOTENV_CONFIG_PATH ?? 'supabase/.env',
                },
            },
        );
        if (res.status !== 0) {
            throw new Error('seed-e2e-dev-user.ts failed');
        }
    }

    const expoBase = process.env.E2E_EXPO_WEB_URL;
    if (!expoBase || !process.env.E2E_TEST_PASSWORD) {
        return;
    }

    const { session, storageKey } = await signInDevTestUser();
    fs.mkdirSync(path.dirname(authFile), { recursive: true });

    const browser = await chromium.launch();
    const context = await browser.newContext();
    await context.addInitScript(
        ({ key, value }) => {
            localStorage.setItem(key, value);
        },
        { key: storageKey, value: JSON.stringify(session) },
    );
    const page = await context.newPage();
    await page.goto(expoBase, { waitUntil: 'domcontentloaded' });
    await context.storageState({ path: authFile });
    await browser.close();
}
