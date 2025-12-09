import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecordingControlsView } from '../components/shared/recording-controls';
import { Tooltip } from '../components/ui/tooltip';
import '../localization';
import { storageService } from '../services/StorageService';
import {
  initializeSessionStore,
  initializeSettingsStore,
  initializeTranscriptionStore,
} from '../stores';
import {
  useAudioLevel,
  useTranscriptionState,
} from '../stores/transcriptionStore';
import {
  useGlobalTooltip,
  useHideGlobalTooltip,
  useOnRecordingStart,
  useOnRecordingStop,
  useRecordingControlsEnabled,
  useRecordingControlsVisible,
} from '../stores/uiStore';
import { useTheme, useThemeStore } from '../theme';

// Prevent the splash screen from auto-hiding before initialization completes
SplashScreen.preventAutoHideAsync();

const StorybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true';

export const unstable_settings = {
  initialRouteName: StorybookEnabled ? '(storybook)/index' : '(pages)/index',
};

function GlobalTooltipRenderer() {
  const insets = useSafeAreaInsets();
  const tooltip = useGlobalTooltip();
  const hideTooltip = useHideGlobalTooltip();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tooltip) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        hideTooltip();
      }, tooltip.duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [tooltip, hideTooltip]);

  return (
    <View
      style={[styles.globalTooltipContainer, { bottom: insets.bottom }]}
      pointerEvents="none"
    >
      <Tooltip
        visible={!!tooltip}
        message={tooltip?.message ?? ''}
        variant={tooltip?.variant ?? 'normal'}
        pointerPosition="none"
        margin={32}
      />
    </View>
  );
}

function GlobalRecordingControls() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const pathname = usePathname();
  const transcriptionState = useTranscriptionState();
  const audioLevel = useAudioLevel();
  const onRecordingStart = useOnRecordingStart();
  const onRecordingStop = useOnRecordingStop();
  const enabled = useRecordingControlsEnabled();
  const visible = useRecordingControlsVisible();

  const handleRecordingStart = useCallback(() => {
    onRecordingStart?.();
  }, [onRecordingStart]);

  const handleRecordingStop = useCallback(() => {
    onRecordingStop?.();
  }, [onRecordingStop]);

  const isOnRecordingScreen =
    pathname === '/' || pathname.startsWith('/session/');

  if (!visible || !isOnRecordingScreen) {
    return null;
  }

  return (
    <View style={[styles.recordingControls, { bottom: insets.bottom }]}>
      <RecordingControlsView
        state={transcriptionState}
        audioLevel={audioLevel}
        onRecordingStart={handleRecordingStart}
        onRecordingStop={handleRecordingStop}
        enabled={enabled}
        colors={theme.colors}
      />
    </View>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Manrope: require('../assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium': require('../assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('../assets/fonts/Manrope-SemiBold.ttf'),
    PublicSans: require('../assets/fonts/PublicSans-Regular.ttf'),
    'PublicSans-Medium': require('../assets/fonts/PublicSans-Medium.ttf'),
    'PublicSans-SemiBold': require('../assets/fonts/PublicSans-SemiBold.ttf'),
  });

  const initTheme = useThemeStore((state) => state.initTheme);
  const { isDark } = useTheme();

  // Initialize stores and services
  useEffect(() => {
    async function initializeApp() {
      try {
        // Initialize in parallel where possible
        await Promise.all([
          initTheme(),
          initializeSettingsStore(),
          initializeSessionStore(),
          storageService.processPendingDeletes(),
        ]);

        // Initialize transcription store (depends on session store being ready)
        await initializeTranscriptionStore();

        setAppReady(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        if (error instanceof Error) {
          console.error('Error name:', error.name);
          console.error('Error stack:', error.stack);
        }
        // Still mark as ready to allow the app to render
        // Individual stores handle their own error states
        setAppReady(true);
      }
    }

    initializeApp();
  }, [initTheme]);

  // Hide splash screen when fonts are loaded and app is ready
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && appReady) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, appReady]);

  // Log font errors
  useEffect(() => {
    if (fontError) {
      console.error('Error loading fonts:', fontError);
    }
  }, [fontError]);

  // Don't render until fonts and initialization are complete
  if (!fontsLoaded || !appReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor="transparent"
        translucent
      />
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Protected guard={StorybookEnabled}>
          <Stack.Screen name="(storybook)/index" />
        </Stack.Protected>

        <Stack.Screen name="(pages)/index" />
      </Stack>
      <GlobalRecordingControls />
      <GlobalTooltipRenderer />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  globalTooltipContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  recordingControls: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
