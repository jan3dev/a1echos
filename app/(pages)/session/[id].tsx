import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
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
import { FeatureFlag, logError } from '@/utils';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const listRef = useRef<FlatList<Transcription>>(null) as RefObject<
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
      logError(error, {
        flag: FeatureFlag.transcription,
        message: 'Failed to delete transcriptions',
      });
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
      logError(error, {
        flag: FeatureFlag.transcription,
        message: 'Failed to copy transcriptions',
      });
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
      logError(error, {
        flag: FeatureFlag.transcription,
        message: 'Failed to share transcriptions',
      });
      return false;
    }
  }, [selectedIds, transcriptions, exitSelectionMode]);

  const {
    show: showDeleteToast,
    hide: hideDeleteToast,
    toastState: deleteToastState,
  } = useToast();

  const { hasPermission, requestPermission, openSettings } = usePermissions();

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
          logError(error, {
            flag: FeatureFlag.session,
            message: 'Failed to end incognito session',
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

  const copyAllEnabled = transcriptions.length > 0;

  const handleCopyAllPressed = useCallback(async () => {
    if (transcriptions.length === 0) {
      showGlobalTooltip(loc.noTranscriptionsToCopy, 'normal', undefined, true);
      return;
    }

    try {
      const success = await copyAllTranscriptions();
      if (success) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        // Only show tooltip on iOS or Android < 12 (Android 12+ has native clipboard feedback)
        if (
          Platform.OS === 'ios' ||
          (Platform.OS === 'android' && Number(Platform.Version) < 31)
        ) {
          showGlobalTooltip(loc.allTranscriptionsCopied);
        }
      } else {
        showGlobalTooltip(
          loc.copyFailed('Unknown error'),
          'normal',
          undefined,
          true
        );
      }
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: 'Failed to copy all transcriptions',
      });
      showGlobalTooltip(
        loc.copyFailed(error instanceof Error ? error.message : String(error)),
        'normal',
        undefined,
        true
      );
    }
  }, [transcriptions.length, copyAllTranscriptions, showGlobalTooltip, loc]);

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
      logError(error, {
        flag: FeatureFlag.transcription,
        message: 'Failed to share transcriptions',
      });
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

  useEffect(() => {
    handleRecordingStartRef.current = async () => {
      if (!hasPermission) {
        const result = await requestPermission();
        if (!result.granted) {
          if (!result.canAskAgain) {
            showGlobalTooltip(
              loc.homeMicrophonePermissionRequired,
              'normal',
              undefined,
              true,
              true
            );
            openSettings();
          } else {
            showGlobalTooltip(
              loc.homeMicrophoneDenied,
              'normal',
              undefined,
              true,
              true
            );
          }
          return;
        }
      }

      const success = await startRecording();
      if (!success) {
        showGlobalTooltip(
          loc.homeFailedStartRecording,
          'normal',
          undefined,
          true
        );
      }
    };
  }, [
    hasPermission,
    loc,
    openSettings,
    requestPermission,
    showGlobalTooltip,
    startRecording,
  ]);

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
    }, [setRecordingCallbacks])
  );

  useEffect(() => {
    setRecordingControlsEnabled(controlsEnabled);
  }, [setRecordingControlsEnabled, controlsEnabled]);

  useEffect(() => {
    setRecordingControlsVisible(!selectionMode && !isEditing);
  }, [setRecordingControlsVisible, selectionMode, isEditing]);

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
        copyAllEnabled={copyAllEnabled}
        onBackPressed={handleBackPressed}
        onTitlePressed={handleTitlePressed}
        onCopyAllPressed={handleCopyAllPressed}
        onLanguageFlagPressed={handleLanguageFlagPressed}
        onSelectAllPressed={handleSelectAllPressed}
        onDeleteSelectedPressed={handleDeleteSelectedPressed}
        onCancelEditPressed={handleCancelEdit}
        onSaveEditPressed={handleSaveEdit}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
          />
        )}
      </KeyboardAvoidingView>

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
  keyboardAvoidingView: {
    flex: 1,
  },
  shareButtonContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
});
