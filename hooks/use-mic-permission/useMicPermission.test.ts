import { act, renderHook } from "@testing-library/react-native";
import { PermissionStatus } from "expo-modules-core";

import { permissionService } from "@/services";

import { useMicPermission } from "./useMicPermission";

jest.mock("@/services", () => ({
  permissionService: {
    getRecordPermission: jest.fn(),
    requestRecordPermission: jest.fn(),
    openAppSettings: jest.fn(),
  },
}));

jest.mock("@/utils", () => ({
  logError: jest.fn(),
  FeatureFlag: { service: "service" },
}));

const mockGetRecordPermission =
  permissionService.getRecordPermission as jest.Mock;
const mockRequestRecordPermission =
  permissionService.requestRecordPermission as jest.Mock;
const mockOpenAppSettings = permissionService.openAppSettings as jest.Mock;

describe("useMicPermission", () => {
  let showAlertToast: jest.Mock;
  let hideAlertToast: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    showAlertToast = jest.fn();
    hideAlertToast = jest.fn();
  });

  const setupGranted = () => {
    mockGetRecordPermission.mockResolvedValue({
      status: PermissionStatus.GRANTED,
      canAskAgain: true,
      granted: true,
    });
  };

  const setupUndetermined = () => {
    mockGetRecordPermission.mockResolvedValue({
      status: PermissionStatus.UNDETERMINED,
      canAskAgain: true,
      granted: false,
    });
  };

  it("returns true when permission already granted, no toast shown", async () => {
    setupGranted();
    const { result } = renderHook(() =>
      useMicPermission(showAlertToast, hideAlertToast),
    );
    // wait for usePermissions checkPermission effect
    await act(async () => {});

    let granted: boolean | undefined;
    await act(async () => {
      granted = await result.current();
    });

    expect(granted).toBe(true);
    expect(showAlertToast).not.toHaveBeenCalled();
    expect(mockRequestRecordPermission).not.toHaveBeenCalled();
  });

  it("requests permission when not granted; returns true when grant succeeds", async () => {
    setupUndetermined();
    mockRequestRecordPermission.mockResolvedValue({
      status: PermissionStatus.GRANTED,
      canAskAgain: true,
      granted: true,
    });

    const { result } = renderHook(() =>
      useMicPermission(showAlertToast, hideAlertToast),
    );
    await act(async () => {});

    let granted: boolean | undefined;
    await act(async () => {
      granted = await result.current();
    });

    expect(granted).toBe(true);
    expect(mockRequestRecordPermission).toHaveBeenCalled();
    expect(showAlertToast).not.toHaveBeenCalled();
  });

  it("shows warning toast with action buttons when permanently denied", async () => {
    setupUndetermined();
    mockRequestRecordPermission.mockResolvedValue({
      status: PermissionStatus.DENIED,
      canAskAgain: false,
      granted: false,
    });

    const { result } = renderHook(() =>
      useMicPermission(showAlertToast, hideAlertToast),
    );
    await act(async () => {});

    let granted: boolean | undefined;
    await act(async () => {
      granted = await result.current();
    });

    expect(granted).toBe(false);
    expect(showAlertToast).toHaveBeenCalledTimes(1);
    const opts = showAlertToast.mock.calls[0][0];
    expect(opts.variant).toBe("warning");
    expect(opts.primaryButtonText).toBeDefined();
    expect(opts.secondaryButtonText).toBeDefined();
    expect(opts.onPrimaryButtonTap).toBeDefined();

    // primary button tap routes to openSettings
    opts.onPrimaryButtonTap();
    expect(mockOpenAppSettings).toHaveBeenCalled();
  });

  it("shows warning toast with no actions when denied but can ask again", async () => {
    setupUndetermined();
    mockRequestRecordPermission.mockResolvedValue({
      status: PermissionStatus.DENIED,
      canAskAgain: true,
      granted: false,
    });

    const { result } = renderHook(() =>
      useMicPermission(showAlertToast, hideAlertToast),
    );
    await act(async () => {});

    let granted: boolean | undefined;
    await act(async () => {
      granted = await result.current();
    });

    expect(granted).toBe(false);
    expect(showAlertToast).toHaveBeenCalledTimes(1);
    const opts = showAlertToast.mock.calls[0][0];
    expect(opts.variant).toBe("warning");
    expect(opts.primaryButtonText).toBeUndefined();
    expect(opts.secondaryButtonText).toBeUndefined();
  });
});
