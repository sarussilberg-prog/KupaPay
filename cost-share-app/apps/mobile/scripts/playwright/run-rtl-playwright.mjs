#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveExpoDist } from './serve-expo-dist.mjs';

const distDir = path.resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 8081);
const mobileDir = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const costShareRoot = path.join(mobileDir, '../..');

const server = await serveExpoDist(distDir, port);
const baseUrl = `http://127.0.0.1:${port}`;

const env = { ...process.env, E2E_EXPO_WEB_URL: baseUrl, CI: 'true' };

function run(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { cwd, env, stdio: 'inherit' });
        child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    });
}

try {
    await run('npx', ['playwright', 'install', 'chromium'], costShareRoot);
    await run(
        'npx',
        ['playwright', 'test', '--project=expo-web', 'e2e/expo-web-rtl-layout.spec.ts'],
        costShareRoot,
    );
} finally {
    server.close();
}
