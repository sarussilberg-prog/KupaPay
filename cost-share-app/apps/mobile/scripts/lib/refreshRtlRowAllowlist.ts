import fs from 'node:fs';
import path from 'node:path';
import { hitsToAllowlistIds, scanRtlRowPatterns } from '../../lib/scanRtlRowPatterns';

const mobileRoot = path.join(__dirname, '../..');
const outPath = path.join(mobileRoot, '__tests__/guards/rtlRowPatterns.allowlist.json');

const hits = scanRtlRowPatterns(mobileRoot);
const allowlist = hitsToAllowlistIds(hits);
const payload = { allowlist, count: allowlist.length };
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
// eslint-disable-next-line no-console
console.info(`Wrote ${allowlist.length} allowlist entries to ${path.relative(mobileRoot, outPath)}`);
