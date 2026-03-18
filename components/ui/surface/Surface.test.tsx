import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { shadows } from '@/theme';

import { Surface } from './Surface';

describe('Surface', () => {
  it('renders children', () => {
    const { getByText } = render(
      <Surface>
        <Text>Surface Content</Text>
      </Surface>,
    );
    expect(getByText('Surface Content')).toBeTruthy();
  });

  it('applies filled variant by default', () => {
    const { toJSON } = render(
      <Surface>
        <Text>Filled</Text>
      </Surface>,
    );
    const json = JSON.stringify(toJSON());
    // Filled variant should NOT render BlurView
    expect(json).not.toContain('BlurView');
  });

  it('applies glass variant (renders BlurView)', () => {
    const { toJSON } = render(
      <Surface variant="glass">
        <Text>Glass</Text>
      </Surface>,
    );
    const json = JSON.stringify(toJSON());
    // Glass variant renders BlurView (mocked as string component "BlurView")
    expect(json).toContain('BlurView');
  });

  it('applies elevation shadow', () => {
    const { toJSON } = render(
      <Surface elevation={3}>
        <Text>Elevated</Text>
      </Surface>,
    );
    const tree = toJSON();
    // elevation 3 maps to shadows.medium (elev <= 4)
    // Style is an array [shadowContainerStyle, style] — flatten to inspect
    const flatStyle = StyleSheet.flatten(
      (tree as { props: Record<string, unknown> }).props.style,
    );
    expect(flatStyle).toEqual(
      expect.objectContaining({
        shadowOpacity: shadows.medium.shadowOpacity,
        shadowRadius: shadows.medium.shadowRadius,
      }),
    );
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Surface onPress={onPress}>
        <Text>Pressable Surface</Text>
      </Surface>,
    );
    fireEvent.press(getByText('Pressable Surface'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('accepts custom borderRadius', () => {
    const { toJSON } = render(
      <Surface borderRadius={16}>
        <Text>Rounded</Text>
      </Surface>,
    );
    const tree = toJSON();
    const flatStyle = StyleSheet.flatten(
      (tree as { props: Record<string, unknown> }).props.style,
    );
    expect(flatStyle).toEqual(expect.objectContaining({ borderRadius: 16 }));
  });
});
