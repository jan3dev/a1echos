import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

import { RecordScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import { useLocalization, useMicPermission, useOnboardingExit } from "@/hooks";
import { Transcription } from "@/models";
import { shareService } from "@/services";
import {
  useCreateSession,
  useDeleteTranscriptions,
  useIsEngineInitializing,
  useLivePreview,
  useMarkKeyboardPromptSeen,
  useSessionStore,
  useSessionTranscriptions,
  useShowGlobalTooltip,
  useShowToast,
  useStartRecording,
  useStopRecordingAndSave,
  useTranscriptionState,
  useTranscriptionStore,
} from "@/stores";
import { FeatureFlag, getErrorMessage, logError } from "@/utils";

const logSessionError = (error: unknown) =>
  logError(error, {
    flag: FeatureFlag.transcription,
    message: "Failed to set up or tear down onboarding session",
  });

/** Records into a throwaway incognito session that's torn down on leave. */
export default function Record() {
  const router = useRouter();
  const { loc } = useLocalization();
  const { show, hide, toastState } = useToast();
  const { confirmSkip } = useOnboardingExit(show);
  const ensureMicPermission = useMicPermission(show, hide);
  const showGlobalTooltip = useShowGlobalTooltip();
  const showToast = useShowToast();

  const createSession = useCreateSession();
  const markKeyboardPromptSeen = useMarkKeyboardPromptSeen();
  const startRecording = useStartRecording();
  const stopRecordingAndSave = useStopRecordingAndSave();
  const deleteTranscriptions = useDeleteTranscriptions();
  const updateTranscription = useTranscriptionStore(
    (s) => s.updateTranscription,
  );
  const state = useTranscriptionState();
  const isInitializing = useIsEngineInitializing();
  const livePreview = useLivePreview();

  const [sessionId, setSessionId] = useState("");
  // "" rather than undefined: undefined falls back to the active session.
  const transcriptions = useSessionTranscriptions(sessionId);

  useEffect(() => {
    // The keyboard was just set up in onboarding; don't prompt for it again.
    void markKeyboardPromptSeen();
    let active = true;
    const created = createSession(undefined, true);
    created.then((id) => active && setSessionId(id)).catch(logSessionError);
    return () => {
      active = false;
      created
        .then(async (id) => {
          try {
            await useTranscriptionStore.getState().stopRecordingAndSave();
            await useTranscriptionStore
              .getState()
              .deleteAllTranscriptionsForSession(id);
          } finally {
            // Always drop the throwaway session so Home doesn't open on it.
            if (useSessionStore.getState().incognitoSession?.id === id) {
              await useSessionStore.getState().clearIncognitoSession();
            }
          }
        })
        .catch(logSessionError);
    };
  }, [createSession, markKeyboardPromptSeen]);

  const handleRecordingStart = useCallback(async () => {
    if (!(await ensureMicPermission())) return;
    if (!(await startRecording())) {
      showGlobalTooltip(
        loc.homeFailedStartRecording,
        "normal",
        undefined,
        true,
      );
    }
  }, [ensureMicPermission, startRecording, showGlobalTooltip, loc]);

  const handleUpdate = useCallback(
    (updated: Transcription) => {
      updateTranscription(updated).catch((error) =>
        logError(error, {
          flag: FeatureFlag.transcription,
          message: "Failed to update onboarding transcription",
        }),
      );
    },
    [updateTranscription],
  );

  const handleDelete = useCallback(() => {
    deleteTranscriptions(new Set(transcriptions.map((t) => t.id))).catch(
      (error) =>
        logError(error, {
          flag: FeatureFlag.transcription,
          message: "Failed to delete onboarding transcription",
        }),
    );
  }, [deleteTranscriptions, transcriptions]);

  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(
        transcriptions.map((t) => t.text).join("\n\n"),
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Android 12+ shows its own clipboard confirmation.
      if (Platform.OS === "ios" || Number(Platform.Version) < 31) {
        showGlobalTooltip(loc.allTranscriptionsCopied);
      }
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to copy onboarding transcription",
      });
      show({
        title: loc.copyFailedTitle,
        message: getErrorMessage(error),
        variant: "error",
      });
    }
  }, [transcriptions, showGlobalTooltip, show, loc]);

  const handleShare = useCallback(async () => {
    try {
      await shareService.shareTranscriptions(transcriptions);
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to share onboarding transcription",
      });
      showToast(loc.shareFailed(getErrorMessage(error)), "error");
    }
  }, [transcriptions, showToast, loc]);

  return (
    <>
      <RecordScreen
        testID="record"
        state={state}
        isInitializing={isInitializing}
        transcriptions={transcriptions}
        liveText={
          livePreview?.sessionId === sessionId ? livePreview.text : undefined
        }
        onRecordingStart={handleRecordingStart}
        onRecordingStop={stopRecordingAndSave}
        onTranscriptionUpdate={handleUpdate}
        onDelete={handleDelete}
        onCopy={handleCopy}
        onShare={handleShare}
        onBack={router.back}
        onSkip={confirmSkip}
        onNext={() => router.push(Routes.onboardingPrivacy)}
      />
      <Toast {...toastState} />
    </>
  );
}
