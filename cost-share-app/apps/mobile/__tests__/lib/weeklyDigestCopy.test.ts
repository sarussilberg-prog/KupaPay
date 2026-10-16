import { weeklyDigestCopy } from '@cost-share/shared';

describe('weeklyDigestCopy', () => {
    it('includes balance lines in push body', () => {
        const copy = weeklyDigestCopy('en', {
            oweTotal: '$10.00',
            owedTotal: '$5.00',
            topGroupName: 'Roommates',
        });
        expect(copy.pushBody).toContain('$10.00');
        expect(copy.pushBody).toContain('Roommates');
    });
});
