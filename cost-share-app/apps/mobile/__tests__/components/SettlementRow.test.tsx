import React from 'react';
import { render } from '@testing-library/react-native';
import { SettlementRow } from '../../components/SettlementRow';
import type { Settlement } from '@cost-share/shared';

const settlement: Settlement = {
    id: 'st1',
    groupId: 'g1',
    fromUserId: 'me',
    toUserId: 'bob',
    amount: 50,
    currency: 'ILS',
    createdBy: 'me',
    settlementDate: new Date('2026-05-12'),
    createdAt: new Date('2026-05-12'),
    updatedAt: new Date('2026-05-12'),
    deletedAt: null,
};

describe('SettlementRow', () => {
    it('uses second-person copy when the viewer paid', () => {
        const { getByText } = render(
            <SettlementRow
                settlement={settlement}
                currentUserId="me"
                fromName="את/ה"
                toName="Bob"
                onPress={() => {}}
            />,
        );
        expect(getByText(/feed\.settlementYouClosedAndPaid/)).toBeTruthy();
    });

    it('uses recipient copy when the viewer was paid', () => {
        const { getByText } = render(
            <SettlementRow
                settlement={settlement}
                currentUserId="bob"
                fromName="Me"
                toName="את/ה"
                onPress={() => {}}
            />,
        );
        expect(getByText(/feed\.settlementClosedAndPaidYou/)).toBeTruthy();
    });

    it('colors the amount red when the viewer paid (is the payer)', () => {
        const { getByText } = render(
            <SettlementRow
                settlement={settlement}
                currentUserId="me"
                fromName="את/ה"
                toName="Bob"
                onPress={() => {}}
            />,
        );
        const value = getByText('50');
        expect(value.props.className).toContain('text-red-500');
    });

    it('colors the amount green when the viewer was paid (is the payee)', () => {
        const { getByText } = render(
            <SettlementRow
                settlement={settlement}
                currentUserId="bob"
                fromName="Me"
                toName="את/ה"
                onPress={() => {}}
            />,
        );
        const value = getByText('50');
        expect(value.props.className).toContain('text-green-600');
    });

    it('colors the amount black for a third-party settlement', () => {
        const { getByText } = render(
            <SettlementRow
                settlement={settlement}
                currentUserId="carol"
                fromName="Me"
                toName="Bob"
                onPress={() => {}}
            />,
        );
        const value = getByText('50');
        expect(value.props.className).toContain('text-gray-900');
    });
});
