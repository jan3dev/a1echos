import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { Button } from './Button';

describe('Button', () => {
  it.each([
    ['primary'],
    ['secondary'],
    ['tertiary'],
    ['utility'],
    ['utilitySecondary'],
  ] as const)('Button.%s renders with text', (variant) => {
    const Component = Button[variant];
    const { getByText } = render(
      <Component text={`${variant} Action`} onPress={jest.fn()} />,
    );
    expect(getByText(`${variant} Action`)).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <Button.primary text="Press Me" onPress={onPress} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows loading indicator when isLoading=true', () => {
    const { getByLabelText, queryByText } = render(
      <Button.primary text="Submit" onPress={jest.fn()} isLoading={true} />,
    );
    // ProgressIndicator renders with accessibilityLabel="Loading"
    expect(getByLabelText('Loading')).toBeTruthy();
    // Button text should not be rendered when loading
    expect(queryByText('Submit')).toBeNull();
  });
});
