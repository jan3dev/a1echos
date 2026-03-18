import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders with default dimensions (width 100%, height 20)', () => {
    const { toJSON } = render(<Skeleton />);
    const tree = toJSON();
    const flatStyle = StyleSheet.flatten(
      (tree as { props: Record<string, unknown> }).props.style,
    );
    expect(flatStyle).toEqual(
      expect.objectContaining({ width: '100%', height: 20 }),
    );
  });

  it('accepts custom width and height', () => {
    const { toJSON } = render(<Skeleton width={200} height={40} />);
    const tree = toJSON();
    const flatStyle = StyleSheet.flatten(
      (tree as { props: Record<string, unknown> }).props.style,
    );
    expect(flatStyle).toEqual(
      expect.objectContaining({ width: 200, height: 40 }),
    );
  });

  it('applies custom borderRadius', () => {
    const { toJSON } = render(<Skeleton borderRadius={12} />);
    const tree = toJSON();
    const flatStyle = StyleSheet.flatten(
      (tree as { props: Record<string, unknown> }).props.style,
    );
    expect(flatStyle).toEqual(expect.objectContaining({ borderRadius: 12 }));
  });

  it('applies custom style', () => {
    const { toJSON } = render(<Skeleton style={{ marginTop: 16 }} />);
    const tree = toJSON();
    const flatStyle = StyleSheet.flatten(
      (tree as { props: Record<string, unknown> }).props.style,
    );
    expect(flatStyle).toEqual(expect.objectContaining({ marginTop: 16 }));
  });
});
