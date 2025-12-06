import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyStateView } from '../../components/domain/home/EmptyStateView';
import { HomeAppBar } from '../../components/domain/home/HomeAppBar';
import { HomeContent } from '../../components/domain/home/HomeContent';
import { RecordingControlsView } from '../../components/shared/recording-controls/RecordingControlsView';
import { Toast, useToast } from '../../components/ui/toast';
import { useLocalization } from '../../hooks/useLocalization';
import { useSessionOperations } from '../../hooks/useSessionOperations';
import { Session } from '../../models/Session';
import { audioService } from '../../services/AudioService';
import { useCreateSession, useSessions } from '../../stores/sessionStore';
import { useIsIncognitoMode } from '../../stores/settingsStore';
import {
  useAudioLevel,
  useStartRecording,
  useStopRecordingAndSave,
  useTranscriptionState,
} from '../../stores/transcriptionStore';
import {
  useExitSessionSelection,
  useIsSessionSelectionMode,
  useSelectedSessionIds,
  useSelectedSessionIdsSet,
  useShowGlobalTooltip,
  useShowToast,
  useToggleSessionSelection,
} from '../../stores/uiStore';
import { useTheme } from '../../theme';

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const sessions = useSessions();
  const createSession = useCreateSession();
  const { deleteSession } = useSessionOperations();
  const isIncognitoMode = useIsIncognitoMode();
  const transcriptionState = useTranscriptionState();
  const audioLevel = useAudioLevel();
  const startTranscriptionRecording = useStartRecording();
  const stopRecordingAndSave = useStopRecordingAndSave();
  const isSessionSelectionMode = useIsSessionSelectionMode();
  const selectedSessionIdsSet = useSelectedSessionIdsSet();
  const selectedSessionIds = useSelectedSessionIds();
  const toggleSessionSelection = useToggleSessionSelection();
  const exitSessionSelection = useExitSessionSelection();
  const showToast = useShowToast();
  const showGlobalTooltip = useShowGlobalTooltip();

  const {
    show: showDeleteToast,
    hide: hideDeleteToast,
    toastState: deleteToastState,
  } = useToast();

  const [tooltipShouldDisappear, setTooltipShouldDisappear] = useState(false);

  const effectivelyEmpty = sessions.length === 0;

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isSessionSelectionMode) {
          exitSessionSelection();
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [isSessionSelectionMode, exitSessionSelection]);

  const scrollToTop = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: true });
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
    [isSessionSelectionMode, toggleSessionSelection]
  );

  const handleSessionTap = useCallback(
    (sessionId: string) => {
      if (isSessionSelectionMode) {
        toggleSessionSelection(sessionId);
      } else {
        router.push({ pathname: '/session/[id]', params: { id: sessionId } });
      }
    },
    [isSessionSelectionMode, toggleSessionSelection, router]
  );

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
        loc.incognitoModeTitle
      );

      const recordingStarted = await startTranscriptionRecording();
      if (!recordingStarted) {
        showToast(loc.homeFailedStartRecording, 'error');
        return;
      }

      // brief pause to ensure recording has started before navigation (50ms)
      await new Promise((resolve) => setTimeout(resolve, 50));

      router.push({ pathname: '/session/[id]', params: { id: sessionId } });

      scrollToTop();
    } catch (error) {
      console.error('Failed to start recording:', error);
      showToast(
        loc.homeErrorCreatingSession(
          error instanceof Error ? error.message : String(error)
        ),
        'error'
      );
    } finally {
      setTooltipShouldDisappear(false);
    }
  }, [
    effectivelyEmpty,
    createSession,
    isIncognitoMode,
    startTranscriptionRecording,
    router,
    scrollToTop,
    showToast,
    loc,
  ]);

  const handleRecordingStop = useCallback(async () => {
    await stopRecordingAndSave();
  }, [stopRecordingAndSave]);

  const performDelete = useCallback(async () => {
    const count = selectedSessionIds.length;
    hideDeleteToast();

    try {
      await Promise.all(
        selectedSessionIds.map((sessionId) => deleteSession(sessionId))
      );
    } catch (error) {
      console.error('Error during bulk delete:', error);
    }

    exitSessionSelection();
    showGlobalTooltip(loc.homeSessionsDeleted(count));
  }, [
    selectedSessionIds,
    deleteSession,
    exitSessionSelection,
    hideDeleteToast,
    showGlobalTooltip,
    loc,
  ]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedSessionIds.length === 0) return;
    showDeleteToast({
      title: loc.homeDeleteSelectedSessionsTitle,
      message: loc.homeDeleteSelectedSessionsMessage(selectedSessionIds.length),
      primaryButtonText: loc.delete,
      onPrimaryButtonTap: performDelete,
      secondaryButtonText: loc.cancel,
      onSecondaryButtonTap: hideDeleteToast,
      variant: 'informative',
    });
  }, [
    selectedSessionIds.length,
    showDeleteToast,
    hideDeleteToast,
    performDelete,
    loc,
  ]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <HomeAppBar
        selectionMode={isSessionSelectionMode}
        onDeleteSelected={handleDeleteSelected}
        onExitSelectionMode={exitSessionSelection}
      />

      <HomeContent
        selectionMode={isSessionSelectionMode}
        selectedSessionIds={selectedSessionIdsSet}
        onSessionLongPress={handleSessionLongPress}
        onSessionTap={handleSessionTap}
        onSelectionToggle={toggleSessionSelection}
        scrollRef={scrollRef}
      />

      <View style={[styles.recordingControls, { bottom: insets.bottom }]}>
        <RecordingControlsView
          state={transcriptionState}
          audioLevel={audioLevel}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          colors={theme.colors}
        />
      </View>

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
  tooltipContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
