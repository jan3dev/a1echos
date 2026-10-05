import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import {
  AppBarBlurTarget,
  Button,
  Icon,
  Screen,
  SessionActionsSheet,
  SessionAppBar,
  SessionInputModal,
  SubScreenNavbar,
  type SubScreenNavbarAction,
  Toast,
  TranscriptionContentView,
  useToast,
} from "@/components";
import { AppConstants, Routes, TestID } from "@/constants";
import {
  useLocalization,
  useFileImport,
  useMicPermission,
  useScrollSurface,
  useSessionOperations,
} from "@/hooks";
import { Transcription, TranscriptionMode } from "@/models";
import { shareService } from "@/services";
import {
  useDeleteTranscriptions,
  useEnterTranscriptionSelection,
  useExitTranscriptionSelection,
  useFindSessionById,
  useIncognitoSession,
  useIsRecording,
  useIsTranscriptionSelectionMode,
  useLivePreview,
  useMergeTranscriptions,
  useRenameSession,
  useSelectAllTranscriptions,
  useSelectedTranscriptionIdsSet,
  useSelectedTranscriptionMode,
  useSessionStore,
  useSessionTranscriptions,
  useSetRecordingCallbacks,
  useSetRecordingControlsEnabled,
  useSetRecordingControlsVisible,
  useShowGlobalTooltip,
  useShowToast,
  useStartRecording,
  useStopRecordingAndSave,
  useSwitchSession,
  useToggleTranscriptionSelection,
} from "@/stores";
import { useTheme } from "@/theme";
import { delay, FeatureFlag, getErrorMessage, logError } from "@/utils";

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { loc } = useLocalization();
  const { theme } = useTheme();

  const listRef = useRef<FlatList<Transcription>>(null) as RefObject<
    FlatList<Transcription>
  >;
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTargetRef = useRef<View>(null);
  const {
    scrolled,
    contentBelow,
    onScroll,
    onContentSizeChange,
    onLayout,
    reset,
  } = useScrollSurface();

  const [isInitializing, setIsInitializing] = useState(true);
  const [showRenameModal, setShowRenameModal] = useState(false);

  const findSessionById = useFindSessionById();
  const renameSessionAction = useRenameSession();
  const switchSession = useSwitchSession();
  const { endIncognitoSession } = useSessionOperations();
  const selectedMode = useSelectedTranscriptionMode();
  const isRecording = useIsRecording();
  const startRecording = useStartRecording();
  const stopRecordingAndSave = useStopRecordingAndSave();
  const showToast = useShowToast();
  const showGlobalTooltip = useShowGlobalTooltip();
  const transcriptions = useSessionTranscriptions(id);
  const livePreview = useLivePreview();
  const setRecordingCallbacks = useSetRecordingCallbacks();
  const setRecordingControlsEnabled = useSetRecordingControlsEnabled();
  const setRecordingControlsVisible = useSetRecordingControlsVisible();

  const sessions = useSessionStore((s) => s.sessions);
  const incognitoSession = useIncognitoSession();
  const session = useMemo(
    () => findSessionById(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [findSessionById, id, sessions, incognitoSession],
  );

  const selectionMode = useIsTranscriptionSelectionMode();
  const selectedIds = useSelectedTranscriptionIdsSet();
  const hasSelectedItems = selectedIds.size > 0;

  const toggleTranscriptionSelection = useToggleTranscriptionSelection();
  const enterSelectionMode = useEnterTranscriptionSelection();
  const exitSelectionMode = useExitTranscriptionSelection();
  const selectAllTranscriptions = useSelectAllTranscriptions();
  const deleteTranscriptions = useDeleteTranscriptions();
  const mergeTranscriptions = useMergeTranscriptions();

  const handleLongPress = useCallback(
    async (transcriptionId: string) => {
      if (!selectionMode) {
        toggleTranscriptionSelection(transcriptionId);
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch {
          // Haptics not supported
        }
      } else {
        toggleTranscriptionSelection(transcriptionId);
      }
    },
    [selectionMode, toggleTranscriptionSelection],
  );

  const deleteSelectedTranscriptions = useCallback(async () => {
    if (selectedIds.size === 0) {
      return { deleted: 0 };
    }

    const count = selectedIds.size;
    try {
      await deleteTranscriptions(selectedIds);
      return { deleted: count };
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to delete transcriptions",
      });
      throw error;
    } finally {
      exitSelectionMode();
    }
  }, [selectedIds, deleteTranscriptions, exitSelectionMode]);

  const targetTranscriptions = useMemo(
    () =>
      selectionMode
        ? transcriptions.filter((t) => selectedIds.has(t.id))
        : transcriptions,
    [selectionMode, transcriptions, selectedIds],
  );

  const copyTargetTranscriptions = useCallback(async () => {
    const text = targetTranscriptions.map((t) => t.text).join("\n\n");

    if (!text) return false;

    try {
      await Clipboard.setStringAsync(text);
      return true;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to copy selected transcriptions",
      });
      return false;
    }
  }, [targetTranscriptions]);

  const shareTargetTranscriptions = useCallback(async () => {
    if (targetTranscriptions.length === 0) {
      return false;
    }

    try {
      await shareService.shareTranscriptions(targetTranscriptions);
      exitSelectionMode();
      return true;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to share transcriptions",
      });
      return false;
    }
  }, [targetTranscriptions, exitSelectionMode]);

  const {
    show: showDeleteToast,
    hide: hideDeleteToast,
    toastState: deleteToastState,
  } = useToast();

  const {
    show: showAlertToast,
    hide: hideAlertToast,
    toastState: alertToastState,
  } = useToast();

  const ensureMicPermission = useMicPermission(showAlertToast, hideAlertToast);
  const handleUpload = useFileImport({ showAlertToast, sessionId: id });

  // Clear stale app-bar glass when the list isn't shown (loading/error/empty
  // all coincide with no transcriptions): no scroll event fires to reset it.
  useEffect(() => {
    if (transcriptions.length === 0) reset();
  }, [transcriptions.length, reset]);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      if (!session) {
        showToast(loc.sessionNotFound, "error");
        router.back();
        return;
      }
      await switchSession(id);
      setIsInitializing(false);
    };
    initSession();
  }, [id, session, switchSession, showToast, loc.sessionNotFound, router]);

  // Auto-scroll to bottom during recording
  useEffect(() => {
    const shouldScroll =
      isRecording ||
      (selectedMode === TranscriptionMode.REALTIME && livePreview);

    if (!shouldScroll) return;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollToEnd({ animated: true });
      }
    }, 50);

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isRecording, selectedMode, livePreview, transcriptions.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      exitSelectionMode();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [exitSelectionMode]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", async (e) => {
      if (isRecording) {
        e.preventDefault();
        await stopRecordingAndSave();
        // Use router for safe navigation
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace(Routes.home);
        }
        return;
      }
      if (session?.isIncognito) {
        e.preventDefault();
        try {
          await endIncognitoSession();
          // Use router for safe navigation
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace(Routes.home);
          }
        } catch (error) {
          logError(error, {
            flag: FeatureFlag.session,
            message: "Failed to end incognito session",
          });
        }
      }
    });

    return unsubscribe;
  }, [
    navigation,
    router,
    isRecording,
    stopRecordingAndSave,
    session?.isIncognito,
    endIncognitoSession,
  ]);

  // Handle back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isRecording) {
          stopRecordingAndSave();
          router.back();
          return true;
        }
        if (selectionMode) {
          exitSelectionMode();
          return true;
        }
        return false;
      },
    );

    return () => backHandler.remove();
  }, [
    isRecording,
    selectionMode,
    exitSelectionMode,
    stopRecordingAndSave,
    router,
  ]);

  const handleBackPressed = useCallback(() => {
    if (isRecording) {
      stopRecordingAndSave().then(() => router.back());
      return;
    }
    if (selectionMode) {
      exitSelectionMode();
      return;
    }
    router.back();
  }, [
    isRecording,
    selectionMode,
    exitSelectionMode,
    router,
    stopRecordingAndSave,
  ]);

  const handleTitlePressed = useCallback(() => {
    if (!session?.isIncognito) {
      setShowRenameModal(true);
    }
  }, [session?.isIncognito]);

  const handleRenameSubmit = useCallback(
    async (newName: string) => {
      if (id && newName.trim()) {
        await renameSessionAction(id, newName.trim());
      }
      setShowRenameModal(false);
    },
    [id, renameSessionAction],
  );

  const handleDeleteSelectedPressed = useCallback(() => {
    if (!hasSelectedItems) return;

    const count = selectedIds.size;
    showDeleteToast({
      title: loc.sessionDeleteTranscriptionsTitle,
      message: loc.sessionDeleteTranscriptionsMessage(count),
      primaryButtonText: loc.delete,
      onPrimaryButtonTap: async () => {
        hideDeleteToast();
        const result = await deleteSelectedTranscriptions();
        if (result.deleted > 0) {
          showGlobalTooltip(loc.sessionTranscriptionsDeleted(result.deleted));
        }
      },
      secondaryButtonText: loc.cancel,
      onSecondaryButtonTap: hideDeleteToast,
      variant: "info",
    });
  }, [
    hasSelectedItems,
    selectedIds.size,
    showDeleteToast,
    hideDeleteToast,
    deleteSelectedTranscriptions,
    showGlobalTooltip,
    loc,
  ]);

  const handleMergeSelectedPressed = useCallback(async () => {
    const count = selectedIds.size;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try {
      const merge = mergeTranscriptions(selectedIds);
      exitSelectionMode();
      await merge;
      showGlobalTooltip(loc.sessionTranscriptionsMerged(count));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      showAlertToast({
        title: loc.mergeFailedTitle,
        message: getErrorMessage(error),
        variant: "error",
      });
    }
  }, [
    selectedIds,
    mergeTranscriptions,
    exitSelectionMode,
    showGlobalTooltip,
    showAlertToast,
    loc,
  ]);

  const handleCopySelectedPressed = useCallback(async () => {
    if (selectionMode && !hasSelectedItems) return;

    try {
      const success = await copyTargetTranscriptions();
      if (success) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        if (
          Platform.OS === "ios" ||
          (Platform.OS === "android" && Number(Platform.Version) < 31)
        ) {
          showGlobalTooltip(loc.allTranscriptionsCopied);
        }
        exitSelectionMode();
      } else {
        showAlertToast({
          title: loc.copyFailedTitle,
          message: "Unknown error",
          variant: "error",
        });
      }
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to copy selected transcriptions",
      });
      showAlertToast({
        title: loc.copyFailedTitle,
        message: getErrorMessage(error),
        variant: "error",
      });
    }
  }, [
    selectionMode,
    hasSelectedItems,
    copyTargetTranscriptions,
    showGlobalTooltip,
    showAlertToast,
    exitSelectionMode,
    loc,
  ]);

  const handleSharePressed = useCallback(async () => {
    try {
      const success = await shareTargetTranscriptions();
      if (success) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      }
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to share transcriptions",
      });
      showToast(
        loc.shareFailed(error instanceof Error ? error.message : String(error)),
        "error",
      );
    }
  }, [shareTargetTranscriptions, showToast, loc]);

  const [shareSheetVisible, setShareSheetVisible] = useState(false);

  const handleDownloadPressed = useCallback(async () => {
    if (!session || targetTranscriptions.length === 0) return;
    try {
      const saved = await shareService.saveSessionsMarkdown([
        { session, transcriptions: targetTranscriptions },
      ]);
      if (!saved) return;
      showGlobalTooltip(loc.markdownSaved);
      exitSelectionMode();
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to save transcriptions as markdown",
      });
      showGlobalTooltip(loc.markdownSaveFailed);
    }
  }, [
    targetTranscriptions,
    session,
    showGlobalTooltip,
    exitSelectionMode,
    loc,
  ]);

  const fromShareSheet = useCallback(
    (action: () => Promise<void>, waitForDismiss = true) =>
      async () => {
        setShareSheetVisible(false);
        if (waitForDismiss) await delay(AppConstants.SHEET_DISMISS_MS);
        await action();
      },
    [],
  );

  const handleTranscriptionTap = useCallback(
    (transcriptionId: string) => {
      if (selectionMode) {
        toggleTranscriptionSelection(transcriptionId);
      }
    },
    [selectionMode, toggleTranscriptionSelection],
  );

  const handleTranscriptionLongPress = useCallback(
    (transcriptionId: string) => {
      handleLongPress(transcriptionId);
    },
    [handleLongPress],
  );

  const handleTranscriptionEdit = useCallback(
    (transcriptionId: string) =>
      router.push(Routes.transcriptionEdit(transcriptionId)),
    [router],
  );

  const handleRecordingStartRef = useRef<(() => Promise<void>) | null>(null);
  const handleRecordingStopRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    handleRecordingStartRef.current = async () => {
      if (!(await ensureMicPermission())) return;

      const success = await startRecording();
      if (!success) {
        showGlobalTooltip(
          loc.homeFailedStartRecording,
          "normal",
          undefined,
          true,
        );
      }
    };
  }, [loc, ensureMicPermission, showGlobalTooltip, startRecording]);

  useEffect(() => {
    handleRecordingStopRef.current = async () => {
      await stopRecordingAndSave();
    };
  }, [stopRecordingAndSave]);

  const controlsEnabled = !isInitializing || isRecording;

  useFocusEffect(
    useCallback(() => {
      const onStart = () => handleRecordingStartRef.current?.();
      const onStop = () => handleRecordingStopRef.current?.();
      setRecordingCallbacks(onStart, onStop, blurTargetRef);
      // No cleanup - next screen will set its own callbacks
    }, [setRecordingCallbacks]),
  );

  useEffect(() => {
    setRecordingControlsEnabled(controlsEnabled);
  }, [setRecordingControlsEnabled, controlsEnabled]);

  useEffect(() => {
    setRecordingControlsVisible(!selectionMode);
  }, [setRecordingControlsVisible, selectionMode]);

  const navbarActions = useMemo<SubScreenNavbarAction[]>(
    () => [
      {
        key: "delete",
        icon: "trash",
        label: loc.delete,
        color: theme.colors.accentDanger,
        disabled: !hasSelectedItems,
        onPress: handleDeleteSelectedPressed,
      },
      ...(selectedIds.size >= 2 && !isRecording
        ? [
            {
              key: "merge",
              icon: "blend",
              label: loc.merge,
              onPress: handleMergeSelectedPressed,
            },
          ]
        : []),
      {
        key: "copy",
        icon: "copy",
        label: loc.copy,
        disabled: !hasSelectedItems,
        onPress: handleCopySelectedPressed,
      },
      {
        key: "share",
        icon: "export",
        label: loc.share,
        disabled: !hasSelectedItems,
        onPress: () => setShareSheetVisible(true),
      },
    ],
    [
      handleCopySelectedPressed,
      handleDeleteSelectedPressed,
      handleMergeSelectedPressed,
      hasSelectedItems,
      isRecording,
      selectedIds.size,
      loc.copy,
      loc.delete,
      loc.merge,
      loc.share,
      theme.colors.accentDanger,
    ],
  );

  const sessionName = session?.name ?? "";
  const isIncognito = session?.isIncognito ?? false;

  return (
    <Screen>
      {/* Content (and its blur target) renders before the bars so the Android
          BlurTargetView ref is populated by the time the bars' BlurView mounts
          and resolves its `blurTarget`. The bars float on top via absolute
          positioning + zIndex, so JSX order doesn't affect what paints above. */}
      <AppBarBlurTarget targetRef={blurTargetRef} style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {!isInitializing && (
            <TranscriptionContentView
              listRef={listRef}
              selectionMode={selectionMode}
              selectedTranscriptionIds={selectedIds}
              onTranscriptionTap={handleTranscriptionTap}
              onTranscriptionLongPress={handleTranscriptionLongPress}
              onTranscriptionEdit={handleTranscriptionEdit}
              header={
                selectionMode ? undefined : (
                  <View style={styles.quickActions}>
                    <Button.utility
                      testID={TestID.SessionUpload}
                      text={loc.homeUpload}
                      onPress={handleUpload}
                      icon={
                        <Icon
                          name="document_upload"
                          size={18}
                          color={theme.colors.textPrimary}
                        />
                      }
                    />
                    <Button.utility
                      testID={TestID.SessionShare}
                      text={loc.share}
                      enabled={transcriptions.length > 0}
                      onPress={() => setShareSheetVisible(true)}
                      icon={
                        <Icon
                          name="export"
                          size={18}
                          color={theme.colors.textPrimary}
                        />
                      }
                    />
                  </View>
                )
              }
              onScroll={onScroll}
              onContentSizeChange={onContentSizeChange}
              onLayout={onLayout}
            />
          )}
        </KeyboardAvoidingView>
      </AppBarBlurTarget>

      <SessionAppBar
        sessionName={sessionName}
        selectionMode={selectionMode}
        selectionTitle={loc.selectedCount(selectedIds.size)}
        isIncognitoSession={isIncognito}
        onBackPressed={handleBackPressed}
        onTitlePressed={handleTitlePressed}
        onMorePressed={enterSelectionMode}
        onExitSelectionPressed={exitSelectionMode}
        onSelectAllPressed={() =>
          selectAllTranscriptions(transcriptions.map((t) => t.id))
        }
        blurTarget={blurTargetRef}
        scrolled={scrolled}
      />

      <SubScreenNavbar
        visible={selectionMode}
        actions={navbarActions}
        blurTarget={blurTargetRef}
        scrolled={contentBelow}
      />

      <SessionActionsSheet
        testID={TestID.SessionShareSheet}
        visible={shareSheetVisible}
        onCopy={fromShareSheet(handleCopySelectedPressed, false)}
        onDownload={fromShareSheet(handleDownloadPressed)}
        onShare={fromShareSheet(handleSharePressed)}
        onDismiss={() => setShareSheetVisible(false)}
      />

      <SessionInputModal
        visible={showRenameModal}
        title={loc.sessionRenameTitle}
        buttonText={loc.save}
        initialValue={sessionName}
        onSubmit={handleRenameSubmit}
        onCancel={() => setShowRenameModal(false)}
      />

      <Toast {...deleteToastState} />
      <Toast {...alertToastState} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
});
