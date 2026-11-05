import React from 'react';
import { render } from '@testing-library/react-native';
import { I18nManager } from 'react-native';
import { ReferralProgramContent } from '../../../screens/profile/ReferralProgramScreen';
jest.mock('../../../store', () => ({
    useAppStore: (selector: (s: { language: string }) => unknown) => selector({ language: 'he' }),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            const dict: Record<string, string> = {
                'referral.title': 'Invite friends — Pro as a gift',
                'referral.body': 'Share your link.',
                'referral.capHint': '{{count}} of {{cap}} Pro months this year',
                'referral.shareCta': 'Share link',
                'referral.copyLink': 'Copy link',
                'referral.statusTitle': 'Your referrals',
                'referral.empty': 'No referrals yet',
            };
            let value = dict[key] ?? key;
            if (opts) {
                for (const [k, v] of Object.entries(opts)) {
                    value = value.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v));
                }
            }
            return value;
        },
        i18n: { language: 'he' },
    }),
    initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

const mockData = {
    inviteToken: 'tok',
    rewardsThisYear: 0,
    annualCap: 12,
    rewards: [],
};

describe('ReferralProgramContent RTL layout', () => {
    beforeEach(() => {
        (I18nManager as unknown as { isRTL: boolean }).isRTL = true;
    });

    it('uses start-edge text alignment on title and section headers', () => {
        const { getByTestId } = render(
            <ReferralProgramContent
                data={mockData}
                language="he"
                onShare={() => {}}
                onCopy={() => {}}
            />,
        );

        const title = getByTestId('referral-program-title');
        const flat = Array.isArray(title.props.style)
            ? Object.assign({}, ...title.props.style)
            : title.props.style;
        expect(flat.textAlign).toBe('auto');

        const content = getByTestId('referral-program-content');
        expect(content.props.style).toEqual(
            expect.objectContaining({ alignItems: 'flex-start' }),
        );
    });
});
