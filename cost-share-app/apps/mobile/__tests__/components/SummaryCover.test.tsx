import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

import { SummaryCover } from '../../components/groupDetail/SummaryCover';

const mockGroup = (overrides: Partial<any> = {}): any => ({
  id: 'g1',
  name: 'Paris Trip',
  groupType: 'trip',
  imageUrl: undefined,
  defaultCurrency: 'USD',
  ...overrides,
});

const noop = () => {};

describe('SummaryCover', () => {
  it('renders gradient variant when no imageUrl', () => {
    const { getByTestId, queryByTestId } = render(
      <SummaryCover
        group={mockGroup()}
        members={[]}
        topInset={0}
        onBack={noop}
        onMenu={noop}
      />,
    );
    expect(getByTestId('summary-cover-gradient')).toBeTruthy();
    expect(queryByTestId('summary-cover-image')).toBeNull();
  });

  it('renders image variant when imageUrl is set', () => {
    const { getByTestId, queryByTestId } = render(
      <SummaryCover
        group={mockGroup({ imageUrl: 'https://example.com/x.jpg' })}
        members={[]}
        topInset={20}
        onBack={noop}
        onMenu={noop}
      />,
    );
    expect(getByTestId('summary-cover-image')).toBeTruthy();
    expect(queryByTestId('summary-cover-gradient')).toBeNull();
  });

  it('renders the group name', () => {
    const { getByText } = render(
      <SummaryCover
        group={mockGroup({ name: 'Paris Trip' })}
        members={[
          { userId: 'u1', displayName: 'A', isActive: true },
          { userId: 'u2', displayName: 'B', isActive: true },
        ]}
        topInset={0}
        onBack={noop}
        onMenu={noop}
      />,
    );
    expect(getByText('Paris Trip')).toBeTruthy();
  });

  it('fires onBack and onMenu when buttons are tapped', () => {
    const onBack = jest.fn();
    const onMenu = jest.fn();
    const { getByTestId } = render(
      <SummaryCover
        group={mockGroup()}
        members={[]}
        topInset={0}
        onBack={onBack}
        onMenu={onMenu}
      />,
    );
    fireEvent.press(getByTestId('appbar-back'));
    fireEvent.press(getByTestId('appbar-menu'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it('does not render standalone share button (share is in overflow menu)', () => {
    const { queryByTestId } = render(
      <SummaryCover
        group={mockGroup()}
        members={[]}
        topInset={0}
        onBack={noop}
        onMenu={noop}
      />,
    );
    expect(queryByTestId('appbar-share')).toBeNull();
  });

  it('renders switcher button when onSwitcherPress is provided', () => {
    const onSwitcherPress = jest.fn();
    const { getByTestId } = render(
      <SummaryCover
        group={mockGroup()}
        members={[]}
        topInset={0}
        onBack={noop}
        onMenu={noop}
        onSwitcherPress={onSwitcherPress}
      />,
    );
    fireEvent.press(getByTestId('appbar-switcher'));
    expect(onSwitcherPress).toHaveBeenCalledTimes(1);
  });

  it('renders tappable member stack when onMembersPress is provided', () => {
    const onMembersPress = jest.fn();
    const { getByTestId } = render(
      <SummaryCover
        group={mockGroup()}
        members={[{ userId: 'u1', displayName: 'A', isActive: true }]}
        topInset={0}
        onBack={noop}
        onMenu={noop}
        onMembersPress={onMembersPress}
      />,
    );
    fireEvent.press(getByTestId('cover-members-stack'));
    expect(onMembersPress).toHaveBeenCalledTimes(1);
  });
});
