import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const expoWebURL = process.env.E2E_EXPO_WEB_URL ?? 'http://127.0.0.1:8081';

export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'next-site',
            use: { ...devices['Desktop Chrome'], baseURL },
        },
        {
            name: 'expo-web',
            use: { ...devices['Desktop Chrome'], baseURL: expoWebURL },
        },
    ],
});
