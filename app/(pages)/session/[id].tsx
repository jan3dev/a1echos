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
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import {
  AppBarBlurTarget,
  Screen,
  SessionAppBar,
  SessionInputModal,
  SubScreenNavbar,
  type SubScreenNavbarAction,
  Toast,
  TranscriptionContentView,
  useToast,
} from "@/components";
import { Routes } from "@/constants";
import {
  useLocalization,
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
  useRenameSession,
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
import { FeatureFlag, getErrorMessage, logError } from "@/utils";

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

  const [isEditing, setIsEditing] = useState(false);
  const [isCancellingEdit, setIsCancellingEdit] = useState(false);
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
  const deleteTranscriptions = useDeleteTranscriptions();

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

  const copySelectedTranscriptions = useCallback(async () => {
    if (selectedIds.size === 0) {
      return false;
    }

    const text = transcriptions
      .filter((t) => selectedIds.has(t.id))
      .map((t) => t.text)
      .join("\n\n");

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
  }, [selectedIds, transcriptions]);

  const shareSelectedTranscriptions = useCallback(async () => {
    if (selectedIds.size === 0) {
      return false;
    }

    const selectedTranscriptions = transcriptions.filter((t) =>
      selectedIds.has(t.id),
    );

    if (selectedTranscriptions.length === 0) {
      return false;
    }

    try {
      await shareService.shareTranscriptions(selectedTranscriptions);
      exitSelectionMode();
      return true;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to share transcriptions",
      });
      return false;
    }
  }, [selectedIds, transcriptions, exitSelectionMode]);

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

  const handleCancelEdit = useCallback(() => {
    setIsCancellingEdit(true);
    Keyboard.dismiss();
    setIsEditing(false);
  }, []);

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
        if (isEditing) {
          handleCancelEdit();
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
    isEditing,
    selectionMode,
    exitSelectionMode,
    stopRecordingAndSave,
    handleCancelEdit,
    router,
  ]);

  const handleBackPressed = useCallback(() => {
    if (isRecording) {
      stopRecordingAndSave().then(() => router.back());
      return;
    }
    if (isEditing) {
      handleCancelEdit();
      return;
    }
    if (selectionMode) {
      exitSelectionMode();
      return;
    }
    router.back();
  }, [
    isRecording,
    isEditing,
    selectionMode,
    exitSelectionMode,
    router,
    stopRecordingAndSave,
    handleCancelEdit,
  ]);

  const handleSaveEdit = useCallback(() => {
    Keyboard.dismiss();
    setIsEditing(false);
  }, []);

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

  const handleLanguageFlagPressed = useCallback(() => {
    router.push(Routes.settingsLanguage);
  }, [router]);

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

  const handleCopySelectedPressed = useCallback(async () => {
    if (!hasSelectedItems) return;

    try {
      const success = await copySelectedTranscriptions();
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
    hasSelectedItems,
    copySelectedTranscriptions,
    showGlobalTooltip,
    showAlertToast,
    exitSelectionMode,
    loc,
  ]);

  const handleSharePressed = useCallback(async () => {
    try {
      const success = await shareSelectedTranscriptions();
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
  }, [shareSelectedTranscriptions, showToast, loc]);

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

  const handleEditStart = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleEditEnd = useCallback(() => {
    setIsEditing(false);
    setIsCancellingEdit(false);
  }, []);

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
      setRecordingCallbacks(onStart, onStop);
      // No cleanup - next screen will set its own callbacks
    }, [setRecordingCallbacks]),
  );

  useEffect(() => {
    setRecordingControlsEnabled(controlsEnabled);
  }, [setRecordingControlsEnabled, controlsEnabled]);

  useEffect(() => {
    setRecordingControlsVisible(!selectionMode && !isEditing);
  }, [setRecordingControlsVisible, selectionMode, isEditing]);

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
        onPress: handleSharePressed,
      },
    ],
    [
      handleCopySelectedPressed,
      handleDeleteSelectedPressed,
      handleSharePressed,
      hasSelectedItems,
      loc.copy,
      loc.delete,
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
              onEditStart={handleEditStart}
              onEditEnd={handleEditEnd}
              isCancellingEdit={isCancellingEdit}
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
        editMode={isEditing}
        isIncognitoSession={isIncognito}
        onBackPressed={handleBackPressed}
        onTitlePressed={handleTitlePressed}
        onLanguageFlagPressed={handleLanguageFlagPressed}
        onMorePressed={enterSelectionMode}
        onExitSelectionPressed={exitSelectionMode}
        onCancelEditPressed={handleCancelEdit}
        onSaveEditPressed={handleSaveEdit}
        blurTarget={blurTargetRef}
        scrolled={scrolled}
      />

      <SubScreenNavbar
        visible={selectionMode}
        actions={navbarActions}
        blurTarget={blurTargetRef}
        scrolled={contentBelow}
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
});
