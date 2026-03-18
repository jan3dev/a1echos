import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';

import { ListItem } from './ListItem';

const defaultProps = {
  title: 'Session Title',
};

describe('ListItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title text', () => {
    const { getByText } = render(<ListItem {...defaultProps} />);
    expect(getByText('Session Title')).toBeTruthy();
  });

  it('renders subtitle text', () => {
    const { getByText } = render(
      <ListItem {...defaultProps} subtitle="Session subtitle" />,
    );
    expect(getByText('Session subtitle')).toBeTruthy();
  });

  it('onPress fires callback', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <ListItem {...defaultProps} onPress={onPress} />,
    );
    fireEvent.press(getByLabelText('Session Title'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('onLongPress fires callback', () => {
    const onLongPress = jest.fn();
    const { getByLabelText } = render(
      <ListItem {...defaultProps} onLongPress={onLongPress} />,
    );
    fireEvent(getByLabelText('Session Title'), 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('renders leading icon element', () => {
    const { getByTestId } = render(
      <ListItem
        {...defaultProps}
        iconLeading={<View testID="leading-icon" />}
      />,
    );
    expect(getByTestId('leading-icon')).toBeTruthy();
  });

  it('renders trailing icon element', () => {
    const { getByTestId } = render(
      <ListItem
        {...defaultProps}
        iconTrailing={<View testID="trailing-icon" />}
      />,
    );
    expect(getByTestId('trailing-icon')).toBeTruthy();
  });

  it('selection state applies selected accessibility state', () => {
    const { getByLabelText } = render(
      <ListItem {...defaultProps} selected={true} onPress={jest.fn()} />,
    );
    const button = getByLabelText('Session Title');
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });
});
