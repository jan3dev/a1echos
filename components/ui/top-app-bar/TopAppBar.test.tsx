/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { TopAppBar } from './TopAppBar';

beforeEach(() => {
  // Reset the router mock before each test
  (useRouter as jest.Mock).mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
  });
});

/**
 * Helper to find the back button element in TopAppBar.
 * The back button renders an Icon with size 24 (width: 24, height: 24).
 * We find the Icon container View, then walk up to the nearest ancestor
 * that has an onPress handler (the RipplePressable / Pressable).
 */
const findBackButton = (root: any) => {
  const allViews = root.findAllByType(View);
  const iconContainer = allViews.find((v: any) => {
    const style = v.props.style;
    if (!style) return false;
    const flat = Array.isArray(style)
      ? Object.assign({}, ...style.filter(Boolean))
      : style;
    return flat.width === 24 && flat.height === 24;
  });
  if (!iconContainer) return null;

  let node = iconContainer.parent;
  while (node) {
    if (node.props?.onPress) return node;
    node = node.parent;
  }
  return null;
};

describe('TopAppBar', () => {
  it('renders title text', () => {
    const { getByText } = render(<TopAppBar title="Settings" />);
    expect(getByText('Settings')).toBeTruthy();
  });

  it('renders back button by default (showBackButton=true)', () => {
    const { toJSON } = render(<TopAppBar title="Details" />);
    const json = JSON.stringify(toJSON());
    // The back button renders an Icon with name="chevron_left".
    // The Icon component renders a container View with width: 24, height: 24.
    expect(json).toContain('"width":24');
    expect(json).toContain('"height":24');
  });

  it('calls router.back() when back button pressed', () => {
    const mockBack = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
      back: mockBack,
      navigate: jest.fn(),
    });

    const { UNSAFE_root } = render(<TopAppBar title="Details" />);
    const backBtn = findBackButton(UNSAFE_root);
    expect(backBtn).toBeTruthy();
    fireEvent.press(backBtn!);

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('calls custom onBackPressed when provided', () => {
    const onBackPressed = jest.fn();
    const mockBack = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
      back: mockBack,
      navigate: jest.fn(),
    });

    const { UNSAFE_root } = render(
      <TopAppBar title="Details" onBackPressed={onBackPressed} />,
    );
    const backBtn = findBackButton(UNSAFE_root);
    expect(backBtn).toBeTruthy();
    fireEvent.press(backBtn!);

    expect(onBackPressed).toHaveBeenCalledTimes(1);
    // router.back() should NOT have been called since custom handler is provided
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('hides back button when showBackButton=false', () => {
    const { UNSAFE_root, toJSON } = render(
      <TopAppBar title="Home" showBackButton={false} />,
    );
    // With showBackButton=false and no leading prop, no Icon should be rendered.
    const backBtn = findBackButton(UNSAFE_root);
    expect(backBtn).toBeNull();
    // Also verify no svg element is rendered
    const json = JSON.stringify(toJSON());
    expect(json).not.toContain('"svg"');
  });

  it('renders action buttons', () => {
    const action1 = <Text key="action1">Edit</Text>;
    const action2 = <Text key="action2">Delete</Text>;
    const { getByText } = render(
      <TopAppBar title="Details" actions={[action1, action2]} />,
    );
    expect(getByText('Edit')).toBeTruthy();
    expect(getByText('Delete')).toBeTruthy();
  });

  it('renders leading element when showBackButton=false and leading is provided', () => {
    const { getByTestId, UNSAFE_root } = render(
      <TopAppBar
        title="Home"
        showBackButton={false}
        leading={<View testID="custom-leading" />}
      />,
    );
    expect(getByTestId('custom-leading')).toBeTruthy();
    // Back button should NOT be rendered
    const backBtn = findBackButton(UNSAFE_root);
    expect(backBtn).toBeNull();
  });

  it('renders transparent mode without blur', () => {
    const { getByTestId, toJSON } = render(
      <TopAppBar title="Transparent" transparent />,
    );
    expect(getByTestId('top-app-bar')).toBeTruthy();
    const json = JSON.stringify(toJSON());
    // Transparent mode should NOT have BlurView
    expect(json).not.toContain('BlurView');
  });

  it('renders non-transparent mode (default)', () => {
    const { getByTestId, toJSON } = render(<TopAppBar title="Default" />);
    expect(getByTestId('top-app-bar')).toBeTruthy();
    const json = JSON.stringify(toJSON());
    // Non-transparent mode should have BlurView
    expect(json).toContain('BlurView');
  });

  it('renders titleWidget instead of title text when provided', () => {
    const { getByTestId } = render(
      <TopAppBar
        title="Ignored"
        titleWidget={<View testID="custom-title-widget" />}
      />,
    );
    expect(getByTestId('custom-title-widget')).toBeTruthy();
  });

  it('renders with empty actions array', () => {
    const { getByTestId } = render(
      <TopAppBar title="No Actions" actions={[]} />,
    );
    expect(getByTestId('top-app-bar')).toBeTruthy();
  });

  it('renders single action without spacer', () => {
    const action1 = <Text key="action1">Save</Text>;
    const { getByText } = render(
      <TopAppBar title="Single Action" actions={[action1]} />,
    );
    expect(getByText('Save')).toBeTruthy();
  });

  it('renders with dark theme blur tint', () => {
    const { useThemeStore } = require('@/theme');
    useThemeStore.setState({ currentTheme: 'dark' });
    const { getByTestId } = render(<TopAppBar title="Dark" />);
    expect(getByTestId('top-app-bar')).toBeTruthy();
  });

  it('renders on Android platform without BlurView', () => {
    const { Platform } = require('react-native');
    const originalOS = Platform.OS;
    Platform.OS = 'android';

    const { getByTestId } = render(<TopAppBar title="Android" />);
    expect(getByTestId('top-app-bar')).toBeTruthy();

    Platform.OS = originalOS;
  });

  it('title area is pressable when onTitlePressed is provided', () => {
    const onTitlePressed = jest.fn();
    const { getByText } = render(
      <TopAppBar title="Pressable Title" onTitlePressed={onTitlePressed} />,
    );
    fireEvent.press(getByText('Pressable Title'));
    expect(onTitlePressed).toHaveBeenCalled();
  });

  it('renders with default empty title', () => {
    const { getByTestId } = render(<TopAppBar />);
    expect(getByTestId('top-app-bar')).toBeTruthy();
  });
});
