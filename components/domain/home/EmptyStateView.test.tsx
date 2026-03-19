import { render } from '@testing-library/react-native';
import React from 'react';

import { EmptyStateView } from './EmptyStateView';

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: jest.fn((fn) => fn()),
}));

jest.mock('../../ui/tooltip/Tooltip', () => ({
  Tooltip: (props: any) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View, Text } = require('react-native');
    return (
      <View testID="tooltip">
        <Text>{props.message}</Text>
      </View>
    );
  },
}));

describe('EmptyStateView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders message text via Tooltip', () => {
    const { getByText } = render(
      <EmptyStateView message="Tap to record" shouldDisappear={false} />,
    );
    expect(getByText('Tap to record')).toBeTruthy();
  });

  it('renders without crashing when shouldDisappear=false', () => {
    const { getByTestId } = render(
      <EmptyStateView message="Hello" shouldDisappear={false} />,
    );
    expect(getByTestId('tooltip')).toBeTruthy();
  });

  it('renders without crashing when shouldDisappear=true', () => {
    const { getByTestId } = render(
      <EmptyStateView message="Hello" shouldDisappear={true} />,
    );
    expect(getByTestId('tooltip')).toBeTruthy();
  });
});
