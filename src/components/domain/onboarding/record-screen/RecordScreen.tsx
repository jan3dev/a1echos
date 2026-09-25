import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalization } from "@/hooks";
import { Transcription, TranscriptionState } from "@/models";
import { darkColors, spacing } from "@/theme";

import { RecordingControlsView } from "../../../shared/recording-controls/RecordingControlsView";
import { Button } from "../../../ui/button/Button";
import {
  SubScreenNavbarActions,
  type SubScreenNavbarAction,
} from "../../../ui/sub-screen-navbar/SubScreenNavbar";
import { Text } from "../../../ui/text/Text";
import { TranscriptionItem } from "../../transcription/transcription-item/TranscriptionItem";
import { OnboardingHeader } from "../header/OnboardingHeader";

const TUTORIAL_STEP = 3;
const PREVIEW_ID = "onboarding_preview";

const BUSY_STATES = new Set([
  TranscriptionState.RECORDING_STARTING,
  TranscriptionState.RECORDING,
  TranscriptionState.STREAMING,
  TranscriptionState.TRANSCRIBING,
]);

const formatElapsed = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** Owns the 1s tick so it doesn't re-render the whole screen. */
const ElapsedTimer = ({
  capturing,
  testID,
}: {
  capturing: boolean;
  testID?: string;
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!capturing) return;
    const start = Date.now();
    setElapsed(0);
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [capturing]);

  return (
    <Text
      variant="body2"
      weight="medium"
      align="center"
      color={darkColors.textTertiary}
      style={[styles.timer, !capturing && styles.hidden]}
      accessibilityElementsHidden={!capturing}
      importantForAccessibility={capturing ? "auto" : "no-hide-descendants"}
      testID={testID}
    >
      {formatElapsed(elapsed)}
    </Text>
  );
};

export interface RecordScreenProps {
  state: TranscriptionState;
  isInitializing?: boolean;
  transcriptions: Transcription[];
  /** Realtime-mode text streamed while recording. */
  liveText?: string;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  onTranscriptionUpdate: (updated: Transcription) => void;
  onDelete: () => void;
  onCopy: () => void;
  onShare: () => void;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
  testID?: string;
}

/** Record in-app, then edit, copy, share or delete the result. */
export const RecordScreen = ({
  state,
  isInitializing = false,
  transcriptions,
  liveText,
  onRecordingStart,
  onRecordingStop,
  onTranscriptionUpdate,
  onDelete,
  onCopy,
  onShare,
  onBack,
  onSkip,
  onNext,
  testID,
}: RecordScreenProps) => {
  const insets = useSafeAreaInsets();
  const { loc } = useLocalization();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => new Date());
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;

  const busy = BUSY_STATES.has(state);
  const capturing =
    state === TranscriptionState.RECORDING ||
    state === TranscriptionState.STREAMING;
  const hasResult = !busy && transcriptions.length > 0;

  useEffect(() => {
    if (busy) setStartedAt(new Date());
  }, [busy]);

  const [title, subtitle] = hasResult
    ? [loc.onboardingTranscriptReadyTitle, loc.onboardingTranscriptReadySubtitle]
    : [loc.onboardingRecordTitle, loc.onboardingRecordSubtitle];

  const actions: SubScreenNavbarAction[] = [
    {
      key: "delete",
      icon: "trash",
      label: loc.delete,
      color: darkColors.accentDanger,
      onPress: () => {
        setEditingId(null);
        onDelete();
      },
      testID: childTestID("delete"),
    },
    {
      key: "copy",
      icon: "copy",
      label: loc.copy,
      onPress: onCopy,
      testID: childTestID("copy"),
    },
    {
      key: "share",
      icon: "export",
      label: loc.share,
      onPress: onShare,
      testID: childTestID("share"),
    },
  ];

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />
      <OnboardingHeader
        step={TUTORIAL_STEP}
        onBack={onBack}
        onSkip={onSkip}
        testID={testID}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.copy}>
          <Text
            variant="h4"
            weight="medium"
            align="center"
            color={darkColors.textPrimary}
          >
            {title}
          </Text>
          <Text
            variant="body1"
            weight="medium"
            align="center"
            color={darkColors.textSecondary}
          >
            {subtitle}
          </Text>
        </View>

        <View>
          {transcriptions.map((t) => (
            <TranscriptionItem
              key={t.id}
              transcription={t}
              colors={darkColors}
              isEditing={editingId === t.id}
              isAnyEditing={editingId !== null}
              onTap={() => setEditingId(t.id)}
              onStartEdit={() => setEditingId(t.id)}
              onEndEdit={() => setEditingId(null)}
              onTranscriptionUpdate={onTranscriptionUpdate}
            />
          ))}
          {busy && (
            <TranscriptionItem
              transcription={{
                id: PREVIEW_ID,
                sessionId: "",
                text: liveText ?? "",
                timestamp: startedAt,
                audioPath: "",
              }}
              colors={darkColors}
              isLivePreviewItem
              isWhisperRecording={!liveText}
            />
          )}
          {hasResult && (
            <SubScreenNavbarActions
              actions={actions}
              colors={darkColors}
              testID={childTestID("actions")}
            />
          )}
        </View>
      </ScrollView>

      {hasResult ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + spacing.md,
              paddingLeft: insets.left + spacing.md,
              paddingRight: insets.right + spacing.md,
            },
          ]}
        >
          <Button.primary
            testID={childTestID("next")}
            text={loc.onboardingNext}
            onPress={onNext}
          />
        </View>
      ) : (
        <View style={{ paddingBottom: insets.bottom }}>
          <ElapsedTimer capturing={capturing} testID={childTestID("timer")} />
          <RecordingControlsView
            state={state}
            isInitializing={isInitializing}
            onRecordingStart={onRecordingStart}
            onRecordingStop={onRecordingStop}
            colors={darkColors}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: darkColors.surfaceBackground,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  copy: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  footer: {
    paddingTop: spacing.md,
  },
  timer: {
    marginBottom: spacing.xs,
  },
  hidden: {
    opacity: 0,
  },
});
