import { fireEvent, render } from "@testing-library/react-native";
import { useSafeAreaFrame } from "react-native-safe-area-context";

import { getModelInfo, ModelId } from "@/models";

import {
  TryLargerModelScreen,
  type TryLargerModelScreenProps,
} from "./TryLargerModelScreen";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: jest.fn(() => ({ x: 0, y: 0, width: 390, height: 844 })),
}));
const mockFrame = jest.mocked(useSafeAreaFrame);

const renderScreen = (overrides: Partial<TryLargerModelScreenProps> = {}) => {
  const props = {
    model: getModelInfo(ModelId.NEMO_PARAKEET_V3),
    isDownloaded: false,
    isSelected: false,
    onDownload: jest.fn(),
    onCancelDownload: jest.fn(),
    onSelect: jest.fn(),
    onBack: jest.fn(),
    onNext: jest.fn(),
    testID: "tl",
    ...overrides,
  };
  return { ...render(<TryLargerModelScreen {...props} />), props };
};

describe("TryLargerModelScreen", () => {
  it("renders copy, the model card and step 4 without skip", () => {
    const { getByText, getByTestId, queryByTestId } = renderScreen();
    expect(getByText("onboardingTryLargerModelTitle")).toBeTruthy();
    expect(getByText("onboardingTryLargerModelSubtitle")).toBeTruthy();
    expect(getByText("Parakeet V3")).toBeTruthy();
    expect(getByTestId("tl-steps-dot-4")).toHaveStyle({ width: 24 });
    expect(queryByTestId("tl-skip")).toBeNull();
  });

  it("downloads from the card and skips with Not Now", () => {
    const { getByText, getByTestId, queryByTestId, props } = renderScreen();
    fireEvent.press(getByText("download"));
    expect(props.onDownload).toHaveBeenCalledTimes(1);
    expect(queryByTestId("tl-next")).toBeNull();
    fireEvent.press(getByTestId("tl-not-now"));
    fireEvent.press(getByTestId("tl-back"));
    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it("shows Next once downloaded", () => {
    const { getByTestId, queryByTestId, props } = renderScreen({
      isDownloaded: true,
      isSelected: true,
    });
    expect(queryByTestId("tl-not-now")).toBeNull();
    fireEvent.press(getByTestId("tl-next"));
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it("renders in landscape", () => {
    mockFrame.mockReturnValueOnce({ x: 0, y: 0, width: 844, height: 390 });
    const { getByText } = renderScreen();
    expect(getByText("onboardingTryLargerModelTitle")).toBeTruthy();
  });
});
