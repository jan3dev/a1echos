import "@/localization";
import { ProgressiveBlurView } from "@sbaiahmed1/react-native-blur";
import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { enableFreeze } from "react-native-screens";

import {
  AppErrorBoundary,
  Icon,
  KeyboardPromptModal,
  RecordingControlsView,
  TOOLTIP_FADE_DURATION_MS,
  Tooltip,
} from "@/components";
import { AppConstants } from "@/constants";
import { registerForegroundService, storageService } from "@/services";
import {
  initializeModelDownloadStore,
  initializeSessionStore,
  initializeSettingsStore,
  initializeTranscriptionStore,
  preWarmModel,
  useGlobalTooltip,
  useHideGlobalTooltip,
  useHideKeyboardPrompt,
  useIsEngineInitializing,
  useKeyboardPromptVisible,
  useMarkKeyboardPromptSeen,
  useOnRecordingStart,
  useOnRecordingStop,
  useRecordingControlsEnabled,
  useRecordingControlsVisible,
  useSettingsStore,
  useTranscriptionState,
} from "@/stores";
import { useTheme, useThemeStore } from "@/theme";
import { FeatureFlag, logError, openKeyboardSettings } from "@/utils";

// Freezes inactive screens so their React tree pauses while off-screen — prevents
// the outgoing screen from briefly repainting on top of the new one after the
// slide animation completes on Android.
enableFreeze(true);

const DesignSystemEnabled =
  process.env.EXPO_PUBLIC_DESIGN_SYSTEM_ENABLED === "true";

// Prevent the splash screen from auto-hiding before initialization completes
SplashScreen.preventAutoHideAsync();

// Register Android foreground service early (async, fire-and-forget)
if (Platform.OS === "android" && !DesignSystemEnabled) {
  registerForegroundService();
}

declare const global: {
  ErrorUtils?: {
    getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
    setGlobalHandler: (
      handler: (error: Error, isFatal?: boolean) => void,
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
      message: "Unhandled JS error",
    });
    previousHandler?.(error, isFatal);
  });
}

export const unstable_settings = {
  initialRouteName: DesignSystemEnabled
    ? "(design-system)/index"
    : "(pages)/index",
};

const TOOLTIP_GAP_ABOVE_RECORDING_CONTROLS = 8;
const TOOLTIP_GAP_ABOVE_SAFE_AREA = 32;

function GlobalTooltipRenderer() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const tooltip = useGlobalTooltip();
  const hideTooltip = useHideGlobalTooltip();
  const recordingControlsVisible = useRecordingControlsVisible();
  const pathname = usePathname();
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearDisplayedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Keep displayed tooltip mounted with its content stable during fade-out, so
  // the bubble doesn't collapse to an empty pill while opacity animates to 0.
  const [displayedTooltip, setDisplayedTooltip] = useState(tooltip);

  useEffect(() => {
    if (tooltip) {
      if (clearDisplayedTimeoutRef.current) {
        clearTimeout(clearDisplayedTimeoutRef.current);
        clearDisplayedTimeoutRef.current = null;
      }
      setDisplayedTooltip(tooltip);
      return;
    }

    clearDisplayedTimeoutRef.current = setTimeout(() => {
      setDisplayedTooltip(null);
      clearDisplayedTimeoutRef.current = null;
    }, TOOLTIP_FADE_DURATION_MS);

    return () => {
      if (clearDisplayedTimeoutRef.current) {
        clearTimeout(clearDisplayedTimeoutRef.current);
        clearDisplayedTimeoutRef.current = null;
      }
    };
  }, [tooltip]);

  useEffect(() => {
    if (tooltip && !tooltip.isDismissible) {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }

      dismissTimeoutRef.current = setTimeout(() => {
        hideTooltip();
      }, tooltip.duration);
    }

    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, [tooltip, hideTooltip]);

  const isDismissible = displayedTooltip?.isDismissible ?? false;
  const hasAction = !!displayedTooltip?.action;

  const handleActionPress = useCallback(() => {
    if (displayedTooltip?.action) {
      hideTooltip();
      displayedTooltip.action.onPress();
    }
  }, [displayedTooltip, hideTooltip]);

  const isOnRecordingScreen =
    pathname === "/" || pathname.startsWith("/session/");
  const liftAboveControls = recordingControlsVisible && isOnRecordingScreen;
  const bottomOffset = liftAboveControls
    ? insets.bottom +
      AppConstants.RECORDING_CONTROLS_HEIGHT +
      TOOLTIP_GAP_ABOVE_RECORDING_CONTROLS
    : insets.bottom + TOOLTIP_GAP_ABOVE_SAFE_AREA;

  return (
    <View
      style={[styles.globalTooltipContainer, { bottom: bottomOffset }]}
      pointerEvents={isDismissible || hasAction ? "auto" : "none"}
    >
      <Tooltip
        visible={!!tooltip}
        message={displayedTooltip?.message ?? ""}
        variant={displayedTooltip?.variant ?? "normal"}
        pointerPosition="none"
        isInfo={displayedTooltip?.isInfo ?? false}
        isDismissible={isDismissible}
        onDismiss={hideTooltip}
        margin={0}
        leadingIcon={
          hasAction ? (
            <Icon
              name={displayedTooltip?.action?.iconName ?? "settings"}
              size={18}
              color={theme.colors.textInverse}
            />
          ) : undefined
        }
        onLeadingIconTap={hasAction ? handleActionPress : undefined}
      />
    </View>
  );
}

function GlobalKeyboardPromptRenderer() {
  const visible = useKeyboardPromptVisible();
  const hide = useHideKeyboardPrompt();
  const markSeen = useMarkKeyboardPromptSeen();

  const handleConfirm = useCallback(() => {
    void markSeen();
    hide();
    void openKeyboardSettings();
  }, [hide, markSeen]);

  const handleCancel = useCallback(() => {
    void markSeen();
    hide();
  }, [hide, markSeen]);

  return (
    <KeyboardPromptModal
      visible={visible}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}

function GlobalRecordingControls() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const pathname = usePathname();
  const transcriptionState = useTranscriptionState();
  const isEngineInitializing = useIsEngineInitializing();
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
    pathname === "/" || pathname.startsWith("/session/");
  const isVisible = visible && isOnRecordingScreen;

  return (
    <View
      style={[
        styles.recordingControls,
        { paddingBottom: insets.bottom, opacity: isVisible ? 1 : 0 },
      ]}
      pointerEvents={isVisible ? "box-none" : "none"}
    >
      <ProgressiveBlurView
        blurAmount={20}
        blurRounds={3}
        blurType={isDark ? "dark" : "light"}
        direction="blurredBottomClearTop"
        style={StyleSheet.absoluteFill}
      />
      {isVisible && (
        <RecordingControlsView
          state={transcriptionState}
          isInitializing={isEngineInitializing}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          enabled={enabled}
          colors={theme.colors}
        />
      )}
    </View>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Manrope: require("@/assets/fonts/Manrope-Regular.ttf"),
    "Manrope-Medium": require("@/assets/fonts/Manrope-Medium.ttf"),
    "Manrope-SemiBold": require("@/assets/fonts/Manrope-SemiBold.ttf"),
    Inter: require("@/assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("@/assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("@/assets/fonts/Inter-SemiBold.ttf"),
  });

  const initTheme = useThemeStore((state) => state.initTheme);
  const { isDark, theme } = useTheme();

  // Install global error handler once
  useEffect(() => {
    installGlobalErrorHandler();
  }, []);

  // Initialize stores and services
  useEffect(() => {
    async function initializeApp() {
      try {
        await initTheme();

        if (!DesignSystemEnabled) {
          await Promise.all([
            initializeSettingsStore(),
            initializeSessionStore(),
            storageService.processPendingDeletes(),
          ]);
          initializeModelDownloadStore();
          await initializeTranscriptionStore();

          // Pre-warm the user's selected model so the first record tap doesn't
          // pay the multi-second sherpa-onnx init cost. Fire-and-forget — the
          // helper short-circuits if the model isn't downloaded or recording
          // is in progress.
          const settings = useSettingsStore.getState();
          preWarmModel(
            settings.selectedModelId,
            settings.selectedLanguage.code,
          );
        }

        setAppReady(true);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.general,
          message: "Failed to initialize app",
        });
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
        message: "Error loading fonts",
      });
    }
  }, [fontError]);

  // Don't render until fonts and initialization are complete
  if (!fontsLoaded || !appReady) {
    return null;
  }

  if (DesignSystemEnabled) {
    return (
      <GestureHandlerRootView
        style={{ flex: 1, backgroundColor: theme.colors.surfaceBackground }}
        onLayout={onLayoutRootView}
      >
        <SystemBars style={isDark ? "light" : "dark"} />
        <Stack screenOptions={{ animation: "none" }}>
          <Stack.Screen
            name="(design-system)"
            options={{ headerShown: false }}
          />
        </Stack>
      </GestureHandlerRootView>
    );
  }

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView
        style={{ flex: 1, backgroundColor: theme.colors.surfaceBackground }}
        onLayout={onLayoutRootView}
      >
        <SystemBars style={isDark ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
            // Android (Fabric + new arch) flashes the outgoing screen on top
            // of the new one for any non-"none" animation. Native iOS slide
            // is unaffected.
            animation: Platform.OS === "android" ? "none" : "default",
            gestureEnabled: true,
            contentStyle: {
              backgroundColor: theme.colors.surfaceBackground,
            },
          }}
        />
        <GlobalRecordingControls />
        <GlobalTooltipRenderer />
        <GlobalKeyboardPromptRenderer />
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  globalTooltipContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  recordingControls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
});
