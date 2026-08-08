/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { OptionPickerScreen } from "./OptionPickerScreen";

// --- Mocks ---

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
}));

jest.mock("@/theme", () => ({
  useTheme: jest.fn(() => ({
    theme: { colors: { surfaceBackground: "#fff" } },
  })),
}));

jest.mock("@/hooks", () => ({
  useScrollSurface: jest.fn(() => ({
    scrolled: false,
    contentBelow: false,
    onScroll: jest.fn(),
    onContentSizeChange: jest.fn(),
    onLayout: jest.fn(),
  })),
}));

jest.mock("@/utils", () => ({
  delay: jest.fn(() => Promise.resolve()),
  logError: jest.fn(),
  FeatureFlag: { settings: "settings" },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("../list-item", () => {
  const { Text, TouchableOpacity } = require("react-native");
  const { dynamicTestID: dTID } = require("@/constants");
  return {
    ListItem: ({ title, subtitle, onPress, iconTrailing }: any) => (
      <TouchableOpacity testID={dTID.listItem(title)} onPress={onPress}>
        <Text>{String(title)}</Text>
        {subtitle != null && <Text>{String(subtitle)}</Text>}
        {iconTrailing}
      </TouchableOpacity>
    ),
  };
});

jest.mock("../screen", () => {
  const { View } = require("react-native");
  return { Screen: ({ children }: any) => <View>{children}</View> };
});

jest.mock("../../ui", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  const { TestID: TID, dynamicTestID: dTID } = require("@/constants");
  return {
    AppBarBlurTarget: ({ children }: any) => <View>{children}</View>,
    Radio: ({ value, groupValue, onValueChange }: any) => (
      <TouchableOpacity
        testID={dTID.radio(value)}
        onPress={() => onValueChange?.(value)}
      >
        <Text testID={dTID.radioSelected(value)}>
          {value === groupValue ? "selected" : "unselected"}
        </Text>
      </TouchableOpacity>
    ),
    TopAppBar: ({ title }: any) => (
      <View testID={TID.TopAppBar}>
        <Text>{String(title)}</Text>
      </View>
    ),
  };
});

const OPTIONS = [0, 60, 300, 1200, 3600] as const;

const renderPicker = (
  overrides: Partial<React.ComponentProps<typeof OptionPickerScreen>> = {},
) =>
  render(
    <OptionPickerScreen<number>
      title="Picker title"
      options={OPTIONS}
      selected={300}
      onSelect={mockOnSelect}
      labelFor={(v) => `option-${v}`}
      testIDPrefix="opt"
      errorMessage="Failed to save"
      {...(overrides as object)}
    />,
  );

const mockOnSelect = jest.fn();

describe("OptionPickerScreen", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockOnSelect.mockClear();
  });

  it("renders the TopAppBar with the given title", () => {
    const { getByTestId, getByText } = renderPicker();
    expect(getByTestId(TestID.TopAppBar)).toBeTruthy();
    expect(getByText("Picker title")).toBeTruthy();
  });

  it("renders one row per option, labelled via labelFor", () => {
    const { getByTestId, getByText } = renderPicker();
    for (const value of OPTIONS) {
      expect(getByTestId(`radio-${value}`)).toBeTruthy();
      expect(getByText(`option-${value}`)).toBeTruthy();
    }
  });

  // Pickers whose option names speak for themselves (theme, mic timeout) pass
  // no descriptionFor and must stay single-line.
  it("renders no subtitle when descriptionFor is omitted", () => {
    const { queryByText } = renderPicker();
    expect(queryByText(/^why-/)).toBeNull();
  });

  it("renders a subtitle per option when descriptionFor is given", () => {
    const { getByText } = renderPicker({
      descriptionFor: (v) => `why-${v}`,
    });
    for (const value of OPTIONS) {
      expect(getByText(`why-${value}`)).toBeTruthy();
    }
  });

  it("marks the current selection as selected", () => {
    const { getByTestId } = renderPicker();
    expect(getByTestId("radio-selected-300")).toHaveTextContent("selected");
    expect(getByTestId("radio-selected-60")).toHaveTextContent("unselected");
  });

  it("selecting the current value navigates back without saving", () => {
    const { getByTestId } = renderPicker();
    fireEvent.press(getByTestId("radio-300"));
    expect(mockBack).toHaveBeenCalled();
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it("selecting a different value saves it and navigates back", async () => {
    mockOnSelect.mockResolvedValue(undefined);
    const { getByTestId } = renderPicker();
    fireEvent.press(getByTestId("radio-1200"));
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith(1200);
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it("can select a falsy option value (0)", async () => {
    mockOnSelect.mockResolvedValue(undefined);
    const { getByTestId } = renderPicker();
    fireEvent.press(getByTestId("radio-0"));
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith(0);
    });
  });

  it("logs the given errorMessage when saving fails", async () => {
    const { logError } = require("@/utils");
    mockOnSelect.mockRejectedValue(new Error("save error"));
    const { getByTestId } = renderPicker();
    fireEvent.press(getByTestId("radio-3600"));
    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ message: "Failed to save" }),
      );
    });
  });

  it("restores the previous selection after a failed save", async () => {
    mockOnSelect.mockRejectedValue(new Error("save error"));
    const { getByTestId } = renderPicker();
    fireEvent.press(getByTestId("radio-3600"));
    await waitFor(() => {
      expect(getByTestId("radio-selected-300")).toHaveTextContent("selected");
    });
    expect(getByTestId("radio-selected-3600")).toHaveTextContent("unselected");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("ignores a second selection while saving", async () => {
    let resolveSet: () => void = () => {};
    mockOnSelect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSet = resolve;
        }),
    );
    const { getByTestId } = renderPicker();
    fireEvent.press(getByTestId("radio-60"));
    fireEvent.press(getByTestId("radio-1200"));
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith(60);
    });
    resolveSet();
  });

  it("shows the pending value as selected while saving", async () => {
    let resolveSet: () => void = () => {};
    mockOnSelect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSet = resolve;
        }),
    );
    const { getByTestId } = renderPicker();
    fireEvent.press(getByTestId("radio-3600"));
    await waitFor(() => {
      expect(getByTestId("radio-selected-3600")).toHaveTextContent("selected");
    });
    resolveSet();
    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it("supports string option values", async () => {
    mockOnSelect.mockResolvedValue(undefined);
    const { getByTestId } = render(
      <OptionPickerScreen<string>
        title="Theme"
        options={["light", "dark"]}
        selected="light"
        onSelect={mockOnSelect}
        labelFor={(v) => v}
        testIDPrefix="theme"
        errorMessage="Failed"
      />,
    );
    expect(getByTestId("radio-selected-light")).toHaveTextContent("selected");
    fireEvent.press(getByTestId("radio-dark"));
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith("dark");
    });
  });
  // The row itself is tappable, not just the radio — a separate callback on the
  // ListItem that would otherwise go unexercised.
  it("tapping the row (not the radio) selects the option", async () => {
    mockOnSelect.mockResolvedValue(undefined);
    const { getByTestId } = renderPicker();
    fireEvent.press(getByTestId("list-item-option-1200"));
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith(1200);
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it("ignores row taps while a save is in flight", async () => {
    let resolveSet: () => void = () => {};
    mockOnSelect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSet = resolve;
        }),
    );
    const { getByTestId } = renderPicker();
    fireEvent.press(getByTestId("list-item-option-60"));
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });
    fireEvent.press(getByTestId("list-item-option-1200"));
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    resolveSet();
  });
});
