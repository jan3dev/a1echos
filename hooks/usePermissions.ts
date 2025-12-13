import { PermissionStatus } from 'expo-modules-core';
import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { permissionService } from '@/services';
import { FeatureFlag, logError } from '@/utils';

export const usePermissions = () => {
  const [status, setStatus] = useState<PermissionStatus>(
    PermissionStatus.UNDETERMINED
  );
  const [canAskAgain, setCanAskAgain] = useState(true);

  const checkPermission = useCallback(async () => {
    let isMounted = true;
    try {
      const currentStatus = await permissionService.getRecordPermissionStatus();
      if (isMounted) setStatus(currentStatus);

      // Check if permanently denied
      const isDenied = await permissionService.isPermanentlyDenied();
      if (isMounted) setCanAskAgain(!isDenied);
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.service,
        message: 'Failed to check permission',
      });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Check on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Re-check when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          checkPermission();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [checkPermission]);

  const requestPermission = useCallback(async () => {
    try {
      const granted = await permissionService.requestRecordPermission();
      await checkPermission(); // Update state after request
      return granted;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.service,
        message: 'Failed to request permission',
      });
      throw error;
    }
  }, [checkPermission]);

  const openSettings = useCallback(async () => {
    await permissionService.openAppSettings();
  }, []);

  return {
    status,
    hasPermission: status === PermissionStatus.GRANTED,
    canAskAgain,
    requestPermission,
    checkPermission,
    openSettings,
  };
};
