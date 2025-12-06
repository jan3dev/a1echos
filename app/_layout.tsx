import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../localization';
import { storageService } from '../services/StorageService';
import {
  initializeSessionStore,
  initializeSettingsStore,
  initializeTranscriptionStore,
} from '../stores';
import { useTheme, useThemeStore } from '../theme';

// Prevent the splash screen from auto-hiding before initialization completes
SplashScreen.preventAutoHideAsync();

const StorybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true';

export const unstable_settings = {
  initialRouteName: StorybookEnabled ? '(storybook)/index' : '(pages)/index',
};

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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={StorybookEnabled}>
          <Stack.Screen name="(storybook)/index" />
        </Stack.Protected>

        <Stack.Screen name="(pages)/index" />
      </Stack>
    </GestureHandlerRootView>
  );
}
