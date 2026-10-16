import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const expoWebURL = process.env.E2E_EXPO_WEB_URL ?? 'http://127.0.0.1:8081';
const authFile = path.join(__dirname, 'e2e/.auth/expo-dev-user.json');

export default defineConfig({
    testDir: './e2e',
    globalSetup: './e2e/global-setup.ts',
    timeout: 90_000,
    expect: { timeout: 15_000 },
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
            testMatch: /next-.*\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], baseURL },
        },
        {
            name: 'expo-web',
            testMatch: /expo-web-smoke\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], baseURL: expoWebURL },
        },
        {
            name: 'expo-web-authenticated',
            testMatch: /dev-stack-flows\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                baseURL: expoWebURL,
                storageState: authFile,
            },
        },
    ],
});
