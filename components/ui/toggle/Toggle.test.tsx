import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { Toggle } from './Toggle';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe('Toggle', () => {
  it('renders with accessibility role switch', () => {
    const { getByRole } = render(
      <Toggle value={false} onValueChange={jest.fn()} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    expect(getByRole('switch')).toBeTruthy();
  });

  it('shows checked accessibility state when value is true', () => {
    const { getByRole } = render(
      <Toggle value={true} onValueChange={jest.fn()} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const toggle = getByRole('switch');
    expect(toggle.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
  });

  it('calls onValueChange with toggled value on press', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Toggle value={true} onValueChange={onValueChange} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    fireEvent.press(getByRole('switch'));
    act(() => {
      jest.runAllTimers();
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it('disabled state prevents onValueChange from being called', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Toggle value={false} onValueChange={onValueChange} enabled={false} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    fireEvent.press(getByRole('switch'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('applies custom activeColor when value is true', () => {
    const customColor = '#FF5500';
    const { toJSON } = render(
      <Toggle
        value={true}
        onValueChange={jest.fn()}
        activeColor={customColor}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });
    // When value=true and animation completes, the track backgroundColor
    // is interpolated to the activeColor. The Animated.View serializes the
    // interpolated value as an rgba string.
    const json = JSON.stringify(toJSON());
    // The custom color #FF5500 = rgb(255, 85, 0) should appear in the
    // serialized output as part of the interpolated value
    expect(json).toMatch(/rgba?\(255,\s*85,\s*0/);
  });
});
