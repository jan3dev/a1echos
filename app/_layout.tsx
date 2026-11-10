import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { reloadAppAsync } from "expo";
import { useFonts } from "expo-font";
import { getLocales, useLocales } from "expo-localization";
import { Stack, useIsFocused, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import {
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Reanimated, { useAnimatedStyle } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppErrorBoundary,
  beginDrag,
  BiometricLock,
  DRAG_ACTIVATION,
  FadingGlassBlur,
  GrabberArc,
  Icon,
  isUpwardDrag,
  LargerModelSuggestionModal,
  Modal,
  PRIMARY_BUTTON_HEIGHT,
  releaseDrag,
  RECORDING_BUTTON_SIZE,
  RecordingControlsView,
  SCROLL_TO_EDGE_BUTTON_SIZE,
  ScrollToEdgeButton,
  SUB_SCREEN_NAVBAR_HEIGHT,
  TOOLTIP_FADE_DURATION_MS,
  Tooltip,
  TranscriptionSettingsSheet,
  updateDrag,
  usePanelMotion,
  usePanelPan,
  VoiceSessionHintModal,
} from "@/components";
import {
  useEnsureModelDownloaded,
  useKeyboardHeight,
  useLocalization,
  useVoiceSessionHint,
} from "@/hooks";
import { AppConstants, Routes, TestID } from "@/constants";
import { openAndPrepareDatabase } from "@/db";
import { i18n, resolveAppLanguage, syncLayoutDirection } from "@/localization";
import { getModelInfo, ModelId, TranscriptionState } from "@/models";
import migrationsBundle from "@/db/migrations/migrations.js";
import {
  cleanupLegacyArtifactsIfPresent,
  consolidateDefaultSessionIfNeeded,
  runLegacyMigrationIfNeeded,
} from "@/db/runtime-migration";
import { registerForegroundService } from "@/services";
import {
  AUDIO_BUSY_STATES,
  initializeModelDownloadStore,
  initializeSessionStore,
  initializeSettingsStore,
  initializeTranscriptionStore,
  preWarmModel,
  startKeyboardTranscriptionBridge,
  useGlobalTooltip,
  useHideGlobalTooltip,
  useHideKeyboardPrompt,
  useHideLargerModelSuggestion,
  useHideOmnilingualDownload,
  useIsEngineInitializing,
  useIsSessionSelectionMode,
  useIsTranscriptionSelectionMode,
  useHideVoiceSessionHint,
  useAppLocked,
  useBiometricAuthEnabled,
  useKeyboardPromptVisible,
  useLargerModelSuggestionVisible,
  useMarkLargerModelSuggestionSeen,
  useOmnilingualDownloadVisible,
  useSelectedLanguage,
  useSetOnboardingStep,
  useMarkKeyboardPromptSeen,
  useVoiceSessionHintVisible,
  useOnRecordingStart,
  useOnRecordingStop,
  useRecordingControlsEnabled,
  useRecordingControlsBlurTarget,
  useRecordingJumpButton,
  useRecordingControlsVisible,
  useSessionStore,
  useSetModelId,
  useSettingsStore,
  useTranscriptionState,
  useTranscriptionStore,
} from "@/stores";
import { spacing, useTheme, useThemeStore } from "@/theme";
import {
  FeatureFlag,
  formatBytes,
  logError,
  readKeyboardEnabled,
} from "@/utils";

// Prevent the splash screen from auto-hiding before initialization completes
SplashScreen.preventAutoHideAsync();

// Register Android foreground service early (async, fire-and-forget)
if (Platform.OS === "android") {
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
  initialRouteName: "(pages)/index",
};

const TOOLTIP_GAP_ABOVE_FOOTER = 16;
const SETTINGS_HANDLE_HIT_ABOVE = 16;
const GRABBER_TOP_INSET = 9;
const SETTINGS_HANDLE_HEIGHT =
  AppConstants.RECORDING_FOOTER_HEIGHT -
  AppConstants.RECORDING_CONTROLS_HEIGHT +
  GRABBER_TOP_INSET;
const SETTINGS_HANDLE_BOX_HEIGHT =
  SETTINGS_HANDLE_HEIGHT + SETTINGS_HANDLE_HIT_ABOVE;
const TOOLTIP_GAP_ABOVE_SAFE_AREA = 32;

const isSessionListRoute = (pathname: string) =>
  pathname === "/" || pathname.startsWith("/folder/");

const isTranscriptionEditRoute = (pathname: string) =>
  /^\/transcription\/[^/]+$/.test(pathname);

// Resolves false when the reload failed and the app should carry on.
const reloadForLayoutDirection = () =>
  reloadAppAsync("Layout direction changed").then(
    () => true,
    (error) => {
      logError(error, {
        flag: FeatureFlag.general,
        message: "Failed to reload for layout direction",
      });
      return false;
    },
  );

const isRecordingRoute = (pathname: string) =>
  isSessionListRoute(pathname) || pathname.startsWith("/session/");

function GlobalTooltipRenderer() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { theme } = useTheme();
  const tooltip = useGlobalTooltip();
  const hideTooltip = useHideGlobalTooltip();
  const recordingControlsVisible = useRecordingControlsVisible();
  const isSessionSelectionMode = useIsSessionSelectionMode();
  const isTranscriptionSelectionMode = useIsTranscriptionSelectionMode();
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

  const isOnRecordingScreen = isRecordingRoute(pathname);
  const liftAboveControls = recordingControlsVisible && isOnRecordingScreen;
  // The bottom selection action bar (SubScreenNavbar) and the recording
  // controls are mutually exclusive — screens hide the controls whenever
  // selection mode is active. Lift the tooltip above whichever is present.
  const navbarVisible =
    (isSessionListRoute(pathname) && isSessionSelectionMode) ||
    (pathname.startsWith("/session/") && isTranscriptionSelectionMode) ||
    isTranscriptionEditRoute(pathname);
  const footerHeight = liftAboveControls
    ? AppConstants.RECORDING_FOOTER_HEIGHT
    : navbarVisible
      ? SUB_SCREEN_NAVBAR_HEIGHT
      : pathname === Routes.onboardingRecord
        ? PRIMARY_BUTTON_HEIGHT + spacing.md
        : 0;
  // An open keyboard covers the safe area and carries any footer above it.
  const bottomEdge = keyboardHeight > 0 ? keyboardHeight : insets.bottom;
  const bottomOffset =
    footerHeight > 0
      ? bottomEdge + footerHeight + TOOLTIP_GAP_ABOVE_FOOTER
      : bottomEdge + TOOLTIP_GAP_ABOVE_SAFE_AREA;

  // Rendered inside the focused screen (via the Stack's screenLayout) rather
  // than a Modal: a Modal's window swallows every touch, freezing the app while
  // a tooltip shows, and on Android a sibling of <Stack> draws beneath screens.
  if (!displayedTooltip) return null;

  return (
    <View
      testID={TestID.GlobalTooltipContainer}
      style={[styles.globalTooltipContainer, { bottom: bottomOffset }]}
      pointerEvents={isDismissible || hasAction ? "box-none" : "none"}
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

function FocusedScreenTooltip() {
  return useIsFocused() ? <GlobalTooltipRenderer /> : null;
}

// Stores can't navigate, so they raise the flag and this pushes the screen.
function GlobalKeyboardPromptNavigator() {
  const router = useRouter();
  const requested = useKeyboardPromptVisible();
  const hide = useHideKeyboardPrompt();
  const markSeen = useMarkKeyboardPromptSeen();

  useEffect(() => {
    if (!requested) return;
    // Next tick: a caller's `await stopRecordingAndSave(); router.back()`
    // must land first, or its back() pops this screen.
    const timer = setTimeout(async () => {
      hide();
      if ((await readKeyboardEnabled()) === true) void markSeen();
      else router.push(Routes.settingsEchosKeyboard);
    });
    return () => clearTimeout(timer);
  }, [requested, hide, markSeen, router]);

  return null;
}

function GlobalLargerModelSuggestionRenderer() {
  const router = useRouter();
  const visible = useLargerModelSuggestionVisible();
  const hide = useHideLargerModelSuggestion();
  const markSeen = useMarkLargerModelSuggestionSeen();
  // By the time the sheet is shown the store already holds the language the
  // user just picked — that's what triggered it.
  const language = useSelectedLanguage();

  const handleConfirm = useCallback(() => {
    void markSeen();
    hide();
    router.push(Routes.settingsModel);
  }, [hide, markSeen, router]);

  const handleDismiss = useCallback(() => {
    void markSeen();
    hide();
  }, [hide, markSeen]);

  return (
    <LargerModelSuggestionModal
      visible={visible}
      languageName={language.name}
      onConfirm={handleConfirm}
      onDismiss={handleDismiss}
    />
  );
}

// Global so the transcription drawer, itself a Modal, can offer it too.
function GlobalOmnilingualDownloadRenderer() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const visible = useOmnilingualDownloadVisible();
  const hide = useHideOmnilingualDownload();
  const ensureModelDownloaded = useEnsureModelDownloaded();
  const setModelId = useSetModelId();
  const { languages, sizeBytes } = getModelInfo(ModelId.OMNILINGUAL);

  // Audio Models shows the progress, and the model once it's in.
  const download = () => {
    hide();
    void ensureModelDownloaded(ModelId.OMNILINGUAL).then((ok) => {
      // The store logs and rolls back a failed save.
      if (ok) setModelId(ModelId.OMNILINGUAL).catch(() => {});
    });
    router.push(Routes.settingsModelFocus(ModelId.OMNILINGUAL));
  };

  return (
    <Modal
      visible={visible}
      testID={TestID.OmnilingualDownloadModal}
      title={loc.downloadOmnilingualTitle}
      // Unclamped: translations run longer than English.
      titleMaxLines={0}
      messageMaxLines={0}
      message={`${loc.downloadOmnilingualIntro(languages)}\n\n${loc.downloadOmnilingualNote(formatBytes(sizeBytes))}`}
      primaryButton={{ text: loc.download, onTap: download }}
      secondaryButton={{ text: loc.notNow, onTap: hide }}
      onDismiss={hide}
      icon={<Icon name="language" size={24} color={theme.colors.textPrimary} />}
    />
  );
}

function GlobalVoiceSessionHintRenderer() {
  const visible = useVoiceSessionHintVisible();
  const hide = useHideVoiceSessionHint();
  // Wait for the lock screen to go: UIKit refuses to present a second Modal.
  const locked = useAppLocked();

  return (
    <VoiceSessionHintModal visible={visible && !locked} onDismiss={hide} />
  );
}

// A sibling of the controls, not a child: Android drops touches outside a
// parent's bounds, and drawn after them so it sits above their fade. Its own
// component so store updates don't re-render the controls.
function GlobalJumpButton({ hidden }: { hidden: boolean }) {
  const insets = useSafeAreaInsets();
  const { loc } = useLocalization();
  const jumpButton = useRecordingJumpButton();
  // Drawn above screens, so it would cover a tooltip's close button.
  const tooltip = useGlobalTooltip();
  if (!jumpButton) return null;

  const position =
    jumpButton.placement === "record"
      ? {
          // Centred on the record button, 16 inside the list cards' edge.
          right: 32,
          bottom:
            insets.bottom +
            AppConstants.RECORDING_CONTROLS_HEIGHT -
            (RECORDING_BUTTON_SIZE + SCROLL_TO_EDGE_BUTTON_SIZE) / 2,
        }
      : {
          right: 16,
          bottom: insets.bottom + AppConstants.RECORDING_CONTROLS_HEIGHT + 16,
        };

  return (
    <View style={[styles.jumpButton, position]} pointerEvents="box-none">
      <ScrollToEdgeButton
        visible={jumpButton.visible && !hidden && !tooltip}
        direction={jumpButton.direction}
        onPress={jumpButton.onPress}
        accessibilityLabel={
          jumpButton.direction === "up" ? loc.scrollToTop : loc.scrollToLatest
        }
      />
    </View>
  );
}

function GlobalRecordingControls() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const pathname = usePathname();
  const transcriptionState = useTranscriptionState();
  const isEngineInitializing = useIsEngineInitializing();
  const onRecordingStart = useOnRecordingStart();
  const onRecordingStop = useOnRecordingStop();
  const enabled = useRecordingControlsEnabled();
  const visible = useRecordingControlsVisible();
  const blurTarget = useRecordingControlsBlurTarget();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [footerShown, setFooterShown] = useState(false);
  const panelMotion = usePanelMotion();
  // Where the settings panel draws its copies of the controls and grabber.
  const [anchors, setAnchors] = useState<{
    controls?: number;
    grabber?: number;
  }>({});
  const measureAnchor =
    (key: "controls" | "grabber") =>
    ({ currentTarget }: LayoutChangeEvent) => {
      // A number only on the legacy renderer.
      if (typeof currentTarget === "number") return;
      currentTarget.measureInWindow((_x, y) =>
        setAnchors((a) => (a[key] === y ? a : { ...a, [key]: y })),
      );
    };
  // Never two grabbers apart: once the panel's grabber leaves home, this one
  // hides, whatever the footer hand-off timing.
  const grabberStyle = useAnimatedStyle(() => ({
    opacity: panelMotion.q.value > 0 ? 0 : 1,
  }));
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const handleRecordingStart = useCallback(() => {
    setSettingsOpen(false);
    onRecordingStart?.();
  }, [onRecordingStart]);

  const handleRecordingStop = useCallback(() => {
    onRecordingStop?.();
  }, [onRecordingStop]);

  const isOnRecordingScreen = isRecordingRoute(pathname);
  const isVisible = visible && isOnRecordingScreen;
  const canOpenSettings =
    isVisible &&
    enabled &&
    !isEngineInitializing &&
    transcriptionState === TranscriptionState.READY;

  useEffect(() => {
    if (!canOpenSettings) setSettingsOpen(false);
  }, [canOpenSettings]);

  // The panel follows the finger from here; it takes over once it shows.
  const swipeUp = usePanelPan(
    panelMotion,
    setSettingsOpen,
    canOpenSettings && Platform.OS !== "android",
    -DRAG_ACTIVATION,
  );
  // Android: a gesture-handler pan still active when the panel's Modal window
  // appears leaves the first touches in that window dropped. The JS responder
  // hands off cleanly.
  // Shared values read on the JS thread can be stale, so the drag math runs
  // on the UI thread.
  const swipeUpResponder = useMemo(() => {
    const release = (vy: number) =>
      scheduleOnUI(releaseDrag, panelMotion, vy * 1000, setSettingsOpen);
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) =>
        canOpenSettings && isUpwardDrag(g.dx, g.dy),
      onPanResponderGrant: (_, g) => {
        scheduleOnUI(beginDrag, panelMotion, g.dy);
        setSettingsOpen(true);
      },
      onPanResponderMove: (_, g) => scheduleOnUI(updateDrag, panelMotion, g.dy),
      onPanResponderRelease: (_, g) => release(g.vy),
      onPanResponderTerminate: (_, g) => release(g.vy),
      onPanResponderTerminationRequest: () => false,
    });
  }, [canOpenSettings, panelMotion]);

  const controls = (
    <RecordingControlsView
      state={transcriptionState}
      isInitializing={isEngineInitializing}
      onRecordingStart={handleRecordingStart}
      onRecordingStop={handleRecordingStop}
      enabled={enabled}
      colors={theme.colors}
    />
  );

  return (
    <>
      <View
        style={[styles.recordingControls, { opacity: isVisible ? 1 : 0 }]}
        pointerEvents={isVisible ? "box-none" : "none"}
      >
        {isVisible && blurTarget && (
          <FadingGlassBlur
            blurTarget={blurTarget}
            top={SETTINGS_HANDLE_BOX_HEIGHT}
            fadeHeight={RECORDING_BUTTON_SIZE}
          />
        )}
        {isVisible && (
          <GestureDetector gesture={swipeUp}>
            <View
              collapsable={false}
              pointerEvents={Platform.OS === "android" ? "auto" : "box-none"}
              style={{ paddingBottom: insets.bottom }}
              {...(Platform.OS === "android" && swipeUpResponder.panHandlers)}
            >
              {canOpenSettings ? (
                <Pressable
                  testID={TestID.TranscriptionSettingsHandle}
                  style={styles.settingsHandle}
                  onPress={openSettings}
                  accessibilityRole="button"
                  accessibilityLabel={loc.transcriptionSettings}
                >
                  <Reanimated.View
                    collapsable={false}
                    onLayout={measureAnchor("grabber")}
                    style={grabberStyle}
                  >
                    <GrabberArc
                      color={theme.colors.systemBackgroundColor}
                      style={footerShown && styles.hidden}
                    />
                  </Reanimated.View>
                </Pressable>
              ) : (
                <View style={styles.settingsHandle} pointerEvents="none" />
              )}
              <View
                onLayout={measureAnchor("controls")}
                style={footerShown && styles.hidden}
              >
                {controls}
              </View>
            </View>
          </GestureDetector>
        )}
        <TranscriptionSettingsSheet
          visible={settingsOpen}
          onDismiss={closeSettings}
          motion={panelMotion}
          footerTop={anchors.controls}
          grabberTop={anchors.grabber}
          footer={controls}
          onFooterShownChange={setFooterShown}
        />
      </View>
      {isVisible && <GlobalJumpButton hidden={settingsOpen} />}
    </>
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
    "Inter-Bold": require("@/assets/fonts/Inter-Bold.ttf"),
    "NunitoSans-Regular": require("@/assets/fonts/NunitoSans-Regular.ttf"),
    "NunitoSans-Bold": require("@/assets/fonts/NunitoSans-Bold.ttf"),
    "Literata-Regular": require("@/assets/fonts/Literata-Regular.ttf"),
    "Literata-Bold": require("@/assets/fonts/Literata-Bold.ttf"),
    "EBGaramond-Regular": require("@/assets/fonts/EBGaramond-Regular.ttf"),
    "EBGaramond-Bold": require("@/assets/fonts/EBGaramond-Bold.ttf"),
    "IBMPlexMono-Regular": require("@/assets/fonts/IBMPlexMono-Regular.ttf"),
    "IBMPlexMono-Bold": require("@/assets/fonts/IBMPlexMono-Bold.ttf"),
    "Bitter-Regular": require("@/assets/fonts/Bitter-Regular.ttf"),
    "Bitter-Bold": require("@/assets/fonts/Bitter-Bold.ttf"),
  });

  const initTheme = useThemeStore((state) => state.initTheme);
  const { isDark, theme } = useTheme();

  // Show the "swipe back" hint when opened from the keyboard's mic button.
  useVoiceSessionHint();

  const pathname = usePathname();
  const setOnboardingStep = useSetOnboardingStep();
  useEffect(() => {
    if (pathname.startsWith("/onboarding/")) void setOnboardingStep(pathname);
  }, [pathname, setOnboardingStep]);

  const [{ languageCode }] = useLocales();
  const language = resolveAppLanguage(languageCode);
  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [language]);

  // Android 13+ switches the per-app language without restarting the app.
  // A layout direction change needs a reload, which would drop in-flight audio
  // work or the in-memory incognito session, so it waits for both to end.
  const isEngineBusy = useTranscriptionStore((s) =>
    AUDIO_BUSY_STATES.has(s.state),
  );
  const hasIncognitoSession = useSessionStore(
    (s) => s.incognitoSession !== null,
  );
  useEffect(() => {
    if (
      appReady &&
      !isEngineBusy &&
      !hasIncognitoSession &&
      syncLayoutDirection(language)
    ) {
      void reloadForLayoutDirection();
    }
  }, [appReady, language, isEngineBusy, hasIncognitoSession]);

  // Install global error handler once
  useEffect(() => {
    installGlobalErrorHandler();
  }, []);

  // Match the native window background to the theme. Without this the Android
  // window stays its default (dark) color, which flashes through for a frame
  // when a newly-pushed screen's blur view clears before it captures content.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.surfaceBackground).catch(
      () => undefined,
    );
  }, [theme.colors.surfaceBackground]);

  // Initialize stores and services
  useEffect(() => {
    async function initializeApp() {
      // Reload before any migration or model init starts, not midway through.
      const [locale] = getLocales();
      if (
        syncLayoutDirection(resolveAppLanguage(locale?.languageCode)) &&
        (await reloadForLayoutDirection())
      ) {
        return;
      }
      try {
        await initTheme();

        // 1. Open SQLCipher-encrypted DB (PRAGMA key from SecureStore).
        const db = await openAndPrepareDatabase();
        // 2. Apply drizzle schema migrations (no-op on already-current DB).
        await migrate(db, migrationsBundle);
        // 3. One-shot legacy JSON → SQLite migration (idempotent across launches).
        await runLegacyMigrationIfNeeded();
        // 4. Fold the synthetic "Imported" session into a real session if
        //    one exists. Idempotent — no-op on clean installs.
        await consolidateDefaultSessionIfNeeded();
        // 5. Idempotent cleanup of stale legacy artifacts from prior crashes.
        await cleanupLegacyArtifactsIfPresent();

        await Promise.all([
          initializeSettingsStore(),
          initializeSessionStore(),
        ]);
        initializeModelDownloadStore();
        await initializeTranscriptionStore();

        // Pre-warm the user's selected model so the first record tap doesn't
        // pay the multi-second sherpa-onnx init cost. Fire-and-forget — the
        // helper short-circuits if the model isn't downloaded or recording
        // is in progress.
        const settings = useSettingsStore.getState();
        preWarmModel(settings.selectedModelId, settings.selectedLanguage.code);
        startKeyboardTranscriptionBridge();

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
  // With the lock on, BiometricLock hides the splash once it covers the app.
  const biometricAuthEnabled = useBiometricAuthEnabled();
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && appReady && !biometricAuthEnabled) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, appReady, biometricAuthEnabled]);

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
            contentStyle: {
              backgroundColor: theme.colors.surfaceBackground,
            },
          }}
          screenLayout={({ children }) => (
            <>
              {children}
              <FocusedScreenTooltip />
            </>
          )}
        />
        {/* Overlays live here (siblings of <Stack>, not inside screens) on
            purpose: the recording controls must persist across home↔session
            navigation without remounting or interrupting an active recording.
            Because react-native-screens composites the active screen above
            sibling overlays on Android, each overlay that can sit over opaque
            content uses a Modal to escape onto its own window — do not
            "simplify" these into plain root-level Views. The tooltip is the
            exception (it must not block touches): see screenLayout above. */}
        <GlobalRecordingControls />
        <GlobalKeyboardPromptNavigator />
        <GlobalVoiceSessionHintRenderer />
        <GlobalLargerModelSuggestionRenderer />
        <GlobalOmnilingualDownloadRenderer />
        <BiometricLock />
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hidden: {
    opacity: 0,
  },
  globalTooltipContainer: {
    position: "absolute",
    left: 16,
    right: 16,
  },
  recordingControls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  jumpButton: {
    position: "absolute",
    zIndex: 101,
  },
  // In-flow (not hitSlop) so the grabber is inside the swipe and touch area.
  settingsHandle: {
    height: SETTINGS_HANDLE_BOX_HEIGHT,
    width: 48 + 2 * SETTINGS_HANDLE_HIT_ABOVE,
    alignSelf: "center",
    alignItems: "center",
    paddingTop: GRABBER_TOP_INSET + SETTINGS_HANDLE_HIT_ABOVE,
  },
});
