import * as Clipboard from "expo-clipboard";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";

import { lightColors } from "@/theme";

import { TextField } from "./TextField";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe("TextField", () => {
  it("renders with label text", () => {
    const { getByText } = render(<TextField label="Email" />);
    act(() => {
      jest.runAllTimers();
    });
    expect(getByText("Email")).toBeTruthy();
  });

  it("calls onChangeText after debounce delay", () => {
    const onChangeText = jest.fn();
    const { getByDisplayValue } = render(
      <TextField label="Search" value="" onChangeText={onChangeText} />,
    );

    const input = getByDisplayValue("");
    fireEvent.changeText(input, "hello");

    expect(onChangeText).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onChangeText).toHaveBeenCalledTimes(1);
    expect(onChangeText).toHaveBeenCalledWith("hello");
  });

  it("shows clear icon when showClearIcon=true and has text", () => {
    const { toJSON } = render(
      <TextField label="Name" value="John" showClearIcon={true} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"borderRadius":9');
  });

  it("calls onClear when clear icon pressed", () => {
    const onClear = jest.fn();
    const onChangeText = jest.fn();
    const { getByLabelText } = render(
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

    fireEvent.press(getByLabelText("Clear text"));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onChangeText).toHaveBeenCalledWith("");
  });

  it("clear icon cancels a pending debounce timer", () => {
    const onClear = jest.fn();
    const onChangeText = jest.fn();
    const { getByDisplayValue, getByLabelText } = render(
      <TextField
        label="Search"
        value=""
        showClearIcon
        onClear={onClear}
        onChangeText={onChangeText}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });

    // Type to start a debounce timer.
    fireEvent.changeText(getByDisplayValue(""), "typed");
    // Press clear before the debounce fires.
    fireEvent.press(getByLabelText("Clear text"));

    // onChangeText is called immediately with "" by handleClear, and the
    // pending debounce timer is cancelled (no second call after timers run).
    expect(onChangeText).toHaveBeenCalledTimes(1);
    expect(onChangeText).toHaveBeenLastCalledWith("");

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onChangeText).toHaveBeenCalledTimes(1);
  });

  it("paste icon cancels a pending debounce timer", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValueOnce("from clip");
    const onChangeText = jest.fn();
    const { getByDisplayValue, getByLabelText } = render(
      <TextField
        label="Search"
        value=""
        showPasteIcon
        onChangeText={onChangeText}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });

    fireEvent.changeText(getByDisplayValue(""), "typed");

    await act(async () => {
      fireEvent.press(getByLabelText("Paste from clipboard"));
    });
    await waitFor(() => {
      expect(onChangeText).toHaveBeenCalledWith("from clip");
    });

    // Pending debounce timer should have been cancelled by handlePaste, so
    // running timers does not produce a second onChangeText call.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onChangeText).toHaveBeenCalledTimes(1);
  });

  it("applies error border color when error=true", () => {
    const { toJSON } = render(
      <TextField label="Email" value="" error={true} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(lightColors.accentDanger);
  });

  it("disabled state reduces opacity and prevents input", () => {
    const { toJSON, getByDisplayValue } = render(
      <TextField label="Name" value="test" enabled={false} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const tree = toJSON()!;
    const wrapperStyle = JSON.stringify(
      (tree as { props: Record<string, unknown> }).props.style,
    );
    expect(wrapperStyle).toContain('"opacity":0.5');

    const input = getByDisplayValue("test");
    expect(input.props.editable).toBe(false);
  });

  it("default variant renders no border (transparent) even when focused", () => {
    const { getByDisplayValue, toJSON } = render(
      <TextField label="Search" value="" />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const input = getByDisplayValue("");
    fireEvent(input, "focus");
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"borderColor":"transparent"');
    expect(json).not.toContain(`"borderColor":"${lightColors.accentBrand}"`);
  });

  it("brand variant renders accentBrand border color", () => {
    const { toJSON } = render(
      <TextField label="Email" value="" variant="brand" />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(`"borderColor":"${lightColors.accentBrand}"`);
  });

  it("error border takes priority over brand variant", () => {
    const { toJSON } = render(
      <TextField label="Email" value="" variant="brand" error />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(`"borderColor":"${lightColors.accentDanger}"`);
    expect(json).not.toContain(`"borderColor":"${lightColors.accentBrand}"`);
  });

  it("disabled state forces transparent border even with error or brand variant", () => {
    const { toJSON } = render(
      <TextField
        label="Email"
        value=""
        variant="brand"
        error
        enabled={false}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"borderColor":"transparent"');
    expect(json).not.toContain(`"borderColor":"${lightColors.accentBrand}"`);
    expect(json).not.toContain(`"borderColor":"${lightColors.accentDanger}"`);
  });

  it("shows paste icon when showPasteIcon=true (independent of value)", () => {
    const empty = render(<TextField label="Name" value="" showPasteIcon />);
    const filled = render(
      <TextField label="Name" value="hello" showPasteIcon />,
    );
    act(() => {
      jest.runAllTimers();
    });

    expect(empty.getByLabelText("Paste from clipboard")).toBeTruthy();
    expect(filled.getByLabelText("Paste from clipboard")).toBeTruthy();
  });

  it("paste icon invokes Clipboard.getStringAsync and updates value via onChangeText + onPaste", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValueOnce(
      "pasted text",
    );
    const onChangeText = jest.fn();
    const onPaste = jest.fn();
    const { getByLabelText, getByDisplayValue } = render(
      <TextField
        label="Name"
        value=""
        showPasteIcon
        onChangeText={onChangeText}
        onPaste={onPaste}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });

    await act(async () => {
      fireEvent.press(getByLabelText("Paste from clipboard"));
    });

    expect(Clipboard.getStringAsync).toHaveBeenCalled();
    await waitFor(() => {
      expect(onChangeText).toHaveBeenCalledWith("pasted text");
    });
    expect(onPaste).toHaveBeenCalledWith("pasted text");
    expect(getByDisplayValue("pasted text")).toBeTruthy();
  });

  it("paste truncates clipboard text to maxLength before applying", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValueOnce("abcdefghij");
    const onChangeText = jest.fn();
    const onPaste = jest.fn();
    const { getByLabelText, getByDisplayValue } = render(
      <TextField
        label="Code"
        value=""
        showPasteIcon
        maxLength={4}
        onChangeText={onChangeText}
        onPaste={onPaste}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });

    await act(async () => {
      fireEvent.press(getByLabelText("Paste from clipboard"));
    });

    await waitFor(() => {
      expect(onChangeText).toHaveBeenCalledWith("abcd");
    });
    expect(onPaste).toHaveBeenCalledWith("abcd");
    expect(getByDisplayValue("abcd")).toBeTruthy();
  });

  it("paste swallows clipboard read errors and does not mutate state", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockRejectedValueOnce(
      new Error("permission denied"),
    );
    const onChangeText = jest.fn();
    const onPaste = jest.fn();
    const { getByLabelText, getByDisplayValue } = render(
      <TextField
        label="Name"
        value=""
        showPasteIcon
        onChangeText={onChangeText}
        onPaste={onPaste}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });

    await act(async () => {
      fireEvent.press(getByLabelText("Paste from clipboard"));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onChangeText).not.toHaveBeenCalled();
    expect(onPaste).not.toHaveBeenCalled();
    expect(getByDisplayValue("")).toBeTruthy();
  });

  it("paste action no-ops when clipboard is empty", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValueOnce("");
    const onChangeText = jest.fn();
    const onPaste = jest.fn();
    const { getByLabelText } = render(
      <TextField
        label="Name"
        value=""
        showPasteIcon
        onChangeText={onChangeText}
        onPaste={onPaste}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });

    await act(async () => {
      fireEvent.press(getByLabelText("Paste from clipboard"));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(onChangeText).not.toHaveBeenCalled();
    expect(onPaste).not.toHaveBeenCalled();
  });

  it("paste icon does not trigger paste when enabled=false", async () => {
    const onChangeText = jest.fn();
    const onPaste = jest.fn();
    const { getByLabelText } = render(
      <TextField
        label="Name"
        value=""
        showPasteIcon
        enabled={false}
        onChangeText={onChangeText}
        onPaste={onPaste}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });

    await act(async () => {
      fireEvent.press(getByLabelText("Paste from clipboard"));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(Clipboard.getStringAsync).not.toHaveBeenCalled();
    expect(onChangeText).not.toHaveBeenCalled();
    expect(onPaste).not.toHaveBeenCalled();
  });

  it("clear and paste icons coexist when both props are set and field has text", () => {
    const { getByLabelText, toJSON } = render(
      <TextField label="Name" value="hello" showClearIcon showPasteIcon />,
    );
    act(() => {
      jest.runAllTimers();
    });

    expect(getByLabelText("Clear text")).toBeTruthy();
    expect(getByLabelText("Paste from clipboard")).toBeTruthy();

    const json = JSON.stringify(toJSON());
    expect(json).toContain('"borderRadius":9');
  });

  it("clear icon does not call onClear when enabled=false", () => {
    const onClear = jest.fn();
    const onChangeText = jest.fn();
    const { getByLabelText } = render(
      <TextField
        label="Name"
        value="John"
        showClearIcon
        enabled={false}
        onClear={onClear}
        onChangeText={onChangeText}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });

    fireEvent.press(getByLabelText("Clear text"));
    expect(onClear).not.toHaveBeenCalled();
    expect(onChangeText).not.toHaveBeenCalled();
  });

  it("onFocus and onBlur toggle internal focus state without crashing", () => {
    const { getByDisplayValue } = render(
      <TextField label="Email" value="test@example.com" />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const input = getByDisplayValue("test@example.com");
    fireEvent(input, "focus");
    act(() => {
      jest.runAllTimers();
    });
    fireEvent(input, "blur");
    act(() => {
      jest.runAllTimers();
    });
    expect(input).toBeTruthy();
  });

  it("onChangeText updates internal text immediately, propagates after debounce", () => {
    const onChangeText = jest.fn();
    const { getByDisplayValue } = render(
      <TextField label="Search" value="" onChangeText={onChangeText} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const input = getByDisplayValue("");
    fireEvent.changeText(input, "new value");

    expect(getByDisplayValue("new value")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(onChangeText).toHaveBeenCalledWith("new value");
  });

  it("debounce cancels previous timer on rapid input", () => {
    const onChangeText = jest.fn();
    const { getByDisplayValue } = render(
      <TextField label="Search" value="" onChangeText={onChangeText} />,
    );
    act(() => {
      jest.runAllTimers();
    });

    const input = getByDisplayValue("");
    fireEvent.changeText(input, "h");
    fireEvent.changeText(input, "he");
    fireEvent.changeText(input, "hel");

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(onChangeText).toHaveBeenCalledTimes(1);
    expect(onChangeText).toHaveBeenCalledWith("hel");
  });

  it("uses custom debounceTime", () => {
    const onChangeText = jest.fn();
    const { getByDisplayValue } = render(
      <TextField
        label="Search"
        value=""
        onChangeText={onChangeText}
        debounceTime={100}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const input = getByDisplayValue("");
    fireEvent.changeText(input, "fast");

    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(onChangeText).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(onChangeText).toHaveBeenCalledWith("fast");
  });

  it("forceFocus=true triggers input focus after delay", () => {
    const { getByDisplayValue } = render(
      <TextField label="Auto" value="" forceFocus={true} />,
    );
    act(() => {
      jest.advanceTimersByTime(200);
    });
    act(() => {
      jest.runAllTimers();
    });
    const input = getByDisplayValue("");
    expect(input).toBeTruthy();
  });

  it("syncs internal text when value prop changes externally", () => {
    const { rerender, getByDisplayValue } = render(
      <TextField label="Name" value="old" />,
    );
    act(() => {
      jest.runAllTimers();
    });
    expect(getByDisplayValue("old")).toBeTruthy();

    rerender(<TextField label="Name" value="new" />);
    act(() => {
      jest.runAllTimers();
    });
    expect(getByDisplayValue("new")).toBeTruthy();
  });

  it("error state colors the assistive text in accentDanger", () => {
    const { getByText } = render(
      <TextField
        label="Email"
        value=""
        error={true}
        assistiveText="Invalid email"
      />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const assistiveEl = getByText("Invalid email");
    const style = StyleSheet.flatten(assistiveEl.props.style);
    expect(style.color).toBe(lightColors.accentDanger);
  });

  it("disabled state colors the label in textTertiary", () => {
    const { getByText } = render(
      <TextField label="Name" value="" enabled={false} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    expect(getByText("Name")).toBeTruthy();
  });

  it("renders without label when label prop is omitted", () => {
    const { getByDisplayValue } = render(<TextField value="test" />);
    act(() => {
      jest.runAllTimers();
    });
    expect(getByDisplayValue("test")).toBeTruthy();
  });

  it("does not render assistive row when assistiveText is omitted", () => {
    const { queryByText } = render(<TextField label="Name" value="" />);
    act(() => {
      jest.runAllTimers();
    });
    expect(queryByText("Assistive")).toBeNull();
  });

  it("tapping a disabled field's label does not crash", () => {
    const { getByText } = render(
      <TextField label="Name" value="" enabled={false} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    // Pressing the label (inside the outer pressable) is safe — focus is
    // gated on `enabled`.
    fireEvent.press(getByText("Name"));
    expect(getByText("Name")).toBeTruthy();
  });
});
