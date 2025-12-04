import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, {
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
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SessionAppBar } from '../../../components/domain/session/SessionAppBar';
import { SessionInputModal } from '../../../components/domain/session/SessionInputModal';
import { TranscriptionContentView } from '../../../components/domain/transcription/TranscriptionContentView';
import { RecordingControlsView } from '../../../components/shared/recording-controls/RecordingControlsView';
import { Button } from '../../../components/ui/button';
import { Toast, useToast } from '../../../components/ui/toast';
import { useLocalization } from '../../../hooks/useLocalization';
import { useTranscriptionSelection } from '../../../hooks/useTranscriptionSelection';
import { ModelType } from '../../../models/ModelType';
import { Transcription } from '../../../models/Transcription';
import { audioService } from '../../../services/AudioService';
import {
  useFindSessionById,
  useRenameSession,
  useSessionStore,
} from '../../../stores/sessionStore';
import { useSelectedModelType } from '../../../stores/settingsStore';
import {
  useAudioLevel,
  useIsRecording,
  useSessionTranscriptions,
  useStartRecording,
  useStopRecordingAndSave,
  useTranscriptionState,
  useTranscriptionStore,
} from '../../../stores/transcriptionStore';
import { useShowToast } from '../../../stores/uiStore';
import { useTheme } from '../../../theme';

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
  const switchSession = useSessionStore((s) => s.switchSession);
  const selectedModelType = useSelectedModelType();
  const transcriptionState = useTranscriptionState();
  const audioLevel = useAudioLevel();
  const isRecording = useIsRecording();
  const startRecording = useStartRecording();
  const stopRecordingAndSave = useStopRecordingAndSave();
  const showToast = useShowToast();
  const transcriptions = useSessionTranscriptions(id);
  const livePreview = useTranscriptionStore((s) => s.livePreview);

  const sessions = useSessionStore((s) => s.sessions);
  const incognitoSession = useSessionStore((s) => s.incognitoSession);
  const session = useMemo(
    () => findSessionById(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [findSessionById, id, sessions, incognitoSession]
  );

  const {
    selectionMode,
    selectedTranscriptionIds,
    hasSelectedItems,
    toggleTranscriptionSelection,
    handleLongPress,
    selectAllTranscriptions,
    exitSelectionMode,
    deleteSelectedTranscriptions,
    copyAllTranscriptions,
    shareSelectedTranscriptions,
  } = useTranscriptionSelection(id);

  const {
    show: showDeleteToast,
    hide: hideDeleteToast,
    toastState: deleteToastState,
  } = useToast();

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
        navigation.dispatch(e.data.action);
      }
    });

    return unsubscribe;
  }, [navigation, isRecording, stopRecordingAndSave]);

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
    router.back();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, isEditing, router, stopRecordingAndSave]);

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

    const success = await copyAllTranscriptions();
    if (success) {
      showToast(loc.allTranscriptionsCopied, 'success');
    }
  }, [
    transcriptions.length,
    copyAllTranscriptions,
    showToast,
    loc.noTranscriptionsToCopy,
    loc.allTranscriptionsCopied,
  ]);

  const handleLanguageFlagPressed = useCallback(() => {
    router.push('/settings/language');
  }, [router]);

  const handleSelectAllPressed = useCallback(() => {
    selectAllTranscriptions();
  }, [selectAllTranscriptions]);

  const handleDeleteSelectedPressed = useCallback(() => {
    if (!hasSelectedItems) return;

    const count = selectedTranscriptionIds.size;
    showDeleteToast({
      title: loc.sessionDeleteTranscriptionsTitle,
      message: loc.sessionDeleteTranscriptionsMessage(count),
      primaryButtonText: loc.delete,
      onPrimaryButtonTap: async () => {
        hideDeleteToast();
        const result = await deleteSelectedTranscriptions();
        if (result.deleted > 0) {
          showToast(
            loc.sessionTranscriptionsDeleted(result.deleted),
            'success'
          );
        }
      },
      secondaryButtonText: loc.cancel,
      onSecondaryButtonTap: hideDeleteToast,
      variant: 'informative',
    });
  }, [
    hasSelectedItems,
    selectedTranscriptionIds.size,
    showDeleteToast,
    hideDeleteToast,
    deleteSelectedTranscriptions,
    showToast,
    loc,
  ]);

  const handleSharePressed = useCallback(async () => {
    const success = await shareSelectedTranscriptions();
    if (!success) {
      showToast(loc.noTranscriptionsSelectedToShare, 'warning');
    }
  }, [
    shareSelectedTranscriptions,
    showToast,
    loc.noTranscriptionsSelectedToShare,
  ]);

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

  const handleRecordingStart = useCallback(async () => {
    const hasPermission = await audioService.hasPermission();
    if (!hasPermission) {
      const isPermanentlyDenied = await audioService.isPermanentlyDenied();
      if (isPermanentlyDenied) {
        showToast(loc.homeMicrophoneDenied, 'error');
      } else {
        showToast(loc.homeMicrophonePermissionRequired, 'warning');
      }
      return;
    }

    const success = await startRecording();
    if (!success) {
      showToast(loc.homeFailedStartRecording, 'error');
    }
  }, [startRecording, showToast, loc]);

  const handleRecordingStop = useCallback(async () => {
    await stopRecordingAndSave();
  }, [stopRecordingAndSave]);

  const sessionName = session?.name ?? '';
  const isIncognito = session?.isIncognito ?? false;
  const controlsEnabled = !isInitializing || isRecording;

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
          selectedTranscriptionIds={selectedTranscriptionIds}
          onTranscriptionTap={handleTranscriptionTap}
          onTranscriptionLongPress={handleTranscriptionLongPress}
          onEditStart={handleEditStart}
          onEditEnd={handleEditEnd}
          isCancellingEdit={isCancellingEdit}
        />
      )}

      {selectionMode ? (
        <View
          style={[styles.shareButtonContainer, { bottom: insets.bottom + 32 }]}
        >
          <Button.primary
            text={loc.share}
            onPress={handleSharePressed}
            enabled={hasSelectedItems}
          />
        </View>
      ) : (
        <View style={[styles.recordingControls, { bottom: insets.bottom }]}>
          <RecordingControlsView
            state={transcriptionState}
            audioLevel={audioLevel}
            onRecordingStart={handleRecordingStart}
            onRecordingStop={handleRecordingStop}
            enabled={controlsEnabled}
            colors={theme.colors}
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
  recordingControls: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  shareButtonContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
});
