/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { ErrorView } from './ErrorView';

jest.mock('../../ui/icon/Icon', () => ({
  Icon: ({ name, ...rest }: { name: string; [key: string]: unknown }) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...rest} />;
  },
}));

describe('ErrorView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders error message text', () => {
    const { getByText } = render(
      <ErrorView errorMessage="Something went wrong" />,
    );
    expect(getByText(/Something went wrong/)).toBeTruthy();
  });

  it('renders warning icon', () => {
    const { getByTestId } = render(<ErrorView errorMessage="Error" />);
    expect(getByTestId('icon-warning')).toBeTruthy();
  });

  it('renders retry button when onRetry is provided', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <ErrorView errorMessage="Error" onRetry={onRetry} />,
    );
    const retryButton = getByText('retry');
    expect(retryButton).toBeTruthy();
    fireEvent.press(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is undefined', () => {
    const { queryByText } = render(<ErrorView errorMessage="Error" />);
    expect(queryByText('retry')).toBeNull();
  });
});
