import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { useCallback } from "react";
import { Platform } from "react-native";

import type { ToastOptions } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import {
  AUDIO_BUSY_STATES,
  type ImportFailureReason,
  useCreateSession,
  useImportFiles,
  useShowGlobalTooltip,
  useTranscriptionStore,
} from "@/stores";
import { FeatureFlag, getErrorMessage, logError } from "@/utils";

import { useLocalization } from "../use-localization/useLocalization";
import { useSessionOperations } from "../use-session-operations/useSessionOperations";

const TEXT_TYPES = ["text/plain", "text/markdown", "text/x-markdown"];

// MIME types Android providers report for the formats its decoder handles.
// audio/mpeg also matches .mp2, which then fails per file.
const ANDROID_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/aac-adts",
  "audio/flac",
  "audio/ogg",
  "audio/opus",
  "audio/amr",
  "audio/amr-wb",
  "audio/3gpp",
  "video/3gpp",
];

const pickerTypes = () =>
  Platform.OS === "android"
    ? [...ANDROID_AUDIO_TYPES, ...TEXT_TYPES]
    : // .aifc/.caf/.m4b/.opus have no iOS MIME mapping; unsupported audio fails per file.
      ["audio/*", ...TEXT_TYPES];

interface UseFileImportParams {
  showAlertToast: (options: ToastOptions) => void;
  folderId?: string;
  /** Import into this existing session instead of creating a new one. */
  sessionId?: string;
}

export const useFileImport = ({
  showAlertToast,
  folderId,
  sessionId: targetSessionId,
}: UseFileImportParams) => {
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  const { loc } = useLocalization();
  const createSession = useCreateSession();
  const importFiles = useImportFiles();
  const { deleteSession } = useSessionOperations();
  const showGlobalTooltip = useShowGlobalTooltip();

  return useCallback(async () => {
    const reasonText: Record<ImportFailureReason, string> = {
      unsupported: loc.uploadErrorUnsupported,
      tooLong: loc.uploadErrorTooLong,
      tooLarge: loc.uploadErrorTooLarge,
      empty: loc.uploadErrorEmpty,
      noSpeech: loc.uploadErrorNoSpeech,
      failed: loc.uploadErrorFailed,
    };

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: pickerTypes(),
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      if (AUDIO_BUSY_STATES.has(useTranscriptionStore.getState().state)) {
        showGlobalTooltip(loc.uploadBusy, "normal", undefined, true);
        for (const asset of result.assets) new File(asset.uri).delete();
        return;
      }

      let sessionId = targetSessionId;
      if (!sessionId) {
        const sessionName =
          result.assets.length === 1
            ? result.assets[0].name.replace(/\.[^.]+$/, "")
            : undefined;
        sessionId = await createSession(
          sessionName,
          false,
          loc.recordingPrefix,
          loc.incognitoModeTitle,
          folderId,
        );
        router.push(Routes.session(sessionId));
      }

      let imported = 0;
      let failed: { name: string; reason: ImportFailureReason }[] = [];
      try {
        ({ imported, failed } = await importFiles(sessionId, result.assets));
      } finally {
        if (imported === 0 && !targetSessionId) {
          const route = navigation.getCurrentRoute() as
            | { params?: { id?: string } }
            | undefined;
          if (route?.params?.id === sessionId) router.back();
          await deleteSession(sessionId);
        }
      }

      if (failed.length > 0) {
        showAlertToast({
          title: loc.uploadFailed(failed.length),
          message: failed
            .map((f) => `${f.name}: ${reasonText[f.reason]}`)
            .join("\n"),
          messageMaxLines: Math.min(failed.length, 5),
          variant: "error",
        });
      }
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.session,
        message: "Failed to import files",
      });
      showAlertToast({
        title: loc.uploadFailed(1),
        message: getErrorMessage(error),
        variant: "error",
      });
    }
  }, [
    createSession,
    deleteSession,
    folderId,
    importFiles,
    loc,
    navigation,
    router,
    showAlertToast,
    showGlobalTooltip,
    targetSessionId,
  ]);
};
