import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EmptyStateView,
  HomeAppBar,
  HomeContent,
  Toast,
  useToast,
} from '@/components';
import { useLocalization, usePermissions, useSessionOperations } from '@/hooks';
import { Session } from '@/models';
import {
  useCreateSession,
  useExitSessionSelection,
  useIsIncognitoMode,
  useIsSessionSelectionMode,
  useSelectedSessionIds,
  useSelectedSessionIdsSet,
  useSessions,
  useSetRecordingCallbacks,
  useSetRecordingControlsEnabled,
  useShowGlobalTooltip,
  useStartRecording,
  useStopRecordingAndSave,
  useToggleSessionSelection,
} from '@/stores';
import { useTheme } from '@/theme';
import { FeatureFlag, logError } from '@/utils';

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
  const { hasPermission, requestPermission, canAskAgain, openSettings } =
    usePermissions();

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

  const handleRecordingStartRef = useRef<(() => Promise<void>) | null>(null);
  const handleRecordingStopRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    handleRecordingStartRef.current = async () => {
      if (!hasPermission) {
        if (canAskAgain) {
          const granted = await requestPermission();
          if (!granted) {
            showGlobalTooltip(loc.homeMicrophoneDenied, 'error', undefined, true, true);
            return;
          }
        } else {
          showGlobalTooltip(loc.homeMicrophonePermissionRequired, 'warning', undefined, true, true);
          openSettings();
          return;
        }
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
          showGlobalTooltip(loc.homeFailedStartRecording, 'error', undefined, true);
          return;
        }

        // brief pause to ensure recording has started before navigation (50ms)
        await new Promise((resolve) => setTimeout(resolve, 50));

        router.push({ pathname: '/session/[id]', params: { id: sessionId } });

        scrollToTop();
      } catch (error) {
        logError(error, { flag: FeatureFlag.recording, message: 'Failed to start recording' });
        showGlobalTooltip(
          loc.homeErrorCreatingSession(
            error instanceof Error ? error.message : String(error)
          ),
          'error',
          undefined,
          true
        );
      } finally {
        setTooltipShouldDisappear(false);
      }
    };
  }, [
    hasPermission,
    canAskAgain,
    effectivelyEmpty,
    isIncognitoMode,
    loc,
    router,
    requestPermission,
    showGlobalTooltip,
    openSettings,
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
    }, [setRecordingCallbacks, setRecordingControlsEnabled])
  );

  const performDelete = useCallback(async () => {
    const count = selectedSessionIds.length;
    hideDeleteToast();

    try {
      await Promise.all(
        selectedSessionIds.map((sessionId) => deleteSession(sessionId))
      );
    } catch (error) {
      logError(error, { flag: FeatureFlag.session, message: 'Error during bulk delete' });
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
  tooltipContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
