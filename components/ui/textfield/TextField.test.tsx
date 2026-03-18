/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { lightColors } from '@/theme/themeColors';

import { TextField } from './TextField';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe('TextField', () => {
  it('renders with label text', () => {
    const { getByText } = render(<TextField label="Email" />);
    act(() => {
      jest.runAllTimers();
    });
    expect(getByText('Email')).toBeTruthy();
  });

  it('calls onChangeText after debounce delay', () => {
    const onChangeText = jest.fn();
    const { getByDisplayValue } = render(
      <TextField
        label="Search"
        value=""
        onChangeText={onChangeText}
        accessibilityLabel="Search"
      />,
    );

    const input = getByDisplayValue('');
    fireEvent.changeText(input, 'hello');

    // Should not have been called yet (before debounce)
    expect(onChangeText).not.toHaveBeenCalled();

    // Advance past the 500ms default debounce
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onChangeText).toHaveBeenCalledTimes(1);
    expect(onChangeText).toHaveBeenCalledWith('hello');
  });

  it('shows clear icon when showClearIcon=true and has text', () => {
    const { toJSON } = render(
      <TextField label="Name" value="John" showClearIcon={true} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    // The clear icon renders an Icon with name="close" inside a clearIconBackground View.
    // With the svg mock, the icon map entry renders as <svg>. Verify the clear icon
    // container is present by checking the JSON tree contains the close icon structure.
    const json = JSON.stringify(toJSON());
    // The clear icon background has borderRadius: 9 (unique to the clear button circle)
    expect(json).toContain('"borderRadius":9');
  });

  it('calls onClear when clear icon pressed', () => {
    const onClear = jest.fn();
    const onChangeText = jest.fn();
    const View = require('react-native').View;
    const { UNSAFE_root } = render(
      <TextField
        label="Name"
        value="John"
        showClearIcon={true}
        onClear={onClear}
        onChangeText={onChangeText}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });

    // Find the clear icon container by its unique borderRadius: 9
    const allViews = UNSAFE_root.findAllByType(View);
    const clearIconBg = allViews.find((v: any) => {
      const style = (v as { props: { style?: StyleProp<ViewStyle> } }).props
        .style;
      if (!style) return false;
      const flatStyle = StyleSheet.flatten(style);
      return flatStyle.borderRadius === 9;
    });

    expect(clearIconBg).toBeTruthy();

    // Navigate up from the clearIconBg to find the ancestor with onPress.
    let node = clearIconBg!.parent;
    while (node) {
      if (node.props?.onPress) break;
      node = node.parent;
    }
    expect(node).toBeTruthy();
    fireEvent.press(node!);

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('shows character counter when showCounter=true and maxLength set', () => {
    const { getByText } = render(
      <TextField
        label="Bio"
        value="Hello"
        showCounter={true}
        maxLength={100}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });
    expect(getByText('5/100')).toBeTruthy();
  });

  it('applies error border color when error=true', () => {
    const { toJSON } = render(
      <TextField label="Email" value="" error={true} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // The error border color is accentDanger from lightColors
    expect(json).toContain(lightColors.accentDanger);
  });

  it('disabled state reduces opacity and prevents input', () => {
    const { toJSON, getByDisplayValue } = render(
      <TextField label="Name" value="test" enabled={false} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    // The wrapper View has opacity: 0.5 when disabled
    const tree = toJSON()!;
    // The outermost wrapper has opacity in its style
    const wrapperStyle = JSON.stringify(
      (tree as { props: Record<string, unknown> }).props.style,
    );
    expect(wrapperStyle).toContain('"opacity":0.5');

    // The TextInput should have editable=false
    const input = getByDisplayValue('test');
    expect(input.props.editable).toBe(false);
  });
});
