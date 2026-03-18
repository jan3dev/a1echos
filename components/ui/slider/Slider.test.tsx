/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from '@testing-library/react-native';
import React from 'react';

import { Slider } from './Slider';

// Mock Icon to expose the icon name in the rendered tree
jest.mock('../icon/Icon', () => ({
  Icon: ({ name, ...rest }: { name: string; [key: string]: unknown }) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...rest} />;
  },
}));

// Mock ProgressIndicator to be identifiable in the tree
jest.mock('../progress/ProgressIndicator', () => ({
  ProgressIndicator: (props: Record<string, unknown>) => {
    const { View } = require('react-native');
    return <View testID="progress-indicator" {...props} />;
  },
}));

describe('Slider', () => {
  const defaultProps = {
    width: 300,
    onConfirm: jest.fn(),
  };

  it.each([
    ['initial', 'icon-arrow_right'],
    ['inProgress', 'progress-indicator'],
    ['completed', 'icon-check'],
    ['error', 'icon-close'],
  ] as const)(
    'renders %s state with correct indicator',
    (sliderState, expectedTestId) => {
      const { getByTestId } = render(
        <Slider {...defaultProps} sliderState={sliderState} />,
      );
      expect(getByTestId(expectedTestId)).toBeTruthy();
    },
  );

  it('renders disabled state with reduced opacity', () => {
    const { toJSON } = render(
      <Slider {...defaultProps} enabled={false} sliderState="initial" />,
    );
    const json = JSON.stringify(toJSON());
    // When disabled, the thumb View has opacity: 0.5
    expect(json).toContain('"opacity":0.5');
  });
});
