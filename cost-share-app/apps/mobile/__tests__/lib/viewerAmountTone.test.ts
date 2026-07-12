import {
    viewerAmountTone,
    viewerAmountToneClass,
} from '../../lib/viewerAmountTone';

describe('viewerAmountTone', () => {
    it('returns positive when the viewer is owed (net > 0)', () => {
        expect(viewerAmountTone(12.5)).toBe('positive');
        expect(viewerAmountTone(0.01)).toBe('positive');
    });

    it('returns negative when the viewer owes (net < 0)', () => {
        expect(viewerAmountTone(-12.5)).toBe('negative');
        expect(viewerAmountTone(-0.01)).toBe('negative');
    });

    it('returns neutral when net is exactly zero', () => {
        expect(viewerAmountTone(0)).toBe('neutral');
    });

    it('treats sub-cent magnitudes as neutral', () => {
        expect(viewerAmountTone(0.004)).toBe('neutral');
        expect(viewerAmountTone(-0.004)).toBe('neutral');
    });

    it('returns neutral for a non-finite net', () => {
        expect(viewerAmountTone(Number.NaN)).toBe('neutral');
    });
});

describe('viewerAmountToneClass', () => {
    it('maps positive to green', () => {
        expect(viewerAmountToneClass('positive')).toBe('text-green-600');
    });

    it('maps negative to red', () => {
        expect(viewerAmountToneClass('negative')).toBe('text-red-500');
    });

    it('maps neutral to gray-900 (black)', () => {
        expect(viewerAmountToneClass('neutral')).toBe('text-gray-900');
    });
});
