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

  it('renders with visible=false (Dimmer hides content)', () => {
    const { queryByText } = render(<Modal {...defaultProps} visible={false} />);
    // RN Modal with visible=false does not render children
    expect(queryByText('Confirm Action')).toBeNull();
  });

  it('transitions from visible to not visible', () => {
    const { rerender, getByText, queryByText } = render(
      <Modal {...defaultProps} visible={true} />,
    );
    expect(getByText('Confirm Action')).toBeTruthy();

    rerender(<Modal {...defaultProps} visible={false} />);
    // After rerender with visible=false, content hidden by RN Modal
    expect(queryByText('Confirm Action')).toBeNull();
  });

  it('renders icon with default iconVariant', () => {
    const { getByText } = render(<Modal {...defaultProps} icon={<></>} />);
    expect(getByText('Confirm Action')).toBeTruthy();
  });

  it.each(['success', 'danger', 'warning', 'info', 'normal'] as const)(
    'renders icon with iconVariant=%s',
    (variant) => {
      const { getByText } = render(
        <Modal {...defaultProps} icon={<></>} iconVariant={variant} />,
      );
      expect(getByText('Confirm Action')).toBeTruthy();
    },
  );

  it('renders illustration when provided', () => {
    const { getByText } = render(
      <Modal {...defaultProps} illustration={<></>} />,
    );
    expect(getByText('Confirm Action')).toBeTruthy();
  });

  it('renders messageTertiary when provided', () => {
    const { getByText } = render(
      <Modal {...defaultProps} messageTertiary="Warning details" />,
    );
    expect(getByText('Warning details')).toBeTruthy();
  });

  it('renders without onDismiss (uses default noop)', () => {
    const { getByText } = render(<Modal {...defaultProps} />);
    expect(getByText('Confirm Action')).toBeTruthy();
  });

  it('renders with custom titleMaxLines and messageMaxLines', () => {
    const { getByText } = render(
      <Modal {...defaultProps} titleMaxLines={1} messageMaxLines={2} />,
    );
    expect(getByText('Confirm Action')).toBeTruthy();
  });

  it('renders with button variants', () => {
    const { getByText } = render(
      <Modal
        {...defaultProps}
        primaryButton={{ text: 'Delete', onTap: jest.fn(), variant: 'error' }}
        secondaryButton={{
          text: 'Cancel',
          onTap: jest.fn(),
          variant: 'normal',
        }}
      />,
    );
    expect(getByText('Delete')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });
});
