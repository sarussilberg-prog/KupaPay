import { bindCountLabelNoBreak } from '../listMetaLabel';

describe('bindCountLabelNoBreak', () => {
    it('uses NBSP between Hebrew count and word', () => {
        expect(bindCountLabelNoBreak('2 חברים')).toBe('2\u00A0חברים');
    });

    it('leaves labels without a leading count unchanged', () => {
        expect(bindCountLabelNoBreak('Office')).toBe('Office');
    });
});
