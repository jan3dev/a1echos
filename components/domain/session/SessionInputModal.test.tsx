/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { SessionInputModal } from './SessionInputModal';

jest.mock('../../ui/modal/Dimmer', () => ({
  Dimmer: ({ children, visible }: any) => {
    const { View } = require('react-native');
    return visible ? <View testID="dimmer">{children}</View> : null;
  },
}));

jest.mock('../../ui/textfield/TextField', () => ({
  TextField: (props: any) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput
        testID="text-field"
        value={props.value}
        onChangeText={props.onChangeText}
        maxLength={props.maxLength}
      />
    );
  },
}));

jest.mock('../../ui/button/Button', () => ({
  Button: {
    primary: (props: any) => {
      const { Pressable, Text } = require('react-native');
      return (
        <Pressable testID="primary-button" onPress={props.onPress}>
          <Text>{props.text}</Text>
        </Pressable>
      );
    },
  },
}));

jest.mock('../../ui/icon/Icon', () => ({
  Icon: (props: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${props.name}`} />;
  },
}));

const defaultProps = {
  visible: true,
  title: 'Rename Session',
  buttonText: 'Save',
  initialValue: '',
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

describe('SessionInputModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title text', () => {
    const { getByText } = render(<SessionInputModal {...defaultProps} />);
    expect(getByText('Rename Session')).toBeTruthy();
  });

  it('renders primary button with buttonText', () => {
    const { getByText } = render(<SessionInputModal {...defaultProps} />);
    expect(getByText('Save')).toBeTruthy();
  });

  it('submit calls onSubmit with trimmed text', () => {
    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} initialValue="Hello" />,
    );
    const textField = getByTestId('text-field');
    fireEvent.changeText(textField, '  New Name  ');
    fireEvent.press(getByTestId('primary-button'));
    expect(defaultProps.onSubmit).toHaveBeenCalledWith('New Name');
  });

  it('close button calls onCancel', () => {
    const { getByTestId } = render(<SessionInputModal {...defaultProps} />);
    const closeIcon = getByTestId('icon-close');
    fireEvent.press(closeIcon.parent!);
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('validates max length', () => {
    const { getByTestId } = render(<SessionInputModal {...defaultProps} />);
    const textField = getByTestId('text-field');
    expect(textField.props.maxLength).toBe(30);
  });
});
