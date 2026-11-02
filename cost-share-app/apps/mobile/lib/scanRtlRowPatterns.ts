import fs from 'node:fs';
import path from 'node:path';

/** Whole files exempt from the row-reverse / hardcoded direction ban (canonical RTL helpers). */
const RTL_ROW_PATTERN_EXEMPT_FILES = new Set([
    'hooks/useRtlLayout.tsx',
    'lib/scanRtlRowPatterns.ts',
]);

const SKIP_DIRS = new Set(['node_modules', 'assets', '.expo', '__tests__']);

type RtlRowPatternHit = {
    id: string;
    rel: string;
    line: number;
    kind: string;
};

const PATTERN_DEFS: { kind: string; re: RegExp }[] = [
    { kind: 'row-reverse', re: /row-reverse/ },
    { kind: 'direction-literal', re: /direction:\s*['"](?:ltr|rtl)['"]/ },
    { kind: 'direction-isRtl', re: /direction:\s*isRtl\s*\?\s*['"]rtl['"]\s*:\s*['"]ltr['"]/ },
    {
        kind: 'direction-type',
        re: /const\s+direction:\s*['"]rtl['"]\s*\|\s*['"]ltr['"]\s*=/,
    },
    {
        kind: 'flexDirection-row-reverse',
        re: /flexDirection:\s*isRtl\s*\?\s*['"]row-reverse['"]/,
    },
    {
        kind: 'rowDirection-reverse',
        re: /rowDirection\s*=\s*isRtl\s*\?\s*['"]row-reverse['"]/,
    },
];

function isCommentLine(line: string): boolean {
    const t = line.trimStart();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

/** Scan one source file (guard fixtures and allowlist refresh). */
export function scanRtlRowPatternSource(rel: string, source: string): RtlRowPatternHit[] {
    if (RTL_ROW_PATTERN_EXEMPT_FILES.has(rel)) return [];
    const hits: RtlRowPatternHit[] = [];
    const lines = source.split('\n');
    lines.forEach((line, index) => {
        if (isCommentLine(line)) return;
        for (const def of PATTERN_DEFS) {
            if (!def.re.test(line)) continue;
            const lineNo = index + 1;
            hits.push({
                id: `${rel}:${lineNo}`,
                rel,
                line: lineNo,
                kind: def.kind,
            });
        }
    });
    hits.sort((a, b) => a.id.localeCompare(b.id));
    return hits;
}

export function scanRtlRowPatterns(mobileRoot: string): RtlRowPatternHit[] {
    const hits: RtlRowPatternHit[] = [];

    function walk(dir: string): void {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            if (SKIP_DIRS.has(ent.name)) continue;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                walk(full);
                continue;
            }
            if (!/\.(tsx|ts)$/.test(ent.name)) continue;

            const rel = path.relative(mobileRoot, full).replace(/\\/g, '/');
            if (RTL_ROW_PATTERN_EXEMPT_FILES.has(rel)) continue;
            if (rel.startsWith('__tests__/guards/rtlRowPatterns')) continue;

            const lines = fs.readFileSync(full, 'utf8').split('\n');
            lines.forEach((line, index) => {
                if (isCommentLine(line)) return;
                for (const def of PATTERN_DEFS) {
                    if (!def.re.test(line)) continue;
                    const lineNo = index + 1;
                    hits.push({
                        id: `${rel}:${lineNo}`,
                        rel,
                        line: lineNo,
                        kind: def.kind,
                    });
                }
            });
        }
    }

    walk(mobileRoot);
    hits.sort((a, b) => a.id.localeCompare(b.id));
    return hits;
}

export function hitsToAllowlistIds(hits: RtlRowPatternHit[]): string[] {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const h of hits) {
        if (seen.has(h.id)) continue;
        seen.add(h.id);
        ids.push(h.id);
    }
    return ids.sort();
}
