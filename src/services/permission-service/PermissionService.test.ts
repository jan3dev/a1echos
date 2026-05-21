import {
  getRecordingPermissionsAsync,
  PermissionStatus,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import * as Linking from "expo-linking";

import { permissionService } from "./PermissionService";

const mockGetPerms = getRecordingPermissionsAsync as jest.Mock;
const mockRequestPerms = requestRecordingPermissionsAsync as jest.Mock;
const mockOpenSettings = Linking.openSettings as jest.Mock;

describe("PermissionService", () => {
  describe("getRecordPermission", () => {
    it("returns granted result from expo-audio", async () => {
      mockGetPerms.mockResolvedValueOnce({
        granted: true,
        status: "granted",
        canAskAgain: true,
      });

      const result = await permissionService.getRecordPermission();

      expect(result).toEqual({
        granted: true,
        status: "granted",
        canAskAgain: true,
      });
    });

    it("returns denied status", async () => {
      mockGetPerms.mockResolvedValueOnce({
        granted: false,
        status: "denied",
        canAskAgain: false,
      });

      const result = await permissionService.getRecordPermission();

      expect(result).toEqual({
        granted: false,
        status: "denied",
        canAskAgain: false,
      });
    });

    it("defaults canAskAgain to true when undefined", async () => {
      mockGetPerms.mockResolvedValueOnce({
        granted: true,
        status: "granted",
        canAskAgain: undefined,
      });

      const result = await permissionService.getRecordPermission();

      expect(result.canAskAgain).toBe(true);
    });

    it("returns fallback on error (granted=false, UNDETERMINED)", async () => {
      mockGetPerms.mockRejectedValueOnce(new Error("fail"));

      const result = await permissionService.getRecordPermission();

      expect(result).toEqual({
        granted: false,
        status: PermissionStatus.UNDETERMINED,
        canAskAgain: true,
      });
    });
  });

  describe("requestRecordPermission", () => {
    it("calls requestRecordingPermissionsAsync and returns result", async () => {
      mockRequestPerms.mockResolvedValueOnce({
        granted: true,
        status: "granted",
        canAskAgain: true,
      });

      const result = await permissionService.requestRecordPermission();

      expect(mockRequestPerms).toHaveBeenCalled();
      expect(result.granted).toBe(true);
    });

    it("defaults canAskAgain to true when undefined", async () => {
      mockRequestPerms.mockResolvedValueOnce({
        granted: true,
        status: "granted",
        canAskAgain: undefined,
      });

      const result = await permissionService.requestRecordPermission();

      expect(result.canAskAgain).toBe(true);
    });

    it("returns fallback on error", async () => {
      mockRequestPerms.mockRejectedValueOnce(new Error("fail"));

      const result = await permissionService.requestRecordPermission();

      expect(result).toEqual({
        granted: false,
        status: PermissionStatus.UNDETERMINED,
        canAskAgain: true,
      });
    });
  });

  describe("ensureRecordPermission", () => {
    it("returns true when already granted", async () => {
      mockGetPerms.mockResolvedValueOnce({
        granted: true,
        status: "granted",
        canAskAgain: true,
      });

      const result = await permissionService.ensureRecordPermission();

      expect(result).toBe(true);
      expect(mockRequestPerms).not.toHaveBeenCalled();
    });

    it("requests when not granted and returns request result", async () => {
      mockGetPerms.mockResolvedValueOnce({
        granted: false,
        status: "denied",
        canAskAgain: true,
      });
      mockRequestPerms.mockResolvedValueOnce({
        granted: true,
        status: "granted",
        canAskAgain: true,
      });

      const result = await permissionService.ensureRecordPermission();

      expect(mockRequestPerms).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("openAppSettings", () => {
    it("calls Linking.openSettings and returns true", async () => {
      mockOpenSettings.mockResolvedValueOnce(undefined);

      const result = await permissionService.openAppSettings();

      expect(mockOpenSettings).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("returns false on error", async () => {
      mockOpenSettings.mockRejectedValueOnce(new Error("fail"));

      const result = await permissionService.openAppSettings();

      expect(result).toBe(false);
    });
  });
});
