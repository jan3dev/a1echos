import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type HostInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  AudioPlayer,
  Button,
  Icon,
  ListItem,
  PRIMARY_BUTTON_HEIGHT,
  ProgressIndicator,
  Screen,
  SUB_SCREEN_NAVBAR_HEIGHT,
  SubScreenNavbarActions,
  Toast,
  TopAppBar,
  TranscriptionTimestamp,
  useToast,
  type SubScreenNavbarAction,
} from "@/components";
import { RipplePressable } from "@/components/ui/ripple-pressable/RipplePressable";
import { AppConstants, Routes, TestID } from "@/constants";
import { useKeyboardHeight, useLocalization, useScrollSurface } from "@/hooks";
import { getLlmInfo, Transcription, transcriptTextStyle } from "@/models";
import { audioProtectionService, shareService } from "@/services";
import {
  useCancelSummary,
  useDeleteTranscription,
  useDeleteTranscriptionAudio,
  useIsStructuring,
  useIsSummaryBlocked,
  useReprocessTranscription,
  useSelectedLanguage,
  useSelectedLlmId,
  useShowGlobalTooltip,
  useStructureText,
  useSummarySessionId,
  useSummaryStore,
  useTextAppearance,
  useTranscriptionStore,
  useUpdateTranscription,
} from "@/stores";
import { useTheme } from "@/theme";
import { FeatureFlag, getErrorMessage, logError } from "@/utils";

const SAVE_BAR_HEIGHT = SUB_SCREEN_NAVBAR_HEIGHT;
const SAVE_BAR_GAP = (SAVE_BAR_HEIGHT - PRIMARY_BUTTON_HEIGHT) / 2;

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
  const keyboardOpen = useKeyboardHeight() > 0;
  const { width, height } = useWindowDimensions();
  // Landscape has no room for the bar over the text, so Save stays in-page.
  const floatSave = keyboardOpen && height > width;
  const blurTargetRef = useRef<HostInstance>(null);
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
  const structureText = useStructureText();
  const cancelLlm = useCancelSummary();
  const selectedLlmId = useSelectedLlmId();
  const isSummarizing = useSummarySessionId() !== null;
  const isStructuring = useIsStructuring();
  const isLlmBlocked = useIsSummaryBlocked();
  const showGlobalTooltip = useShowGlobalTooltip();
  const { show: showToast, hide: hideToast, toastState } = useToast();

  const [text, setText] = useState(transcription?.text ?? "");
  const [isFocused, setIsFocused] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // While the keyboard is open, Save floats above it until the user scrolls
  // its in-page slot up to the same spot; the bar then steps aside (native
  // driver) and the in-page Save, hidden behind it until now, takes over.
  const [scrollY] = useState(() => new Animated.Value(0));
  const [slotBottom, setSlotBottom] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const dockAt = slotBottom - viewportHeight + SAVE_BAR_GAP;
  const saveBarTranslateY = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [dockAt - 0.01, dockAt],
        outputRange: [0, SAVE_BAR_HEIGHT],
        extrapolate: "clamp",
      }),
    [scrollY, dockAt],
  );
  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: onScroll,
      }),
    [scrollY, onScroll],
  );

  // Leaving the screen discards the notes, so don't keep the model running.
  useEffect(
    () => () => {
      if (useSummaryStore.getState().isStructuring) cancelLlm();
    },
    [cancelLlm],
  );

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
  const isBusy = isReprocessing || isStructuring;
  const canSave =
    trimmed !== "" && trimmed !== transcription.text && !isSaving && !isBusy;
  const canStructure =
    trimmed !== "" && !isBusy && !isSummarizing && !isLlmBlocked;

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

  const handleStructure = async () => {
    if (
      selectedLlmId &&
      getLlmInfo(selectedLlmId).englishOnly &&
      languageCode !== "en"
    ) {
      showGlobalTooltip(loc.llmEnglishOnlyWarning, "normal", 5000);
    }
    try {
      const result = await structureText(trimmed);
      if (result.outcome === "done") setText(result.text);
      else if (result.outcome === "no-model") {
        showGlobalTooltip(loc.structureNeedsModel, "normal", 4000);
        router.push(Routes.settingsIntelligence);
      } else if (result.outcome === "cancelled") {
        showGlobalTooltip(loc.structureStopped, "normal", 3000);
      }
    } catch {
      showGlobalTooltip(loc.structureFailed, "error", 5000);
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

  const saveButton = (
    <Button.primary
      testID={TestID.TranscriptionEditSave}
      text={loc.save}
      enabled={canSave}
      isLoading={isSaving}
      onPress={handleSave}
    />
  );

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
          <View style={styles.viewport}>
            <Animated.ScrollView
              style={styles.flex}
              contentContainerStyle={[
                styles.content,
                {
                  paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
                  paddingBottom: floatSave ? SAVE_BAR_HEIGHT : 16,
                  backgroundColor: colors.surfaceBackground,
                },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
              onScroll={handleScroll}
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
                  editable={!isBusy}
                  multiline
                  scrollEnabled={false}
                  disableFullscreenUI
                  style={[
                    styles.input,
                    { color: colors.textPrimary },
                    textStyle,
                  ]}
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
                      <Icon
                        name="redo"
                        size={24}
                        color={colors.textSecondary}
                      />
                    }
                    iconTrailing={
                      isReprocessing ? (
                        <ProgressIndicator
                          color={colors.accentBrand}
                          size={18}
                        />
                      ) : (
                        chevron
                      )
                    }
                    onPress={isBusy ? undefined : handleReprocess}
                  />
                </>
              )}

              <ListItem
                testID={TestID.TranscriptionEditStructure}
                title={loc.structureNotes}
                iconLeading={
                  <Icon name="ai" size={24} color={colors.textSecondary} />
                }
                iconTrailing={
                  isStructuring ? (
                    <ProgressIndicator color={colors.accentBrand} size={18} />
                  ) : (
                    chevron
                  )
                }
                onPress={canStructure ? handleStructure : undefined}
              />

              <View
                onLayout={(e) => {
                  const { y, height } = e.nativeEvent.layout;
                  setSlotBottom(y + height);
                }}
              >
                {saveButton}
              </View>
            </Animated.ScrollView>

            {floatSave && (
              <Animated.View
                testID={TestID.TranscriptionEditSaveBar}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.saveBar,
                  {
                    backgroundColor: colors.surfaceBackground,
                    transform: [{ translateY: saveBarTranslateY }],
                  },
                ]}
              >
                {saveButton}
              </Animated.View>
            )}
          </View>

          {!keyboardOpen && (
            <View
              style={{
                paddingBottom: insets.bottom,
                backgroundColor: colors.surfaceBackground,
              }}
            >
              <SubScreenNavbarActions actions={actions} />
            </View>
          )}
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
  // Clips the Save bar once it slides below the keyboard edge.
  viewport: {
    flex: 1,
    overflow: "hidden",
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: SAVE_BAR_GAP,
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
