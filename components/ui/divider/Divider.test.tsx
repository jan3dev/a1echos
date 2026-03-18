import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { lightColors } from '@/theme/themeColors';

import { Divider } from './Divider';

describe('Divider', () => {
  it('renders with default height of 1', () => {
    const { getByTestId } = render(<Divider testID="divider" />);
    const divider = getByTestId('divider');
    const flatStyle = StyleSheet.flatten(divider.props.style);
    expect(flatStyle.height).toBe(1);
  });

  it('applies default theme border color', () => {
    const { getByTestId } = render(<Divider testID="divider" />);
    const divider = getByTestId('divider');
    const flatStyle = StyleSheet.flatten(divider.props.style);
    expect(flatStyle.backgroundColor).toBe(lightColors.surfaceBorderPrimary);
  });

  it('accepts custom height prop', () => {
    const { getByTestId } = render(<Divider testID="divider" height={4} />);
    const divider = getByTestId('divider');
    const flatStyle = StyleSheet.flatten(divider.props.style);
    expect(flatStyle.height).toBe(4);
  });

  it('accepts custom color prop', () => {
    const { getByTestId } = render(
      <Divider testID="divider" color="#FF0000" />,
    );
    const divider = getByTestId('divider');
    const flatStyle = StyleSheet.flatten(divider.props.style);
    expect(flatStyle.backgroundColor).toBe('#FF0000');
  });
});
