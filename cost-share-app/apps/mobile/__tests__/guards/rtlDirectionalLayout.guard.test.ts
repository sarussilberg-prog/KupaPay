import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';

const MOBILE_DIR = resolve(__dirname, '../..');

const SKIP_DIRS = new Set(['node_modules', 'assets', '.expo']);

/** Files where physical left/right is intentional (logo geometry, device insets in mocks). */
const ALLOWLIST = new Set([
    resolve(MOBILE_DIR, 'components/AppLogoAnimated.tsx'),
    resolve(MOBILE_DIR, 'jest-setup.ts'),
    resolve(MOBILE_DIR, '__tests__/screens/groups/GroupPostCreateInviteScreen.test.tsx'),
    resolve(MOBILE_DIR, '__tests__/components/CustomTabBar.test.tsx'),
]);

const MARGIN_PADDING_RE =
    /\b(marginLeft|marginRight|paddingLeft|paddingRight)\s*:/;

/** Layout positioning — not hitSlop, safe-area insets, or gradient vectors. */
const POSITION_RE = /(?:^|[,{]\s*)(left|right)\s*:/;

function stripHitSlop(src: string): string {
    return src.replace(/hitSlop=\{\{[^}]+\}\}/g, '');
}

function stripSafeAreaInsets(src: string): string {
    return src
        .replace(/useSafeAreaInsets[^;]+;/g, '')
        .replace(/\binsets\s*:\s*\{[^}]+\}/g, '');
}

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (SKIP_DIRS.has(entry)) continue;
        const full = resolve(dir, entry);
        if (statSync(full).isDirectory()) {
            if (entry === '__tests__' && !full.includes('__tests__/guards')) {
                continue;
            }
            walk(full, out);
        } else if (
            (full.endsWith('.tsx') || full.endsWith('.ts')) &&
            !ALLOWLIST.has(full) &&
            !full.includes('__tests__/guards/rtlDirectionalLayout')
        ) {
            out.push(full);
        }
    }
    return out;
}

function findOffenders(): { file: string; reason: string }[] {
    const offenders: { file: string; reason: string }[] = [];
    for (const file of walk(MOBILE_DIR)) {
        if (file.includes(`${resolve(MOBILE_DIR, '__tests__')}`)) continue;

        let src = readFileSync(file, 'utf8');
        src = stripHitSlop(src);
        src = stripSafeAreaInsets(src);

        if (MARGIN_PADDING_RE.test(src)) {
            offenders.push({ file, reason: 'marginLeft/Right or paddingLeft/Right in styles' });
            continue;
        }

        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('LinearGradient') && line.includes('start={{')) continue;
            if (/^\s*(start|end)\s*:\s*\{\s*x\s*:/.test(line)) continue;
            if (POSITION_RE.test(line)) {
                offenders.push({
                    file,
                    reason: `layout ${line.match(POSITION_RE)?.[1]} at line ${i + 1}`,
                });
                break;
            }
        }
    }
    return offenders;
}

describe('RTL directional layout guard (#571)', () => {
    it('does not introduce marginLeft/Right, paddingLeft/Right, or layout left/right in styles', () => {
        const offenders = findOffenders();
        expect(offenders).toEqual([]);
    });
});
