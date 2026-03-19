import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import ModelSettingsScreen from "./model";

// --- Mocks ---

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockSetModelType = jest.fn();

jest.mock("@/theme", () => ({
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        surfaceBackground: "#fff",
        surfacePrimary: "#fff",
        surfaceBorderPrimary: "#ccc",
        textPrimary: "#000",
        textSecondary: "#666",
      },
    },
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mockMakeLoc } = require("../../../test-utils/mockLocalization");

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
}));

jest.mock("@/stores", () => ({
  useSelectedModelType: jest.fn(() => "whisper_file"),
  useSetModelType: jest.fn(() => mockSetModelType),
}));

jest.mock("@/utils", () => ({
  delay: jest.fn(() => Promise.resolve()),
  logError: jest.fn(),
  FeatureFlag: { settings: "settings" },
}));

jest.mock("@/components", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, TouchableOpacity } = require("react-native");
  return {
    Card: ({ children }: any) => <View testID="card">{children}</View>,
    Divider: () => <View testID="divider" />,
    ListItem: ({ title, onPress, iconTrailing }: any) => (
      <TouchableOpacity testID={`list-item-${title}`} onPress={onPress}>
        <Text>{String(title)}</Text>
        {iconTrailing}
      </TouchableOpacity>
    ),
    Radio: ({ value, groupValue }: any) => (
      <View testID={`radio-${value}`}>
        <Text testID={`radio-selected-${value}`}>
          {value === groupValue ? "selected" : "unselected"}
        </Text>
      </View>
    ),
    Text: ({ children }: any) => <Text>{String(children)}</Text>,
    TopAppBar: ({ title }: any) => (
      <View testID="top-app-bar">
        <Text>{String(title)}</Text>
      </View>
    ),
  };
});

describe("ModelSettingsScreen", () => {
  it("renders TopAppBar with model title", () => {
    const { getByTestId, getByText } = render(<ModelSettingsScreen />);
    expect(getByTestId("top-app-bar")).toBeTruthy();
    expect(getByText("modelTitle")).toBeTruthy();
  });

  it("renders two model options (File, Realtime)", () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    expect(getByTestId("list-item-whisperModelFileTitle")).toBeTruthy();
    expect(getByTestId("list-item-whisperModelRealtimeTitle")).toBeTruthy();
  });

  it("current model radio is selected", () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    expect(getByTestId("radio-selected-whisper_file")).toHaveTextContent(
      "selected",
    );
    expect(getByTestId("radio-selected-whisper_realtime")).toHaveTextContent(
      "unselected",
    );
  });

  it("selecting same model navigates back without calling setModelType", () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("list-item-whisperModelFileTitle"));
    expect(mockBack).toHaveBeenCalled();
    expect(mockSetModelType).not.toHaveBeenCalled();
  });

  it("selecting different model calls setModelType and navigates back", async () => {
    mockSetModelType.mockResolvedValue(undefined);

    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("list-item-whisperModelRealtimeTitle"));

    await waitFor(() => {
      expect(mockSetModelType).toHaveBeenCalledWith("whisper_realtime");
      expect(mockBack).toHaveBeenCalled();
    });
  });
});
