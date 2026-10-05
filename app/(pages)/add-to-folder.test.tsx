/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import AddToFolderScreen from "./add-to-folder";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ sessionIds: "s1,s2" }),
  useRouter: () => ({ back: mockBack }),
}));

jest.mock("@/theme", () => ({
  spacing: { md: 16 },
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        textPrimary: "#000",
        ripple: "#000",
        surfaceBackground: "#fff",
      },
    },
  })),
}));

const {
  mockMakeLoc,
} = require("../../src/test-utils/mock-localization/mockLocalization");

jest.mock("@/hooks", () => ({
  useScrollSurface: jest.fn(() => ({ scrolled: false, onScroll: jest.fn() })),
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
}));

jest.mock("@/utils", () => ({
  FeatureFlag: { session: "SESSION" },
  logError: jest.fn(),
}));

const mockMove = jest.fn(async (..._args: any[]) => undefined);
const mockCreateFolder = jest.fn(async (..._args: any[]) => "f-new");
const mockExitSelection = jest.fn();
const mockShowTooltip = jest.fn();
jest.mock("@/stores", () => ({
  useFolderSummaries: () => [
    { id: "f1", name: "AQUA", createdAt: new Date(0), sessionCount: 2 },
    { id: "f2", name: "JAN3", createdAt: new Date(0), sessionCount: 4 },
  ],
  useCreateFolder: () => mockCreateFolder,
  useMoveSessionsToFolder: () => mockMove,
  useExitSessionSelection: () => mockExitSelection,
  useShowGlobalTooltip: () => mockShowTooltip,
}));

let mockGrid: any = null;
let mockModal: any = null;
jest.mock("@/components", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    AppBarBlurTarget: ({ children }: any) => <View>{children}</View>,
    PRIMARY_BUTTON_HEIGHT: 56,
    Screen: ({ children }: any) => <View>{children}</View>,
    Icon: () => null,
    TopAppBar: ({ title, actions }: any) => (
      <View>
        <Text>{String(title)}</Text>
        {actions}
      </View>
    ),
    FolderGrid: (props: any) => {
      mockGrid = props;
      return null;
    },
    FloatingCTAModule: ({ primary: { testID, enabled, onPress } }: any) => (
      <Pressable
        testID={testID}
        disabled={!enabled}
        accessibilityState={{ disabled: !enabled }}
        onPress={onPress}
      />
    ),
    SessionInputModal: (props: any) => {
      mockModal = props;
      return null;
    },
  };
});

jest.mock("@/components/ui/ripple-pressable/RipplePressable", () => {
  const { Pressable } = require("react-native");
  return { RipplePressable: (props: any) => <Pressable {...props} /> };
});

describe("AddToFolderScreen", () => {
  it("disables save until a folder is picked, then moves the sessions", async () => {
    const { getByTestId, getByText } = render(<AddToFolderScreen />);
    expect(getByText("selectFolder")).toBeTruthy();
    expect(getByTestId(TestID.AddToFolderSave)).toBeDisabled();
    expect(mockGrid.selectedId).toBeNull();

    act(() => mockGrid.onFolderPress({ id: "f2", name: "JAN3" }));
    expect(mockGrid.selectedId).toBe("f2");

    await act(async () => {
      fireEvent.press(getByTestId(TestID.AddToFolderSave));
    });
    expect(mockMove).toHaveBeenCalledWith(["s1", "s2"], "f2");
    expect(mockExitSelection).toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
    expect(mockShowTooltip).toHaveBeenCalledWith("sessionsAddedToFolder_JAN3");
  });

  it("creates a new folder and adds the sessions to it", async () => {
    render(<AddToFolderScreen />);
    expect(mockModal.visible).toBe(false);
    act(() => mockGrid.onCreatePress());
    expect(mockModal.visible).toBe(true);
    expect(String(mockModal.buttonText)).toBe("folderCreateAndAdd");

    await act(async () => {
      await mockModal.onSubmit(" Ideas ");
    });
    expect(mockCreateFolder).toHaveBeenCalledWith(" Ideas ");
    expect(mockMove).toHaveBeenCalledWith(["s1", "s2"], "f-new");
    expect(mockShowTooltip).toHaveBeenCalledWith("sessionsAddedToFolder_Ideas");
  });

  it("keeps the screen open when moving fails", async () => {
    mockMove.mockRejectedValueOnce(new Error("db"));
    const { getByTestId } = render(<AddToFolderScreen />);
    act(() => mockGrid.onFolderPress({ id: "f1", name: "AQUA" }));
    await act(async () => {
      fireEvent.press(getByTestId(TestID.AddToFolderSave));
    });
    expect(mockBack).not.toHaveBeenCalled();
    expect(getByTestId(TestID.AddToFolderSave)).not.toBeDisabled();
  });

  it("logs when creating the folder fails", async () => {
    mockCreateFolder.mockRejectedValueOnce(new Error("db"));
    render(<AddToFolderScreen />);
    await act(async () => {
      await mockModal.onSubmit("Ideas");
    });
    expect(mockMove).not.toHaveBeenCalled();
    expect(require("@/utils").logError).toHaveBeenCalled();
  });

  it("closes and cancels", () => {
    const { getByTestId } = render(<AddToFolderScreen />);
    fireEvent.press(getByTestId(TestID.AddToFolderClose));
    expect(mockBack).toHaveBeenCalled();
    act(() => mockGrid.onCreatePress());
    act(() => mockModal.onCancel());
    expect(mockModal.visible).toBe(false);
  });
});
