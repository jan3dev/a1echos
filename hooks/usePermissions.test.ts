import { act, renderHook, waitFor } from "@testing-library/react-native";
import { PermissionStatus } from "expo-modules-core";
import { AppState } from "react-native";

import { permissionService } from "@/services";

import { usePermissions } from "./usePermissions";

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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockLogError = require("@/utils").logError as jest.Mock;

const mockGetRecordPermission =
  permissionService.getRecordPermission as jest.Mock;
const mockRequestRecordPermission =
  permissionService.requestRecordPermission as jest.Mock;
const mockOpenAppSettings = permissionService.openAppSettings as jest.Mock;

describe("usePermissions", () => {
  let appStateCallback: ((state: string) => void) | null = null;
  const mockRemove = jest.fn();

  beforeEach(() => {
    appStateCallback = null;
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_, handler) => {
        appStateCallback = handler as (state: string) => void;
        return { remove: mockRemove } as any;
      });

    mockGetRecordPermission.mockResolvedValue({
      status: PermissionStatus.UNDETERMINED,
      canAskAgain: true,
    });
  });

  it("calls checkPermission on mount", async () => {
    renderHook(() => usePermissions());

    await waitFor(() => {
      expect(mockGetRecordPermission).toHaveBeenCalled();
    });
  });

  it("updates status and canAskAgain from permission check result", async () => {
    mockGetRecordPermission.mockResolvedValue({
      status: PermissionStatus.GRANTED,
      canAskAgain: false,
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.status).toBe(PermissionStatus.GRANTED);
      expect(result.current.canAskAgain).toBe(false);
    });
  });

  it("hasPermission is true when status is GRANTED", async () => {
    mockGetRecordPermission.mockResolvedValue({
      status: PermissionStatus.GRANTED,
      canAskAgain: true,
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.hasPermission).toBe(true);
    });
  });

  it("hasPermission is false when status is DENIED or UNDETERMINED", async () => {
    mockGetRecordPermission.mockResolvedValue({
      status: PermissionStatus.DENIED,
      canAskAgain: false,
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.hasPermission).toBe(false);
    });

    // UNDETERMINED is the initial state and also results in false
    mockGetRecordPermission.mockResolvedValue({
      status: PermissionStatus.UNDETERMINED,
      canAskAgain: true,
    });

    const { result: result2 } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result2.current.hasPermission).toBe(false);
    });
  });

  it("AppState change to active re-checks permission", async () => {
    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(mockGetRecordPermission).toHaveBeenCalledTimes(1);
    });

    mockGetRecordPermission.mockResolvedValue({
      status: PermissionStatus.GRANTED,
      canAskAgain: true,
    });

    await act(async () => {
      appStateCallback?.("active");
    });

    await waitFor(() => {
      expect(mockGetRecordPermission).toHaveBeenCalledTimes(2);
      expect(result.current.status).toBe(PermissionStatus.GRANTED);
    });
  });

  it("requestPermission calls permissionService.requestRecordPermission and updates state", async () => {
    mockRequestRecordPermission.mockResolvedValue({
      granted: true,
      status: PermissionStatus.GRANTED,
      canAskAgain: false,
    });

    const { result } = renderHook(() => usePermissions());
    await waitFor(() => {
      expect(mockGetRecordPermission).toHaveBeenCalled();
    });

    let permResult: any;
    await act(async () => {
      permResult = await result.current.requestPermission();
    });

    expect(mockRequestRecordPermission).toHaveBeenCalled();
    expect(permResult).toEqual({
      granted: true,
      status: PermissionStatus.GRANTED,
      canAskAgain: false,
    });
    expect(result.current.status).toBe(PermissionStatus.GRANTED);
  });

  it("requestPermission returns fallback on error", async () => {
    mockRequestRecordPermission.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => usePermissions());
    await waitFor(() => {
      expect(mockGetRecordPermission).toHaveBeenCalled();
    });

    let permResult: any;
    await act(async () => {
      permResult = await result.current.requestPermission();
    });

    expect(permResult).toEqual({
      granted: false,
      status: PermissionStatus.UNDETERMINED,
      canAskAgain: true,
    });
  });

  it("checkPermission logs error on failure without throwing", async () => {
    mockGetRecordPermission.mockRejectedValue(new Error("check failed"));

    renderHook(() => usePermissions());

    await waitFor(() => {
      expect(mockLogError).toHaveBeenCalled();
    });
  });

  it("openSettings calls permissionService.openAppSettings", async () => {
    const { result } = renderHook(() => usePermissions());
    await waitFor(() => {
      expect(mockGetRecordPermission).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.openSettings();
    });

    expect(mockOpenAppSettings).toHaveBeenCalled();
  });

  it("cleans up AppState subscription on unmount", async () => {
    const { unmount } = renderHook(() => usePermissions());
    await waitFor(() => {
      expect(mockGetRecordPermission).toHaveBeenCalled();
    });

    unmount();

    expect(mockRemove).toHaveBeenCalled();
  });

  it("AppState change to non-active does not re-check permission", async () => {
    renderHook(() => usePermissions());

    await waitFor(() => {
      expect(mockGetRecordPermission).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      appStateCallback?.("background");
    });

    // Should not have been called again
    expect(mockGetRecordPermission).toHaveBeenCalledTimes(1);
  });
});
