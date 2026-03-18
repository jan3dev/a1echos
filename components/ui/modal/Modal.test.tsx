import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { Modal } from './Modal';

const defaultProps = {
  visible: true,
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed?',
  primaryButton: {
    text: 'Confirm',
    onTap: jest.fn(),
  },
};

describe('Modal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and message when visible', () => {
    const { getByText } = render(<Modal {...defaultProps} />);
    expect(getByText('Confirm Action')).toBeTruthy();
    expect(getByText('Are you sure you want to proceed?')).toBeTruthy();
  });

  it('renders primary button with text', () => {
    const { getByText } = render(<Modal {...defaultProps} />);
    expect(getByText('Confirm')).toBeTruthy();
  });

  it('renders secondary button when provided', () => {
    const secondaryButton = {
      text: 'Cancel',
      onTap: jest.fn(),
    };
    const { getByText } = render(
      <Modal {...defaultProps} secondaryButton={secondaryButton} />,
    );
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('calls primaryButton.onTap when pressed', () => {
    const onTap = jest.fn();
    const props = {
      ...defaultProps,
      primaryButton: { text: 'Confirm', onTap },
    };
    const { getByText } = render(<Modal {...props} />);
    // The primary button text is inside a Button.primary which wraps
    // a RipplePressable. On iOS (default test platform), RipplePressable
    // renders as a Pressable, so fireEvent.press on the text should bubble up.
    fireEvent.press(getByText('Confirm'));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('calls secondaryButton.onTap when pressed', () => {
    const onTap = jest.fn();
    const secondaryButton = { text: 'Cancel', onTap };
    const { getByText } = render(
      <Modal {...defaultProps} secondaryButton={secondaryButton} />,
    );
    fireEvent.press(getByText('Cancel'));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when dismiss triggered', () => {
    const onDismiss = jest.fn();
    const { UNSAFE_root } = render(
      <Modal {...defaultProps} onDismiss={onDismiss} />,
    );
    // The Modal uses Dimmer which wraps a RN Modal with onRequestClose.
    // The Dimmer also wraps content in a Pressable that calls onDismiss.
    // Find the outermost Pressable inside the RN Modal (the backdrop).
    const tree = UNSAFE_root;
    // The Dimmer has a Pressable with onPress=onDismiss as the backdrop.
    // We can trigger onRequestClose on the RN Modal to simulate Android back press.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rnModal = tree.findByType(require('react-native').Modal);
    // Trigger onRequestClose which calls onDismiss
    if (rnModal.props.onRequestClose) {
      rnModal.props.onRequestClose();
    }
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
