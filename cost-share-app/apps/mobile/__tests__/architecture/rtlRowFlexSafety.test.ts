import fs from 'node:fs';
import path from 'node:path';
import { isNativeRowFlexSafe } from '../../lib/nativeRowLayoutStyle';

const MOBILE_ROOT = path.join(__dirname, '../..');
const SCAN_DIRS = ['components', 'screens', 'hooks'].map(d => path.join(MOBILE_ROOT, d));

const ALLOWLIST = new Set([
    path.join(MOBILE_ROOT, 'hooks/useRtlLayout.tsx'),
]);

/** Parses simple inline style objects in TSX for direction + flex on the same node. */
function findUnsafeNativeRowFlexInFile(filePath: string): string[] {
    if (ALLOWLIST.has(filePath)) return [];
    const text = fs.readFileSync(filePath, 'utf8');
    const hits: string[] = [];
    const blockRe = /style=\{\[([\s\S]*?)\]\}/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(text))) {
        const block = m[1];
        if (!/direction:\s*isRtl\s*\?\s*['"]rtl['"]/.test(block)) continue;
        if (!/(flex:\s*1|flexGrow:\s*1)/.test(block)) continue;
        const style = { direction: 'rtl' as const, flex: 1 as const };
        if (!isNativeRowFlexSafe(style, 'ios')) {
            hits.push(`${path.relative(MOBILE_ROOT, filePath)}: inline style mixes direction:rtl with flex growth`);
        }
    }
    return hits;
}

describe('architecture — native RTL row + flex safety', () => {
    it('forbids direction:rtl with flex:1 in the same inline style block (iOS New Architecture)', () => {
        const violations: string[] = [];
        for (const dir of SCAN_DIRS) {
            if (!fs.existsSync(dir)) continue;
            const walk = (folder: string) => {
                for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
                    const full = path.join(folder, entry.name);
                    if (entry.isDirectory()) walk(full);
                    else if (entry.name.endsWith('.tsx')) {
                        violations.push(...findUnsafeNativeRowFlexInFile(full));
                    }
                }
            };
            walk(dir);
        }
        expect(violations).toEqual([]);
    });

    it('rtlRowStyle on iOS never sets direction (mirroring via I18nManager)', () => {
        const { rtlRowStyle } = require('../../hooks/useRtlLayout') as typeof import('../../hooks/useRtlLayout');
        const { I18nManager, Platform } = require('react-native');
        const os = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
        const i18nMgr = I18nManager as { isRTL: boolean };
        const prev = i18nMgr.isRTL;
        i18nMgr.isRTL = true;
        expect(rtlRowStyle(true).direction).toBeUndefined();
        i18nMgr.isRTL = false;
        expect(rtlRowStyle(false).direction).toBeUndefined();
        i18nMgr.isRTL = prev;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    });
});
