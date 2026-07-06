import React from 'react';
import { render } from '@testing-library/react-native';
import { UnreadBadge } from '../../components/UnreadBadge';

describe('UnreadBadge', () => {
    it('renders the count when > 0', () => {
        const { getByText } = render(<UnreadBadge count={3} />);
        expect(getByText('3')).toBeTruthy();
    });

    it('renders nothing when count is 0', () => {
        const { queryByTestId } = render(<UnreadBadge count={0} />);
        expect(queryByTestId('unread-badge')).toBeNull();
    });

    it('clamps counts over 99 to "99+"', () => {
        const { getByText } = render(<UnreadBadge count={150} />);
        expect(getByText('99+')).toBeTruthy();
    });
});
