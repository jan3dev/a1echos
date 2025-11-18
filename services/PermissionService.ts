import { Audio } from 'expo-av';
import * as Linking from 'expo-linking';
import { PermissionStatus } from 'expo-modules-core';

const createPermissionService = () => {
  const requestRecordPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === PermissionStatus.GRANTED;
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  };

  const getRecordPermissionStatus = async (): Promise<PermissionStatus> => {
    try {
      const { status } = await Audio.getPermissionsAsync();

      if (status === PermissionStatus.GRANTED) {
        return PermissionStatus.GRANTED;
      } else if (status === PermissionStatus.DENIED) {
        return PermissionStatus.DENIED;
      } else {
        return PermissionStatus.UNDETERMINED;
      }
    } catch (error) {
      console.error('Error getting permission status:', error);
      return PermissionStatus.UNDETERMINED;
    }
  };

  const ensureRecordPermission = async (): Promise<boolean> => {
    const status = await getRecordPermissionStatus();

    if (status === PermissionStatus.GRANTED) {
      return true;
    }

    if (status === PermissionStatus.DENIED) {
      return false;
    }

    if (status === PermissionStatus.UNDETERMINED) {
      return await requestRecordPermission();
    }

    return false;
  };

  const isPermanentlyDenied = async (): Promise<boolean> => {
    try {
      const { status, canAskAgain } = await Audio.getPermissionsAsync();
      return status === PermissionStatus.DENIED && !canAskAgain;
    } catch (error) {
      console.error('Error checking permission denial status:', error);
      return false;
    }
  };

  const openAppSettings = async (): Promise<boolean> => {
    try {
      await Linking.openSettings();
      return true;
    } catch (error) {
      console.error('Error opening app settings:', error);
      return false;
    }
  };

  return {
    requestRecordPermission,
    getRecordPermissionStatus,
    ensureRecordPermission,
    isPermanentlyDenied,
    openAppSettings,
  };
};

export const permissionService = createPermissionService();
export default permissionService;
