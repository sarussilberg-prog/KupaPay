import fs from 'node:fs';
import path from 'node:path';
import {
    hitsToAllowlistIds,
    scanRtlRowPatternSource,
    scanRtlRowPatterns,
} from '../../lib/scanRtlRowPatterns';

const MOBILE_ROOT = path.join(__dirname, '../..');
const ALLOWLIST_PATH = path.join(__dirname, 'rtlRowPatterns.allowlist.json');
const BAD_FIXTURE_REL = '__tests__/guards/fixtures/rtlRowBadFixture.tsx';

type AllowlistFile = { allowlist: string[]; count: number };

function readAllowlist(): AllowlistFile {
    return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8')) as AllowlistFile;
}

/** Guard: shrink-only allowlist for row-reverse / hardcoded direction (Phase 2). */
describe('RTL row pattern guard (UI quality Phase 2)', () => {
    it('reports allowlist size for CI metrics (monotonic decrease target)', () => {
        const { allowlist } = readAllowlist();
        expect(allowlist.length).toBe(0);
        // eslint-disable-next-line no-console -- intentional CI metric
        console.info(`rtlRowPatterns allowlist entries: ${allowlist.length}`);
    });

    it('matches committed allowlist to current source (no stale entries, no unlisted violations)', () => {
        const hits = scanRtlRowPatterns(MOBILE_ROOT);
        const liveIds = hitsToAllowlistIds(hits);
        const { allowlist } = readAllowlist();

        expect(liveIds).toEqual(allowlist);

        const stale = allowlist.filter(id => !liveIds.includes(id));
        const unlisted = liveIds.filter(id => !allowlist.includes(id));
        expect({ stale, unlisted }).toEqual({ stale: [], unlisted: [] });
    });

    it('detects row-reverse in the bad fixture (red/green proof baseline)', () => {
        const fixturePath = path.join(MOBILE_ROOT, BAD_FIXTURE_REL);
        const source = fs.readFileSync(fixturePath, 'utf8');
        const hits = scanRtlRowPatternSource(BAD_FIXTURE_REL, source);
        const ids = hitsToAllowlistIds(hits);
        expect(ids.some(id => id.includes('row-reverse') || hits.some(h => h.kind === 'row-reverse'))).toBe(
            true,
        );
        expect(ids.length).toBeGreaterThan(0);
    });

    it('does not treat the bad fixture as allowlisted production code', () => {
        const { allowlist } = readAllowlist();
        expect(allowlist.some(id => id.startsWith(BAD_FIXTURE_REL))).toBe(false);
    });
});
