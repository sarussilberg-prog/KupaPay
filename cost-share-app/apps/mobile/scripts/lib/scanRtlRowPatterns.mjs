/**
 * Node CLI wrapper — logic lives in lib/scanRtlRowPatterns.ts (Jest + guards).
 * Refresh allowlist: npx tsx scripts/lib/refreshRtlRowAllowlist.ts
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const refreshScript = path.join(__dirname, 'refreshRtlRowAllowlist.ts');

if (process.argv[1]?.endsWith('scanRtlRowPatterns.mjs') && process.argv.includes('--refresh')) {
    execFileSync('npx', ['tsx', refreshScript], { stdio: 'inherit', cwd: path.join(__dirname, '../..') });
}
