import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, FlatList, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  EmptyStateView,
  HomeAppBar,
  HomeContent,
  Screen,
  SessionActionsSheet,
  SessionInputModal,
  SubScreenNavbar,
  type SubScreenNavbarAction,
  Toast,
  useToast,
} from "@/components";
import { Routes, TestID } from "@/constants";
import {
  useLocalization,
  useMicPermission,
  useSessionOperations,
} from "@/hooks";
import { Session } from "@/models";
import {
  useCreateSession,
  useExitSessionSelection,
  useIncognitoSession,
  useIsIncognitoMode,
  useIsSessionSelectionMode,
  useRenameSession,
  useSelectedSessionIds,
  useSelectedSessionIdsSet,
  useSessions,
  useSetRecordingCallbacks,
  useSetRecordingControlsEnabled,
  useSetRecordingControlsVisible,
  useShowGlobalTooltip,
  useStartRecording,
  useStopRecordingAndSave,
  useToggleSessionSelection,
} from "@/stores";
import { useTheme } from "@/theme";
import { FeatureFlag, getErrorMessage, logError } from "@/utils";

export default function HomeScreen() {
  const router = useRouter();
  const { loc } = useLocalization();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<FlatList<Session>>(null);

  const sessions = useSessions();
  const incognitoSession = useIncognitoSession();
  const createSession = useCreateSession();
  const { deleteSession } = useSessionOperations();
  const renameSession = useRenameSession();
  const isIncognitoMode = useIsIncognitoMode();
  const startTranscriptionRecording = useStartRecording();
  const stopRecordingAndSave = useStopRecordingAndSave();
  const isSessionSelectionMode = useIsSessionSelectionMode();
  const selectedSessionIdsSet = useSelectedSessionIdsSet();
  const selectedSessionIds = useSelectedSessionIds();
  const toggleSessionSelection = useToggleSessionSelection();
  const exitSessionSelection = useExitSessionSelection();
  const showGlobalTooltip = useShowGlobalTooltip();
  const setRecordingCallbacks = useSetRecordingCallbacks();
  const setRecordingControlsEnabled = useSetRecordingControlsEnabled();
  const setRecordingControlsVisible = useSetRecordingControlsVisible();
  const {
    show: showDeleteToast,
    hide: hideDeleteToast,
    toastState: deleteToastState,
  } = useToast();

  const [actionsSession, setActionsSession] = useState<Session | null>(null);
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Session | null>(null);
  const [renameVisible, setRenameVisible] = useState(false);

  const {
    show: showAlertToast,
    hide: hideAlertToast,
    toastState: alertToastState,
  } = useToast();

  const ensureMicPermission = useMicPermission(showAlertToast, hideAlertToast);

  const [tooltipShouldDisappear, setTooltipShouldDisappear] = useState(false);

  // Incognito sessions live outside `sessions`; treat them as non-empty so the
  // tooltip unmounts during the record→session-screen transition. In incognito
  // mode, IncognitoEmptyState owns the empty-state messaging instead.
  const effectivelyEmpty =
    sessions.length === 0 && !incognitoSession && !isIncognitoMode;

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isSessionSelectionMode) {
          exitSessionSelection();
          return true;
        }
        return false;
      },
    );

    return () => backHandler.remove();
  }, [isSessionSelectionMode, exitSessionSelection]);

  const scrollToTop = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  const handleTooltipDisappearComplete = useCallback(() => {
    setTooltipShouldDisappear(false);
  }, []);

  const handleSessionLongPress = useCallback(
    async (session: Session) => {
      if (!isSessionSelectionMode) {
        toggleSessionSelection(session.id);
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch {
          // Haptics not supported
        }
      }
    },
    [isSessionSelectionMode, toggleSessionSelection],
  );

  const handleSessionTap = useCallback(
    (sessionId: string) => {
      if (isSessionSelectionMode) {
        toggleSessionSelection(sessionId);
      } else {
        router.push(Routes.session(sessionId));
      }
    },
    [isSessionSelectionMode, toggleSessionSelection, router],
  );

  const handleRecordingStartRef = useRef<(() => Promise<void>) | null>(null);
  const handleRecordingStopRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    handleRecordingStartRef.current = async () => {
      if (!(await ensureMicPermission())) return;

      if (effectivelyEmpty) {
        setTooltipShouldDisappear(true);
        // wait for tooltip animation to finish (270ms)
        await new Promise((resolve) => setTimeout(resolve, 270));
      }

      try {
        const sessionId = await createSession(
          undefined,
          isIncognitoMode,
          loc.recordingPrefix,
          loc.incognitoModeTitle,
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

        scrollToTop();
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
      } finally {
        setTooltipShouldDisappear(false);
      }
    };
  }, [
    effectivelyEmpty,
    isIncognitoMode,
    loc,
    router,
    ensureMicPermission,
    showGlobalTooltip,
    showAlertToast,
    createSession,
    startTranscriptionRecording,
    scrollToTop,
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
      setRecordingCallbacks(onStart, onStop);
      setRecordingControlsEnabled(true);
      // No cleanup - next screen will set its own callbacks
    }, [setRecordingCallbacks, setRecordingControlsEnabled]),
  );

  const performDelete = useCallback(
    async (sessionIds: string[]) => {
      const count = sessionIds.length;
      hideDeleteToast();

      try {
        await Promise.all(
          sessionIds.map((sessionId) => deleteSession(sessionId)),
        );
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.session,
          message: "Failed to delete sessions",
        });
      }

      exitSessionSelection();
      showGlobalTooltip(loc.homeSessionsDeleted(count));
    },
    [
      deleteSession,
      exitSessionSelection,
      hideDeleteToast,
      showGlobalTooltip,
      loc,
    ],
  );

  const confirmDelete = useCallback(
    (sessionIds: string[]) => {
      if (sessionIds.length === 0) return;
      showDeleteToast({
        title: loc.homeDeleteSelectedSessionsTitle,
        message: loc.homeDeleteSelectedSessionsMessage(sessionIds.length),
        primaryButtonText: loc.delete,
        onPrimaryButtonTap: () => performDelete(sessionIds),
        secondaryButtonText: loc.cancel,
        onSecondaryButtonTap: hideDeleteToast,
        variant: "info",
      });
    },
    [showDeleteToast, hideDeleteToast, performDelete, loc],
  );

  const handleDeleteSelected = useCallback(() => {
    confirmDelete(selectedSessionIds);
  }, [confirmDelete, selectedSessionIds]);

  const handleRenameSelected = useCallback(() => {
    if (selectedSessionIds.length !== 1) return;
    const target = sessions.find((s) => s.id === selectedSessionIds[0]);
    if (!target) return;
    setRenameTarget(target);
    setRenameVisible(true);
  }, [selectedSessionIds, sessions]);

  const handleSessionMorePress = useCallback((session: Session) => {
    setActionsSession(session);
    setActionsSheetVisible(true);
  }, []);

  const handleActionsRename = useCallback(() => {
    if (!actionsSession) return;
    const target = actionsSession;
    setActionsSheetVisible(false);
    setRenameTarget(target);
    setRenameVisible(true);
  }, [actionsSession]);

  const handleActionsDelete = useCallback(() => {
    if (!actionsSession) return;
    const targetId = actionsSession.id;
    setActionsSheetVisible(false);
    confirmDelete([targetId]);
  }, [actionsSession, confirmDelete]);

  const handleRenameSubmit = useCallback(
    async (newName: string) => {
      if (!renameTarget) return;
      try {
        await renameSession(renameTarget.id, newName);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.session,
          message: "Failed to rename session",
        });
      }
      setRenameVisible(false);
      if (isSessionSelectionMode) {
        exitSessionSelection();
      }
    },
    [renameTarget, renameSession, isSessionSelectionMode, exitSessionSelection],
  );

  const navbarActions = useMemo<SubScreenNavbarAction[]>(
    () => [
      {
        key: "delete",
        icon: "trash",
        label: loc.delete,
        color: theme.colors.accentDanger,
        disabled: selectedSessionIds.length === 0,
        onPress: handleDeleteSelected,
      },
      {
        key: "rename",
        icon: "edit",
        label: loc.rename,
        disabled: selectedSessionIds.length !== 1,
        onPress: handleRenameSelected,
      },
    ],
    [
      handleDeleteSelected,
      handleRenameSelected,
      loc.delete,
      loc.rename,
      selectedSessionIds.length,
      theme.colors.accentDanger,
    ],
  );

  useEffect(() => {
    setRecordingControlsVisible(!isSessionSelectionMode);
  }, [isSessionSelectionMode, setRecordingControlsVisible]);

  return (
    <Screen>
      <HomeAppBar
        selectionMode={isSessionSelectionMode}
        selectionTitle={loc.selectedCount(selectedSessionIds.length)}
        onExitSelectionPressed={exitSessionSelection}
      />

      <HomeContent
        selectionMode={isSessionSelectionMode}
        selectedSessionIds={selectedSessionIdsSet}
        onSessionLongPress={handleSessionLongPress}
        onSessionTap={handleSessionTap}
        onSelectionToggle={toggleSessionSelection}
        onSessionMorePress={handleSessionMorePress}
        scrollRef={scrollRef}
      />

      {effectivelyEmpty && (
        <View
          style={[styles.tooltipContainer, { bottom: insets.bottom + 112 }]}
        >
          <EmptyStateView
            message={loc.emptySessionsMessage}
            shouldDisappear={tooltipShouldDisappear}
            onDisappearComplete={handleTooltipDisappearComplete}
          />
        </View>
      )}

      {actionsSession && (
        <SessionActionsSheet
          testID={TestID.SessionActionsSheet}
          visible={actionsSheetVisible}
          title={actionsSession.name}
          createdAt={actionsSession.timestamp}
          modifiedAt={actionsSession.lastModified}
          onRename={handleActionsRename}
          onDelete={handleActionsDelete}
          onDismiss={() => setActionsSheetVisible(false)}
        />
      )}

      {renameTarget && (
        <SessionInputModal
          visible={renameVisible}
          title={loc.sessionRenameTitle}
          buttonText={loc.save}
          initialValue={renameTarget.name}
          onSubmit={handleRenameSubmit}
          onCancel={() => setRenameVisible(false)}
        />
      )}

      <SubScreenNavbar
        visible={isSessionSelectionMode}
        actions={navbarActions}
      />

      <Toast {...deleteToastState} />
      <Toast {...alertToastState} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tooltipContainer: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
