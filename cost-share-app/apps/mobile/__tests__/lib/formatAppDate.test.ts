import { formatAppDateShort } from '../../lib/formatAppDate';

describe('formatAppDateShort', () => {
    const when = new Date('2026-03-15T12:00:00.000Z');

    it('formats Hebrew with he-IL locale', () => {
        const label = formatAppDateShort(when, 'he');
        expect(label).toMatch(/15/);
        expect(label).not.toBe(when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    });

    it('formats English with en-US locale', () => {
        expect(formatAppDateShort(when, 'en')).toMatch(/Mar|15/);
    });
});
