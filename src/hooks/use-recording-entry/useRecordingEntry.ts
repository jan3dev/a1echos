import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { RefObject, useCallback, useEffect, useRef } from "react";
import type { View } from "react-native";

import type { ToastOptions } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import {
  useCreateSession,
  useIsIncognitoMode,
  useSetRecordingCallbacks,
  useSetRecordingControlsEnabled,
  useShowGlobalTooltip,
  useStartRecording,
  useStopRecordingAndSave,
} from "@/stores";
import { FeatureFlag, getErrorMessage, logError } from "@/utils";

import { useLocalization } from "../use-localization/useLocalization";
import { useMicPermission } from "../use-mic-permission/useMicPermission";

interface UseRecordingEntryParams {
  showAlertToast: (options: ToastOptions) => void;
  hideAlertToast: () => void;
  folderId?: string;
  onStarted?: () => void;
  blurTarget?: RefObject<View | null>;
}

export const useRecordingEntry = ({
  showAlertToast,
  hideAlertToast,
  folderId,
  onStarted,
  blurTarget,
}: UseRecordingEntryParams) => {
  const router = useRouter();
  const { loc } = useLocalization();
  const createSession = useCreateSession();
  const isIncognitoMode = useIsIncognitoMode();
  const startTranscriptionRecording = useStartRecording();
  const stopRecordingAndSave = useStopRecordingAndSave();
  const showGlobalTooltip = useShowGlobalTooltip();
  const setRecordingCallbacks = useSetRecordingCallbacks();
  const setRecordingControlsEnabled = useSetRecordingControlsEnabled();
  const ensureMicPermission = useMicPermission(showAlertToast, hideAlertToast);

  const handleRecordingStartRef = useRef<(() => Promise<void>) | null>(null);
  const handleRecordingStopRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    handleRecordingStartRef.current = async () => {
      if (!(await ensureMicPermission())) return;

      try {
        const sessionId = await createSession(
          undefined,
          isIncognitoMode,
          loc.recordingPrefix,
          loc.incognitoModeTitle,
          folderId,
        );

        const recordingStarted = await startTranscriptionRecording();
        if (!recordingStarted) {
          showGlobalTooltip(
            loc.homeFailedStartRecording,
            "normal",
            undefined,
            true,
          );
          return;
        }

        // brief pause to ensure recording has started before navigation (50ms)
        await new Promise((resolve) => setTimeout(resolve, 50));

        router.push(Routes.session(sessionId));

        onStarted?.();
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.recording,
          message: "Failed to start recording",
        });
        showAlertToast({
          title: loc.errorCreatingSessionTitle,
          message: getErrorMessage(error),
          variant: "error",
        });
      }
    };
  }, [
    folderId,
    isIncognitoMode,
    loc,
    router,
    ensureMicPermission,
    showGlobalTooltip,
    showAlertToast,
    createSession,
    startTranscriptionRecording,
    onStarted,
  ]);

  useEffect(() => {
    handleRecordingStopRef.current = async () => {
      await stopRecordingAndSave();
    };
  }, [stopRecordingAndSave]);

  useFocusEffect(
    useCallback(() => {
      const onStart = () => handleRecordingStartRef.current?.();
      const onStop = () => handleRecordingStopRef.current?.();
      setRecordingCallbacks(onStart, onStop, blurTarget);
      setRecordingControlsEnabled(true);
      // No cleanup - next screen will set its own callbacks
    }, [setRecordingCallbacks, setRecordingControlsEnabled, blurTarget]),
  );
};
