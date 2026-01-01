import { PermissionStatus } from 'expo-modules-core';
import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { permissionService, RecordPermissionResult } from '@/services';
import { FeatureFlag, logError } from '@/utils';

export const usePermissions = () => {
  const [status, setStatus] = useState<PermissionStatus>(
    PermissionStatus.UNDETERMINED
  );
  const [canAskAgain, setCanAskAgain] = useState(true);

  const checkPermission = useCallback(async () => {
    let isMounted = true;
    try {
      const result = await permissionService.getRecordPermission();
      if (isMounted) {
        setStatus(result.status);
        setCanAskAgain(result.canAskAgain);
      }
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

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

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

  const requestPermission =
    useCallback(async (): Promise<RecordPermissionResult> => {
      try {
        const result = await permissionService.requestRecordPermission();
        setStatus(result.status);
        setCanAskAgain(result.canAskAgain);
        return result;
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.service,
          message: 'Failed to request permission',
        });
        return {
          granted: false,
          status: PermissionStatus.UNDETERMINED,
          canAskAgain: true,
        };
      }
    }, []);

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
