import { changelogEntriesSince, formatChangelogForTestFlight, parseChangelogSections } from '../changelog';

const SAMPLE = `# Changelog

## [2.2.0-dev.0] — baseline
- Initial

## [2.2.0-dev.1] — 2026-10-16
- First feature (#1)

## [2.2.0-dev.2] — 2026-10-16
- Second feature (#2)
`;

describe('changelog', () => {
    it('parses sections', () => {
        const entries = parseChangelogSections(SAMPLE);
        expect(entries).toHaveLength(3);
        expect(entries[1].bullets[0]).toContain('First feature');
    });

    it('collects entries since a dev version', () => {
        const since = changelogEntriesSince(SAMPLE, '2.2.0-dev.0');
        expect(since.map(e => e.version)).toEqual(['2.2.0-dev.1', '2.2.0-dev.2']);
    });

    it('formats TestFlight notes', () => {
        const entries = changelogEntriesSince(SAMPLE, '2.2.0-dev.0');
        const notes = formatChangelogForTestFlight(entries);
        expect(notes).toContain('2.2.0-dev.1');
        expect(notes).toContain('First feature');
    });
});
