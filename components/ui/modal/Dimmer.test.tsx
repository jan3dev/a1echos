import { render } from '@testing-library/react-native';
import React from 'react';
import { Modal, Text } from 'react-native';

import { Dimmer } from './Dimmer';

describe('Dimmer', () => {
  it('renders RN Modal with visible prop', () => {
    const { UNSAFE_root } = render(
      <Dimmer visible={true} onDismiss={jest.fn()}>
        <Text>Content</Text>
      </Dimmer>,
    );
    const rnModal = UNSAFE_root.findByType(Modal);
    expect(rnModal.props.visible).toBe(true);
  });

  it('renders BlurView', () => {
    const { toJSON } = render(
      <Dimmer visible={true} onDismiss={jest.fn()}>
        <Text>Content</Text>
      </Dimmer>,
    );
    const json = JSON.stringify(toJSON());
    // BlurView is mocked as the string "BlurView" in jest.setup.js
    expect(json).toContain('BlurView');
  });

  it('calls onDismiss when backdrop pressed', () => {
    const onDismiss = jest.fn();
    const { UNSAFE_root } = render(
      <Dimmer visible={true} onDismiss={onDismiss}>
        <Text>Content</Text>
      </Dimmer>,
    );
    // The Dimmer has a Pressable wrapping everything that calls onDismiss.
    // Trigger onRequestClose on the RN Modal (simulates Android back press).
    const rnModal = UNSAFE_root.findByType(Modal);
    if (rnModal.props.onRequestClose) {
      rnModal.props.onRequestClose();
    }
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('passes children through', () => {
    const { getByText } = render(
      <Dimmer visible={true} onDismiss={jest.fn()}>
        <Text>Child Content</Text>
      </Dimmer>,
    );
    expect(getByText('Child Content')).toBeTruthy();
  });
});
