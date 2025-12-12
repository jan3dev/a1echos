import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  SessionAppBar,
  SessionInputModal,
  Toast,
  TranscriptionContentView,
  useToast,
} from '@/components';
import { useLocalization, usePermissions, useSessionOperations } from '@/hooks';
import { ModelType, Transcription } from '@/models';
import { shareService } from '@/services';
import {
  useDeleteTranscriptions,
  useExitTranscriptionSelection,
  useFindSessionById,
  useIncognitoSession,
  useIsRecording,
  useIsTranscriptionSelectionMode,
  useLivePreview,
  useRenameSession,
  useSelectAllTranscriptions,
  useSelectedModelType,
  useSelectedTranscriptionIdsSet,
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
} from '@/stores';
import { useTheme } from '@/theme';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const listRef = useRef<FlatList<Transcription>>(null) as React.RefObject<
    FlatList<Transcription>
  >;
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isCancellingEdit, setIsCancellingEdit] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showRenameModal, setShowRenameModal] = useState(false);

  const findSessionById = useFindSessionById();
  const renameSessionAction = useRenameSession();
  const switchSession = useSwitchSession();
  const { endIncognitoSession } = useSessionOperations();
  const selectedModelType = useSelectedModelType();
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
    [findSessionById, id, sessions, incognitoSession]
  );

  const selectionMode = useIsTranscriptionSelectionMode();
  const selectedIds = useSelectedTranscriptionIdsSet();
  const hasSelectedItems = selectedIds.size > 0;

  const toggleTranscriptionSelection = useToggleTranscriptionSelection();
  const selectAllTranscriptionsAction = useSelectAllTranscriptions();
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
    [selectionMode, toggleTranscriptionSelection]
  );

  const selectAllTranscriptions = useCallback(() => {
    const ids = transcriptions.map((t) => t.id);
    selectAllTranscriptionsAction(ids);
  }, [transcriptions, selectAllTranscriptionsAction]);

  const deleteSelectedTranscriptions = useCallback(async () => {
    if (selectedIds.size === 0) {
      return { deleted: 0 };
    }

    const count = selectedIds.size;
    try {
      await deleteTranscriptions(selectedIds);
      return { deleted: count };
    } catch (error) {
      console.error('Failed to delete transcriptions:', error);
      throw error;
    } finally {
      exitSelectionMode();
    }
  }, [selectedIds, deleteTranscriptions, exitSelectionMode]);

  const copyAllTranscriptions = useCallback(async () => {
    if (transcriptions.length === 0) {
      return false;
    }

    const text = transcriptions.map((t) => t.text).join('\n\n');

    try {
      await Clipboard.setStringAsync(text);
      return true;
    } catch (error) {
      console.error('Failed to copy transcriptions:', error);
      return false;
    }
  }, [transcriptions]);

  const shareSelectedTranscriptions = useCallback(async () => {
    if (selectedIds.size === 0) {
      return false;
    }

    const selectedTranscriptions = transcriptions.filter((t) =>
      selectedIds.has(t.id)
    );

    if (selectedTranscriptions.length === 0) {
      return false;
    }

    try {
      await shareService.shareTranscriptions(selectedTranscriptions);
      exitSelectionMode();
      return true;
    } catch (error) {
      console.error('Failed to share transcriptions:', error);
      return false;
    }
  }, [selectedIds, transcriptions, exitSelectionMode]);

  const {
    show: showDeleteToast,
    hide: hideDeleteToast,
    toastState: deleteToastState,
  } = useToast();

  const { hasPermission, requestPermission, canAskAgain, openSettings } =
    usePermissions();

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      if (!session) {
        showToast(loc.sessionNotFound, 'error');
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
      (selectedModelType === ModelType.WHISPER_REALTIME && livePreview);

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
  }, [isRecording, selectedModelType, livePreview, transcriptions.length]);

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
    const unsubscribe = navigation.addListener('beforeRemove', async (e) => {
      if (isRecording) {
        e.preventDefault();
        await stopRecordingAndSave();
        // Use router for safe navigation
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
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
            router.replace('/');
          }
        } catch (error) {
          console.error('Failed to end incognito session:', error);
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
      'hardwareBackPress',
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
      }
    );

    return () => backHandler.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isRecording,
    isEditing,
    selectionMode,
    exitSelectionMode,
    stopRecordingAndSave,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isRecording,
    isEditing,
    selectionMode,
    exitSelectionMode,
    router,
    stopRecordingAndSave,
  ]);

  const handleCancelEdit = useCallback(() => {
    setIsCancellingEdit(true);
    Keyboard.dismiss();
    setIsEditing(false);
  }, []);

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
    [id, renameSessionAction]
  );

  const handleCopyAllPressed = useCallback(async () => {
    if (transcriptions.length === 0) {
      showToast(loc.noTranscriptionsToCopy, 'warning');
      return;
    }

    try {
      const success = await copyAllTranscriptions();
      if (success) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        // Only show toast on iOS or Android < 12 (Android 12+ has native clipboard feedback)
        if (
          Platform.OS === 'ios' ||
          (Platform.OS === 'android' && Number(Platform.Version) < 31)
        ) {
          showToast(loc.allTranscriptionsCopied, 'success');
        }
      } else {
        showToast(loc.copyFailed('Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to copy all transcriptions:', error);
      showToast(
        loc.copyFailed(error instanceof Error ? error.message : String(error)),
        'error'
      );
    }
  }, [transcriptions.length, copyAllTranscriptions, showToast, loc]);

  const handleLanguageFlagPressed = useCallback(() => {
    router.push('/settings/language');
  }, [router]);

  const handleSelectAllPressed = useCallback(() => {
    selectAllTranscriptions();
  }, [selectAllTranscriptions]);

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
      variant: 'informative',
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

  const handleSharePressed = useCallback(async () => {
    if (!hasSelectedItems) {
      showToast(loc.noTranscriptionsSelectedToShare, 'warning');
      return;
    }

    try {
      const success = await shareSelectedTranscriptions();
      if (success) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      }
    } catch (error) {
      console.error('Failed to share transcriptions:', error);
      showToast(
        loc.shareFailed(error instanceof Error ? error.message : String(error)),
        'error'
      );
    }
  }, [hasSelectedItems, shareSelectedTranscriptions, showToast, loc]);

  const handleTranscriptionTap = useCallback(
    (transcriptionId: string) => {
      if (selectionMode) {
        toggleTranscriptionSelection(transcriptionId);
      }
    },
    [selectionMode, toggleTranscriptionSelection]
  );

  const handleTranscriptionLongPress = useCallback(
    (transcriptionId: string) => {
      handleLongPress(transcriptionId);
    },
    [handleLongPress]
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

  handleRecordingStartRef.current = async () => {
    if (!hasPermission) {
      if (canAskAgain) {
        const granted = await requestPermission();
        if (!granted) {
          showToast(loc.homeMicrophoneDenied, 'error');
          return;
        }
      } else {
        showToast(loc.homeMicrophonePermissionRequired, 'warning');
        openSettings();
        return;
      }
    }

    const success = await startRecording();
    if (!success) {
      showToast(loc.homeFailedStartRecording, 'error');
    }
  };

  handleRecordingStopRef.current = async () => {
    await stopRecordingAndSave();
  };

  const controlsEnabled = !isInitializing || isRecording;

  useFocusEffect(
    useCallback(() => {
      const onStart = () => handleRecordingStartRef.current?.();
      const onStop = () => handleRecordingStopRef.current?.();
      setRecordingCallbacks(onStart, onStop);
      // No cleanup - next screen will set its own callbacks
    }, [setRecordingCallbacks])
  );

  useEffect(() => {
    setRecordingControlsEnabled(controlsEnabled);
  }, [setRecordingControlsEnabled, controlsEnabled]);

  useEffect(() => {
    setRecordingControlsVisible(!selectionMode);
  }, [setRecordingControlsVisible, selectionMode]);

  const sessionName = session?.name ?? '';
  const isIncognito = session?.isIncognito ?? false;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <SessionAppBar
        sessionName={sessionName}
        selectionMode={selectionMode}
        editMode={isEditing}
        isIncognitoSession={isIncognito}
        onBackPressed={handleBackPressed}
        onTitlePressed={handleTitlePressed}
        onCopyAllPressed={handleCopyAllPressed}
        onLanguageFlagPressed={handleLanguageFlagPressed}
        onSelectAllPressed={handleSelectAllPressed}
        onDeleteSelectedPressed={handleDeleteSelectedPressed}
        onCancelEditPressed={handleCancelEdit}
        onSaveEditPressed={handleSaveEdit}
      />

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
        />
      )}

      {selectionMode && (
        <View
          style={[styles.shareButtonContainer, { bottom: insets.bottom + 32 }]}
        >
          <Button.primary
            text={loc.share}
            onPress={handleSharePressed}
            enabled={hasSelectedItems}
          />
        </View>
      )}

      <SessionInputModal
        visible={showRenameModal}
        title={loc.sessionRenameTitle}
        buttonText={loc.save}
        initialValue={sessionName}
        onSubmit={handleRenameSubmit}
        onCancel={() => setShowRenameModal(false)}
      />

      <Toast {...deleteToastState} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  shareButtonContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
});
