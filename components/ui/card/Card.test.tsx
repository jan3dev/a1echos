import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text, type ViewStyle } from 'react-native';

import { Card } from './Card';

/** Lightweight shape for toJSON() nodes — avoids importing deprecated react-test-renderer types. */
interface JsonTree {
  props: { style?: ViewStyle; [k: string]: unknown };
  children: JsonTree[] | null;
}

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = render(
      <Card>
        <Text>Card Content</Text>
      </Card>,
    );
    expect(getByText('Card Content')).toBeTruthy();
  });

  it('applies default borderRadius of 8', () => {
    const { toJSON } = render(
      <Card>
        <Text>Content</Text>
      </Card>,
    );
    const tree = toJSON() as unknown as JsonTree;
    const outerStyle = StyleSheet.flatten(tree.props.style);
    expect(outerStyle?.borderRadius).toBe(8);

    const innerStyle = StyleSheet.flatten(tree.children![0].props.style);
    expect(innerStyle?.borderRadius).toBe(8);
  });

  it('accepts custom backgroundColor', () => {
    const { toJSON } = render(
      <Card backgroundColor="#123456">
        <Text>Content</Text>
      </Card>,
    );
    const tree = toJSON() as unknown as JsonTree;
    const style = StyleSheet.flatten(tree.props.style);
    expect(style?.backgroundColor).toBe('#123456');
  });

  it('applies overflow hidden', () => {
    const { toJSON } = render(
      <Card>
        <Text>Content</Text>
      </Card>,
    );
    const tree = toJSON() as unknown as JsonTree;
    const innerStyle = StyleSheet.flatten(tree.children![0].props.style);
    expect(innerStyle?.overflow).toBe('hidden');
  });
});
