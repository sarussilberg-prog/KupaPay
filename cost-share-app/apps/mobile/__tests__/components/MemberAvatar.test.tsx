import React from 'react';
import { render } from '@testing-library/react-native';
import { Image } from 'react-native';
import { MemberAvatar } from '../../components/MemberAvatar';

describe('MemberAvatar', () => {
    it('renders initials when no avatarUrl', () => {
        const { getByText } = render(<MemberAvatar name="Avraham Silberg" />);
        expect(getByText('AS')).toBeTruthy();
    });

    it('renders single initial for single-word names', () => {
        const { getByText } = render(<MemberAvatar name="Bob" />);
        expect(getByText('B')).toBeTruthy();
    });

    it('renders an Image when avatarUrl is provided', () => {
        const { UNSAFE_getByType } = render(
            <MemberAvatar name="Alice" avatarUrl="https://example.com/a.png" />
        );
        expect(UNSAFE_getByType(Image)).toBeTruthy();
    });

    it.each(['sm', 'md', 'lg'] as const)('renders at size %s', (size) => {
        const { getByText } = render(<MemberAvatar name="Test" size={size} />);
        expect(getByText('T')).toBeTruthy();
    });
});
