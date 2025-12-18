import '@/localization';
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppErrorBoundary, RecordingControlsView, Tooltip } from '@/components';
import { AppTheme } from '@/models';
import { storageService } from '@/services';
import {
  initializeSessionStore,
  initializeSettingsStore,
  initializeTranscriptionStore,
  useAudioLevel,
  useGlobalTooltip,
  useHideGlobalTooltip,
  useOnRecordingStart,
  useOnRecordingStop,
  useRecordingControlsEnabled,
  useRecordingControlsVisible,
  useTranscriptionState,
} from '@/stores';
import { useTheme, useThemeStore } from '@/theme';
import { FeatureFlag, logError } from '@/utils';

// Prevent the splash screen from auto-hiding before initialization completes
SplashScreen.preventAutoHideAsync();

declare const global: {
  ErrorUtils?: {
    getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
    setGlobalHandler: (
      handler: (error: Error, isFatal?: boolean) => void
    ) => void;
  };
};

let globalHandlerInstalled = false;

function installGlobalErrorHandler() {
  if (globalHandlerInstalled || !global.ErrorUtils) return;
  globalHandlerInstalled = true;

  const previousHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    logError(error, {
      flag: FeatureFlag.general,
      message: 'Unhandled JS error',
    });
    previousHandler?.(error, isFatal);
  });
}

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
  const { currentTheme } = useThemeStore();
  const pathname = usePathname();
  const transcriptionState = useTranscriptionState();
  const audioLevel = useAudioLevel();
  const onRecordingStart = useOnRecordingStart();
  const onRecordingStop = useOnRecordingStop();
  const enabled = useRecordingControlsEnabled();
  const visible = useRecordingControlsVisible();
  const blurTint = currentTheme === AppTheme.DARK ? 'dark' : 'light';

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

  const FADE_HEIGHT = 32;
  const CONTROLS_HEIGHT = 96;
  const totalHeight = CONTROLS_HEIGHT + insets.bottom;
  const fadeStop = FADE_HEIGHT / totalHeight;

  return (
    <View
      style={[styles.recordingControls, { paddingBottom: insets.bottom }]}
      pointerEvents="box-none"
    >
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <LinearGradient
            colors={['transparent', 'black', 'black']}
            locations={[0, fadeStop, 1]}
            style={StyleSheet.absoluteFill}
          />
        }
        pointerEvents="none"
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        ) : (
          <BlurView
            experimentalBlurMethod="dimezisBlurView"
            intensity={10}
            tint={blurTint}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.glassBackground },
          ]}
        />
      </MaskedView>
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
    Manrope: require('@/assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium': require('@/assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('@/assets/fonts/Manrope-SemiBold.ttf'),
    PublicSans: require('@/assets/fonts/PublicSans-Regular.ttf'),
    'PublicSans-Medium': require('@/assets/fonts/PublicSans-Medium.ttf'),
    'PublicSans-SemiBold': require('@/assets/fonts/PublicSans-SemiBold.ttf'),
  });

  const initTheme = useThemeStore((state) => state.initTheme);
  const { isDark } = useTheme();

  // Install global error handler once
  useEffect(() => {
    installGlobalErrorHandler();
  }, []);

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
        logError(error, {
          flag: FeatureFlag.general,
          message: 'Failed to initialize app',
        });
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

  useEffect(() => {
    if (fontError) {
      logError(fontError, {
        flag: FeatureFlag.ui,
        message: 'Error loading fonts',
      });
    }
  }, [fontError]);

  // Don't render until fonts and initialization are complete
  if (!fontsLoaded || !appReady) {
    return null;
  }

  return (
    <AppErrorBoundary>
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
    </AppErrorBoundary>
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
    bottom: 0,
    zIndex: 100,
  },
});
