import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { MemberAvatar } from '../../components/MemberAvatar';

describe('MemberAvatar', () => {
    it('renders initials when no avatarUrl', () => {
        const { getByText } = render(<MemberAvatar name="Avraham Silberg" />);
        expect(getByText('AS')).toBeTruthy();
    });

    it('renders Hebrew initials centered (RTL names)', () => {
        const { getByText } = render(<MemberAvatar name="אברהם סילברג" />);
        const initials = getByText('אס');
        expect(initials.props.className).toContain('text-center');
        expect(StyleSheet.flatten(initials.props.style)).toEqual(
            expect.objectContaining({ textAlign: 'center', width: '100%' }),
        );
    });

    it('renders single initial for single-word names', () => {
        const { getByText } = render(<MemberAvatar name="Bob" />);
        expect(getByText('B')).toBeTruthy();
    });

    it('renders an image when avatarUrl is provided', () => {
        const { getByTestId } = render(
            <MemberAvatar name="Alice" avatarUrl="https://example.com/a.png" />,
        );
        expect(getByTestId('member-avatar-image')).toBeTruthy();
    });

    it('falls back to initials after the image fails to load past the retry budget', () => {
        const { queryByTestId, getByText } = render(
            <MemberAvatar name="Alice Smith" avatarUrl="https://example.com/broken.png" />,
        );
        // Each onError re-attempts (self-heal); after the budget is exhausted it
        // shows initials instead of a permanent blank box.
        for (let i = 0; i < 6; i++) {
            const img = queryByTestId('member-avatar-image');
            if (!img) break;
            fireEvent(img, 'error', { error: 'boom' });
        }
        expect(queryByTestId('member-avatar-image')).toBeNull();
        expect(getByText('AS')).toBeTruthy();
    });

    it.each(['sm', 'md', 'lg'] as const)('renders at size %s', (size) => {
        const { getByText } = render(<MemberAvatar name="Test" size={size} />);
        expect(getByText('T')).toBeTruthy();
    });
});
