import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';

import { ProgressIndicator } from './ProgressIndicator';

interface JsonTree {
  props: { style?: ViewStyle; [k: string]: unknown };
  children: JsonTree[] | null;
}

describe('ProgressIndicator', () => {
  it('renders with accessibility role progressbar', () => {
    const { toJSON } = render(<ProgressIndicator />);
    const tree = toJSON() as unknown as JsonTree;
    expect(tree.props.accessibilityRole).toBe('progressbar');
  });

  it('renders with accessibility label "Loading"', () => {
    const { getByLabelText } = render(<ProgressIndicator />);
    expect(getByLabelText('Loading')).toBeTruthy();
  });

  it('accepts custom color prop', () => {
    const { toJSON } = render(<ProgressIndicator color="#FF0000" />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('#FF0000');
  });

  it('accepts custom size prop (default is 24)', () => {
    const { toJSON } = render(<ProgressIndicator size={48} />);
    const tree = toJSON() as unknown as JsonTree;
    const iconContainer = tree.children![0];
    const flatStyle = StyleSheet.flatten(iconContainer.props.style);
    expect(flatStyle?.width).toBe(48);
    expect(flatStyle?.height).toBe(48);
  });
});
