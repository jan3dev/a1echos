import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Platform, Text } from 'react-native';

import { RipplePressable } from './RipplePressable';

describe('RipplePressable', () => {
  afterEach(() => {
    // Reset Platform.OS to default after each test
    Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
  });

  it('renders children on iOS', () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
    const { getByText } = render(
      <RipplePressable rippleColor="#000">
        <Text>iOS Child</Text>
      </RipplePressable>,
    );
    expect(getByText('iOS Child')).toBeTruthy();
  });

  it('renders children on Android', () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    const { getByText } = render(
      <RipplePressable rippleColor="#000">
        <Text>Android Child</Text>
      </RipplePressable>,
    );
    expect(getByText('Android Child')).toBeTruthy();
  });

  it('calls onPress handler', () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
    const onPress = jest.fn();
    const { getByText } = render(
      <RipplePressable onPress={onPress}>
        <Text>Press Me</Text>
      </RipplePressable>,
    );
    fireEvent.press(getByText('Press Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('iOS renders Pressable component (no TouchableNativeFeedback)', () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
    const { toJSON } = render(
      <RipplePressable rippleColor="#000">
        <Text>iOS Pressable</Text>
      </RipplePressable>,
    );
    const json = JSON.stringify(toJSON());
    // On iOS, RipplePressable renders Pressable which does NOT wrap in
    // TouchableNativeFeedback. The root type should be "View" (Pressable renders as View).
    expect(json).not.toContain('TouchableNativeFeedback');
  });

  it('Android renders TouchableNativeFeedback component', () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    const { toJSON } = render(
      <RipplePressable rippleColor="#000">
        <Text>Android TNF</Text>
      </RipplePressable>,
    );
    const tree = toJSON();
    const json = JSON.stringify(tree);
    // On Android with rippleColor, the component renders TouchableNativeFeedback
    // which serializes with nativeForegroundAndroid containing a RippleAndroid type.
    // iOS renders do not include this property.
    expect(json).toContain('RippleAndroid');
    expect(json).toContain('Android TNF');
  });
});
