/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import React from 'react';

import { useSettingsStore } from '@/stores';

import { HomeAppBar } from './HomeAppBar';

jest.mock('@/stores', () => ({
  useSettingsStore: jest.fn(),
}));

jest.mock('../../ui/icon/Icon', () => ({
  Icon: (props: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${props.name}`} />;
  },
}));

jest.mock('../../ui/ripple-pressable/RipplePressable', () => ({
  RipplePressable: ({ children, onPress, ...props }: any) => {
    const { Pressable } = require('react-native');
    return (
      <Pressable onPress={onPress} {...props}>
        {children}
      </Pressable>
    );
  },
}));

jest.mock('../../ui/top-app-bar/TopAppBar', () => ({
  TopAppBar: (props: any) => {
    const { View } = require('react-native');
    return (
      <View testID="top-app-bar">
        {props.leading}
        {props.actions}
      </View>
    );
  },
}));

jest.mock('./IncognitoExplainerModal', () => ({
  IncognitoExplainerModal: () => {
    const { View } = require('react-native');
    return <View testID="incognito-modal" />;
  },
}));

const mockSettingsStore = {
  isIncognitoMode: false,
  hasSeenIncognitoExplainer: true,
  setIncognitoMode: jest.fn(),
  markIncognitoExplainerSeen: jest.fn(),
};

describe('HomeAppBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSettingsStore as unknown as jest.Mock).mockReturnValue(
      mockSettingsStore,
    );
  });

  it('renders echos logo in normal mode', () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    expect(getByTestId('icon-echos_logo')).toBeTruthy();
  });

  it('renders settings icon button in normal mode', () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    expect(getByTestId('icon-hamburger')).toBeTruthy();
  });

  it('settings button navigates to /settings', () => {
    const mockRouter = (useRouter as jest.Mock)();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    const settingsIcon = getByTestId('icon-hamburger');
    fireEvent.press(settingsIcon.parent!);
    expect(mockRouter.push).toHaveBeenCalledWith('/settings');
  });

  it('renders ghost icon for incognito toggle', () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    expect(getByTestId('icon-ghost')).toBeTruthy();
  });

  it('in selection mode: renders back chevron (not logo)', () => {
    const { getByTestId, queryByTestId } = render(
      <HomeAppBar selectionMode={true} />,
    );
    expect(getByTestId('icon-chevron_left')).toBeTruthy();
    expect(queryByTestId('icon-echos_logo')).toBeNull();
  });

  it('in selection mode: renders trash icon', () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={true} />);
    expect(getByTestId('icon-trash')).toBeTruthy();
  });

  it('trash press calls onDeleteSelected', () => {
    const onDeleteSelected = jest.fn();
    const { getByTestId } = render(
      <HomeAppBar selectionMode={true} onDeleteSelected={onDeleteSelected} />,
    );
    fireEvent.press(getByTestId('icon-trash').parent!);
    expect(onDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it('back chevron press calls onExitSelectionMode', () => {
    const onExit = jest.fn();
    const { getByTestId } = render(
      <HomeAppBar selectionMode={true} onExitSelectionMode={onExit} />,
    );
    fireEvent.press(getByTestId('icon-chevron_left').parent!);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
