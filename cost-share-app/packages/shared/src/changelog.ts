/** Parse `CHANGELOG.md` sections keyed by internal version (## [2.2.0-dev.3]). */

export type ChangelogEntry = {
    version: string;
    titleLine: string;
    bullets: string[];
};

const SECTION_HEADING_RE = /^## \[([^\]]+)\]\s*(?:—|-)\s*(.+)$/;

export function parseChangelogSections(markdown: string): ChangelogEntry[] {
    const lines = markdown.split(/\r?\n/);
    const entries: ChangelogEntry[] = [];
    let current: ChangelogEntry | null = null;

    for (const line of lines) {
        const heading = SECTION_HEADING_RE.exec(line.trim());
        if (heading) {
            if (current) entries.push(current);
            current = { version: heading[1].trim(), titleLine: heading[2].trim(), bullets: [] };
            continue;
        }
        if (!current) continue;
        const bullet = /^-\s+(.+)$/.exec(line.trim());
        if (bullet) {
            current.bullets.push(bullet[1].trim());
        }
    }
    if (current) entries.push(current);
    return entries;
}

function devPrereleaseIndex(version: string): number | null {
    const m = /^(\d+\.\d+\.\d+)-dev\.(\d+)$/.exec(version.trim());
    return m ? Number(m[2]) : null;
}

/** Entries strictly after `sinceVersion` (dev prerelease compare). */
export function changelogEntriesSince(
    markdown: string,
    sinceVersion: string,
): ChangelogEntry[] {
    const sinceIdx = devPrereleaseIndex(sinceVersion);
    const all = parseChangelogSections(markdown);
    if (sinceIdx === null) {
        return all.filter(e => e.version !== sinceVersion);
    }
    return all.filter(entry => {
        const idx = devPrereleaseIndex(entry.version);
        if (idx === null) return false;
        return idx > sinceIdx;
    });
}

export function formatChangelogForTestFlight(entries: ChangelogEntry[], maxChars = 4000): string {
    const lines: string[] = [];
    for (const entry of entries) {
        lines.push(`${entry.version}`);
        for (const b of entry.bullets) {
            lines.push(`• ${b}`);
        }
        lines.push('');
    }
    const text = lines.join('\n').trim();
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars - 1)}…`;
}
