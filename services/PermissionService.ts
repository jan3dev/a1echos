import {
  getRecordingPermissionsAsync,
  PermissionStatus,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import * as Linking from 'expo-linking';

const createPermissionService = () => {
  const requestRecordPermission = async (): Promise<boolean> => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      return granted;
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  };

  const getRecordPermissionStatus = async (): Promise<PermissionStatus> => {
    try {
      const { status } = await getRecordingPermissionsAsync();
      return status;
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
      const { status, canAskAgain } = await getRecordingPermissionsAsync();
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
