import { renderHook } from "@testing-library/react-native";

import { Routes } from "@/constants";

import { useOnboardingExit } from "./useOnboardingExit";

const mockReplace = jest.fn();
const mockDismissAll = jest.fn();
const mockCanDismiss = jest.fn(() => true);
jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    dismissAll: mockDismissAll,
    canDismiss: mockCanDismiss,
  }),
}));

const mockMarkWelcomeSeen = jest.fn();
jest.mock("@/stores", () => ({
  useMarkWelcomeSeen: () => mockMarkWelcomeSeen,
}));

jest.mock("../use-localization/useLocalization", () => ({
  useLocalization: () => ({
    loc: {
      onboardingSkipConfirmTitle: "Skip Onboarding?",
      onboardingSkipConfirmMessage: "msg",
      onboardingSkip: "Skip",
      cancel: "Cancel",
    },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCanDismiss.mockReturnValue(true);
});

describe("useOnboardingExit", () => {
  it("marks welcome seen, dismisses the stack and replaces home", () => {
    const { result } = renderHook(() => useOnboardingExit(jest.fn()));
    result.current.finishOnboarding();
    expect(mockMarkWelcomeSeen).toHaveBeenCalledTimes(1);
    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(Routes.home);
  });

  it("replaces home without dismissing when nothing is stacked", () => {
    mockCanDismiss.mockReturnValue(false);
    const { result } = renderHook(() => useOnboardingExit(jest.fn()));
    result.current.finishOnboarding();
    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(Routes.home);
  });

  it("confirms skipping with a warning toast that finishes on confirm", () => {
    const show = jest.fn();
    const { result } = renderHook(() => useOnboardingExit(show));
    result.current.confirmSkip();
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Skip Onboarding?",
        variant: "warning",
        primaryButtonText: "Skip",
        secondaryButtonText: "Cancel",
      }),
    );
    expect(mockMarkWelcomeSeen).not.toHaveBeenCalled();
    show.mock.calls[0][0].onPrimaryButtonTap();
    expect(mockMarkWelcomeSeen).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(Routes.home);
  });
});
