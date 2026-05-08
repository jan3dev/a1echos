import { useCallback } from "react";

import { ToastOptions } from "@/components/ui/toast/useToast";

import { useLocalization } from "../use-localization/useLocalization";
import { usePermissions } from "../use-permissions/usePermissions";

export const useMicPermission = (
  showAlertToast: (options: ToastOptions) => void,
  hideAlertToast: () => void,
) => {
  const { hasPermission, requestPermission, openSettings } = usePermissions();
  const { loc } = useLocalization();

  return useCallback(async (): Promise<boolean> => {
    if (hasPermission) return true;

    const result = await requestPermission();
    if (result.granted) return true;

    if (!result.canAskAgain) {
      showAlertToast({
        title: loc.microphoneAccessRequiredTitle,
        message: loc.microphoneAccessDeniedMessage,
        variant: "warning",
        messageMaxLines: 3,
        primaryButtonText: loc.openSettings,
        onPrimaryButtonTap: openSettings,
        secondaryButtonText: loc.cancel,
        onSecondaryButtonTap: hideAlertToast,
      });
    } else {
      showAlertToast({
        title: loc.microphoneAccessRequiredTitle,
        message: loc.microphoneAccessNeededMessage,
        variant: "warning",
      });
    }

    return false;
  }, [
    hasPermission,
    requestPermission,
    openSettings,
    showAlertToast,
    hideAlertToast,
    loc,
  ]);
};
