import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  AudioPlayer,
  Button,
  Icon,
  ListItem,
  ProgressIndicator,
  Screen,
  SubScreenNavbarActions,
  type SubScreenNavbarAction,
  Toast,
  TopAppBar,
  TranscriptionTimestamp,
  useToast,
} from "@/components";
import { RipplePressable } from "@/components/ui/ripple-pressable/RipplePressable";
import { AppConstants, Routes, TestID } from "@/constants";
import { useKeyboardHeight, useLocalization, useScrollSurface } from "@/hooks";
import { Transcription, transcriptTextStyle } from "@/models";
import { audioProtectionService, shareService } from "@/services";
import {
  useDeleteTranscription,
  useDeleteTranscriptionAudio,
  useReprocessTranscription,
  useSelectedLanguage,
  useShowGlobalTooltip,
  useTextAppearance,
  useTranscriptionStore,
  useUpdateTranscription,
} from "@/stores";
import { useTheme } from "@/theme";
import { FeatureFlag, getErrorMessage, logError } from "@/utils";

const toFileUri = (path: string) =>
  path.startsWith("file://") ? path : `file://${path}`;

/** Readable URI for the stored audio; Android's decrypted copy is released on unmount. */
const usePlayableAudio = (audioPath: string) => {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    if (!audioPath) return;
    let cancelled = false;
    let release: (() => Promise<void>) | undefined;
    audioProtectionService
      .openPlaintextAudio(audioPath)
      .then((plaintext) => {
        release = plaintext.release;
        if (cancelled) release();
        else setUri(toFileUri(plaintext.path));
      })
      .catch((error) =>
        logError(error, {
          flag: FeatureFlag.storage,
          message: "Failed to prepare audio for playback",
        }),
      );
    return () => {
      cancelled = true;
      setUri(null);
      release?.();
    };
  }, [audioPath]);
  return uri;
};

export default function TranscriptionEditScreen() {
  const { id, language } = useLocalSearchParams<{
    id: string;
    language?: string;
  }>();
  const router = useRouter();
  const { loc } = useLocalization();
  const { theme } = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const blurTargetRef = useRef<View>(null);
  const { scrolled, onScroll } = useScrollSurface();
  const textStyle = transcriptTextStyle(useTextAppearance());

  const stored = useTranscriptionStore((s) =>
    s.transcriptions.find((t) => t.id === id),
  );
  // Keeps rendering the last known item while the screen pops after a delete.
  const lastRef = useRef<Transcription | undefined>(stored);
  if (stored) lastRef.current = stored;
  const transcription = lastRef.current;

  const selectedLanguage = useSelectedLanguage();
  const updateTranscription = useUpdateTranscription();
  const deleteTranscription = useDeleteTranscription();
  const deleteTranscriptionAudio = useDeleteTranscriptionAudio();
  const reprocessTranscription = useReprocessTranscription();
  const showGlobalTooltip = useShowGlobalTooltip();
  const { show: showToast, hide: hideToast, toastState } = useToast();

  const [text, setText] = useState(transcription?.text ?? "");
  const [isFocused, setIsFocused] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const storedAudioPath = stored?.audioPath ?? "";
  const audioPath = useMemo(
    () =>
      audioProtectionService.audioExists(storedAudioPath)
        ? storedAudioPath
        : "",
    [storedAudioPath],
  );
  const playableUri = usePlayableAudio(audioPath);
  const languageCode = language ?? selectedLanguage.code;

  if (!transcription) return null;

  const trimmed = text.trim();
  const canSave =
    trimmed !== "" &&
    trimmed !== transcription.text &&
    !isSaving &&
    !isReprocessing;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateTranscription({ ...transcription, text: trimmed });
      router.back();
    } catch (error) {
      setIsSaving(false);
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to save transcription edit",
      });
    }
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    try {
      const result = await reprocessTranscription(audioPath, languageCode);
      if (result) setText(result);
      else showGlobalTooltip(loc.uploadErrorNoSpeech);
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to reprocess transcription",
      });
      showGlobalTooltip(loc.reprocessFailed);
    } finally {
      setIsReprocessing(false);
    }
  };

  const confirm = (title: string, message: string, onConfirm: () => void) =>
    showToast({
      title,
      message,
      primaryButtonText: loc.delete,
      onPrimaryButtonTap: () => {
        hideToast();
        onConfirm();
      },
      secondaryButtonText: loc.cancel,
      onSecondaryButtonTap: hideToast,
      variant: "info",
    });

  const handleDeleteAudio = () =>
    confirm(loc.deleteAudioTitle, loc.deleteAudioMessage, async () => {
      try {
        await deleteTranscriptionAudio(transcription.id);
        showGlobalTooltip(loc.audioDeleted);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.transcription,
          message: "Failed to delete transcription audio",
        });
      }
    });

  const handleDelete = () =>
    confirm(
      loc.sessionDeleteTranscriptionsTitle,
      loc.sessionDeleteTranscriptionsMessage(1),
      async () => {
        try {
          await deleteTranscription(transcription.id);
          router.back();
          showGlobalTooltip(loc.sessionTranscriptionsDeleted(1));
        } catch (error) {
          logError(error, {
            flag: FeatureFlag.transcription,
            message: "Failed to delete transcription",
          });
        }
      },
    );

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Android 12+ shows its own clipboard confirmation.
      if (Platform.OS === "ios" || Number(Platform.Version) < 31) {
        showGlobalTooltip(loc.copiedToClipboard);
      }
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to copy transcription",
      });
      showGlobalTooltip(loc.copyFailedTitle);
    }
  };

  const handleShare = async () => {
    try {
      await shareService.shareTranscriptions([{ ...transcription, text }]);
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to share transcription",
      });
      showGlobalTooltip(loc.shareFailed(getErrorMessage(error)));
    }
  };

  const actions: SubScreenNavbarAction[] = [
    {
      key: "delete",
      icon: "trash",
      label: loc.delete,
      color: colors.accentDanger,
      onPress: handleDelete,
    },
    { key: "copy", icon: "copy", label: loc.copy, onPress: handleCopy },
    { key: "share", icon: "export", label: loc.share, onPress: handleShare },
  ];

  const chevron = (
    <Icon name="chevron_right" size={18} color={colors.textSecondary} />
  );

  return (
    <Screen>
      <AppBarBlurTarget targetRef={blurTargetRef} style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.content,
              {
                paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
                backgroundColor: colors.surfaceBackground,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surfacePrimary,
                  borderColor: isFocused
                    ? colors.accentBrand
                    : colors.surfaceBorderPrimary,
                },
              ]}
            >
              <TranscriptionTimestamp
                timestamp={transcription.timestamp}
                colors={colors}
              />
              <TextInput
                testID={TestID.TranscriptionEditInput}
                allowFontScaling={false}
                value={text}
                onChangeText={setText}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                editable={!isReprocessing}
                multiline
                scrollEnabled={false}
                disableFullscreenUI
                style={[styles.input, { color: colors.textPrimary }, textStyle]}
              />
            </View>

            {audioPath !== "" && (
              <>
                <AudioPlayer
                  testID={TestID.TranscriptionEditAudio}
                  uri={playableUri}
                  onDelete={handleDeleteAudio}
                  playAccessibilityLabel={loc.play}
                  pauseAccessibilityLabel={loc.pause}
                  deleteAccessibilityLabel={loc.deleteAudio}
                />
                <ListItem
                  testID={TestID.TranscriptionEditLanguage}
                  title={loc.spokenLanguageTitle}
                  titleTrailing={languageCode.toUpperCase()}
                  iconLeading={
                    <Icon
                      name="language"
                      size={24}
                      color={colors.textSecondary}
                    />
                  }
                  iconTrailing={chevron}
                  onPress={() =>
                    router.push(
                      Routes.transcriptionLanguage(
                        transcription.id,
                        languageCode,
                      ),
                    )
                  }
                />
                <ListItem
                  testID={TestID.TranscriptionEditReprocess}
                  title={loc.reprocessTranscription}
                  iconLeading={
                    <Icon name="redo" size={24} color={colors.textSecondary} />
                  }
                  iconTrailing={
                    isReprocessing ? (
                      <ProgressIndicator color={colors.accentBrand} size={18} />
                    ) : (
                      chevron
                    )
                  }
                  onPress={isReprocessing ? undefined : handleReprocess}
                />
              </>
            )}

            <Button.primary
              testID={TestID.TranscriptionEditSave}
              text={loc.save}
              enabled={canSave}
              isLoading={isSaving}
              onPress={handleSave}
            />
          </ScrollView>

          <View
            style={{
              paddingBottom: keyboardHeight > 0 ? 0 : insets.bottom,
              backgroundColor: colors.surfaceBackground,
            }}
          >
            <SubScreenNavbarActions actions={actions} />
          </View>
        </KeyboardAvoidingView>
      </AppBarBlurTarget>

      <TopAppBar
        title={loc.edit}
        blurTarget={blurTargetRef}
        scrolled={scrolled}
        actions={[
          <RipplePressable
            key="close"
            testID={TestID.TranscriptionEditClose}
            onPress={() => router.back()}
            hitSlop={10}
            rippleColor={colors.ripple}
            borderless
            accessibilityRole="button"
            accessibilityLabel={loc.close}
          >
            <Icon name="close" size={24} color={colors.textPrimary} />
          </RipplePressable>,
        ]}
      />

      <Toast {...toastState} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  input: {
    padding: 0,
    textAlignVertical: "top",
  },
});
