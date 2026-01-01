import {
  getRecordingPermissionsAsync,
  PermissionResponse,
  PermissionStatus,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import * as Linking from 'expo-linking';

import { FeatureFlag, logError } from '@/utils';

export interface RecordPermissionResult {
  granted: boolean;
  status: PermissionStatus;
  canAskAgain: boolean;
}

const createPermissionService = () => {
  const getRecordPermission = async (): Promise<RecordPermissionResult> => {
    try {
      const response: PermissionResponse = await getRecordingPermissionsAsync();
      return {
        granted: response.granted,
        status: response.status,
        canAskAgain: response.canAskAgain ?? true,
      };
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.service,
        message: 'Error getting permission status',
      });
      return {
        granted: false,
        status: PermissionStatus.UNDETERMINED,
        canAskAgain: true,
      };
    }
  };

  const requestRecordPermission = async (): Promise<RecordPermissionResult> => {
    try {
      const response: PermissionResponse =
        await requestRecordingPermissionsAsync();
      return {
        granted: response.granted,
        status: response.status,
        canAskAgain: response.canAskAgain ?? true,
      };
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.service,
        message: 'Error requesting microphone permission',
      });
      return {
        granted: false,
        status: PermissionStatus.UNDETERMINED,
        canAskAgain: true,
      };
    }
  };

  const ensureRecordPermission = async (): Promise<boolean> => {
    const { granted } = await getRecordPermission();
    if (granted) {
      return true;
    }
    const result = await requestRecordPermission();
    return result.granted;
  };

  const openAppSettings = async (): Promise<boolean> => {
    try {
      await Linking.openSettings();
      return true;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.service,
        message: 'Error opening app settings',
      });
      return false;
    }
  };

  return {
    getRecordPermission,
    requestRecordPermission,
    ensureRecordPermission,
    openAppSettings,
  };
};

export const permissionService = createPermissionService();
export default permissionService;
