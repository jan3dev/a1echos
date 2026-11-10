import {
  Blur,
  Canvas,
  makeImageFromView,
  Path,
  Skia,
  Image as SkiaImage,
  SkImage,
  usePathInterpolation,
} from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import {
  ComponentRef,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  Keyboard,
  LayoutChangeEvent,
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Reanimated, {
  FadeIn,
  FadeOut,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppConstants, dynamicTestID, TestID } from "@/constants";
import {
  LANGUAGE_LIST_WINDOW,
  useKeyboardHeight,
  useLanguageSearch,
  useLocalization,
} from "@/hooks";
import {
  getCountryCode,
  getModelInfo,
  shouldSuggestLargerModel,
  SpokenLanguage,
  SupportedLanguages,
  TranscriptionMode,
} from "@/models";
import {
  useHasSeenLargerModelSuggestion,
  useSelectedLanguage,
  useSelectedModelId,
  useSelectedTranscriptionMode,
  useSetLanguage,
  useSetTranscriptionMode,
  useShowLargerModelSuggestion,
} from "@/stores";
import { useTheme } from "@/theme";

import { LanguageListItem } from "../../../shared/language-list-item/LanguageListItem";
import { ListItem } from "../../../shared/list-item/ListItem";
import { NoLanguagesFound } from "../../../shared/no-languages-found/NoLanguagesFound";
import { FlagIcon } from "../../../ui/icon/FlagIcon";
import { Icon } from "../../../ui/icon/Icon";
import { DimmerBackdrop } from "../../../ui/modal/Dimmer";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { Text } from "../../../ui/text/Text";
import { TextField } from "../../../ui/textfield/TextField";
import { TranscriptionModeSelector } from "../../settings/model-card/ModelCard";

import {
  BAR_SIZE,
  BLUR_MAX,
  EXPAND_SPRING,
  GRABBER_ARC_SVG,
  GRABBER_PILL_SVG,
  LANGUAGE_MOTION,
  PanelMotion,
  panelTravel,
  panelVisuals,
  Q_OPEN,
  Q_REST,
  settlePanel,
  usePanelMotion,
  usePanelPan,
} from "./recordingPanelMotion";

export {
  beginDrag,
  DRAG_ACTIVATION,
  isUpwardDrag,
  releaseDrag,
  updateDrag,
  usePanelMotion,
  usePanelPan,
} from "./recordingPanelMotion";
export type { PanelMotion } from "./recordingPanelMotion";

const LANGUAGE_LIST_HEIGHT = 409;
const LANGUAGE_ROWS_FIRST_RENDER = 10;
const FOOTER_GAP = 16;
const FADE_MS = 200;
const GRABBER_TOP = 8;
// Background below the screen edge, so overshoot never shows a gap.
const OVERSHOOT_PAD = 120;
const SNAPSHOT_DELAY_MS = 700;
const ANDROID_FOOTER_HANDOFF_MS = 150;
const FOOTER_RETURN_MS = 150;
// Gap between the status bar and the panel grown for search.
const SEARCH_TOP_GAP = 6;
const SEARCH_FIELD_GAP = 24;
const PAGE_GAP = 32;

const ARC_PATH = Skia.Path.MakeFromSVGString(GRABBER_ARC_SVG)!;
const PILL_PATH = Skia.Path.MakeFromSVGString(GRABBER_PILL_SVG)!;

/** The grabber at rest, drawn like the panel's so the two match exactly. */
export const GrabberArc = ({
  color,
  style,
}: {
  color: string;
  style?: StyleProp<ViewStyle>;
}) => (
  // androidWarmup also draws into the view itself, so the canvas reappears
  // at once after being hidden; a static canvas is otherwise never redrawn.
  <Canvas style={[BAR_SIZE, style]} androidWarmup>
    <Path path={ARC_PATH} color={color} />
  </Canvas>
);

const MorphingGrabber = ({
  straightness,
  color,
}: {
  straightness: SharedValue<number>;
  color: string;
}) => {
  const path = usePathInterpolation(
    straightness,
    [0, 1],
    [ARC_PATH, PILL_PATH],
  );
  return (
    <Canvas style={BAR_SIZE} androidWarmup>
      <Path path={path} color={color} />
    </Canvas>
  );
};

interface TranscriptionSettingsSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Shared with a drag that opens the panel from outside, see `usePanelPan`. */
  motion?: PanelMotion;
  /** Window y of the global recording controls the footer copy covers. */
  footerTop?: number;
  /** Window y of the global grabber, the panel grabber's home. */
  grabberTop?: number;
  /** Recording controls, drawn where the global ones sit so the button stays put. */
  footer?: ReactNode;
  /**
   * True once the footer is on screen and the backdrop is still unblurred,
   * false again just before it leaves. Hide the global controls in between:
   * the blur smears them into a halo around the footer's copy.
   */
  onFooterShownChange?: (shown: boolean) => void;
}

export const TranscriptionSettingsSheet = ({
  visible,
  onDismiss,
  motion,
  footerTop,
  grabberTop,
  footer,
  onFooterShownChange,
}: TranscriptionSettingsSheetProps) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const selectedModelId = useSelectedModelId();
  const selectedMode = useSelectedTranscriptionMode();
  const setTranscriptionMode = useSetTranscriptionMode();
  const selectedLanguage = useSelectedLanguage();
  const setLanguage = useSetLanguage();
  const hasSeenLargerModelSuggestion = useHasSeenLargerModelSuggestion();
  const showLargerModelSuggestion = useShowLargerModelSuggestion();

  const keyboardHeight = useKeyboardHeight();
  const search = useLanguageSearch();
  const [pinnedCode, setPinnedCode] = useState(selectedLanguage.code);

  const ownMotion = usePanelMotion();
  const m = motion ?? ownMotion;
  const [page, setPage] = useState<"main" | "language">("main");
  // The language list is long, so it only mounts once it's asked for.
  const [languageMounted, setLanguageMounted] = useState(false);
  const expandPendingRef = useRef(false);
  const mainOpacity = useSharedValue(1);
  // The footer copy follows the main page, but comes back as soon as the
  // panel closes from the language page: the global controls stay hidden
  // until the close ends.
  const footerOpacity = useSharedValue(1);
  const languageOpacity = useSharedValue(0);
  const mainHeight = useSharedValue(0);
  // `rest` is the language page's height without search.
  const heightsRef = useRef({ main: 0, language: 0, rest: 0 });
  const extraTargetRef = useRef(0);
  const [pagesHeight, setPagesHeight] = useState(0);
  // Some Android devices give the Modal window a different (and at first
  // changing) bottom edge than the app's, so what must line up with the app
  // is placed from the top, where both windows start.
  const [modalHeight, setModalHeight] = useState(0);
  const windowBottom = modalHeight || windowHeight;
  const controlsTop =
    footerTop ??
    windowHeight - insets.bottom - AppConstants.RECORDING_CONTROLS_HEIGHT;
  // Where the grabber arc rests above the record button.
  const homeTop =
    grabberTop ??
    controlsTop -
      (AppConstants.RECORDING_FOOTER_HEIGHT -
        AppConstants.RECORDING_CONTROLS_HEIGHT);
  const homeBottom = windowBottom - homeTop;
  const bottomInset = Math.max(
    0,
    windowBottom - controlsTop - AppConstants.RECORDING_CONTROLS_HEIGHT,
  );

  // iOS can't present the suggestion modal while this one is still dismissing.
  const afterDismissRef = useRef<(() => void) | null>(null);
  const savingRef = useRef(false);
  const [fadeAnim] = useState(() => new Animated.Value(0));

  // The Modal itself never fades: the footer must stay crisp while it swaps
  // with the global controls. It unmounts once the dimmer has faded and the
  // panel is back at rest.
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [faded, setFaded] = useState(false);
  const [atRest, setAtRest] = useState(true);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    setClosing(!visible);
    setFaded(false);
  }

  useAnimatedReaction(
    () => m.q.value <= Q_REST + 0.001,
    (rest, prev) => {
      if (rest !== prev) scheduleOnRN(setAtRest, rest);
    },
  );

  // Blur needs pixels: a snapshot of the content stands in for it while
  // blurred. Capturing blocks the UI thread, so it's only taken while the
  // panel rests open, and reused while the content it shows is unchanged.
  const pagesRef = useRef<ComponentRef<typeof View>>(null);
  const [snapshot, setSnapshot] = useState<{
    image: SkImage;
    key: string;
  } | null>(null);
  const [settled, setSettled] = useState(false);
  const contentKey = `${page}|${search.searching}|${selectedModelId}|${selectedMode}|${selectedLanguage.code}|${colors.surfaceBackground}|${loc.spokenLanguageTitle}|${windowWidth}`;
  // A scrolled list no longer matches its snapshot; retake once it rests.
  const clearSnapshot = () => setSnapshot(null);

  useAnimatedReaction(
    () => m.q.value === Q_OPEN,
    (open, prev) => {
      if (open !== prev) scheduleOnRN(setSettled, open);
    },
  );

  useEffect(() => {
    // The keyboard is up while searching, so the panel closes unblurred.
    if (!settled || !shown || search.searching || snapshot?.key === contentKey)
      return;
    // Let page transitions finish first.
    const timer = setTimeout(() => {
      if (!pagesRef.current) return;
      makeImageFromView(pagesRef as never).then(
        (image) => image && setSnapshot({ image, key: contentKey }),
        () => undefined,
      );
    }, SNAPSHOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [settled, shown, search.searching, contentKey, snapshot?.key]);

  // Android draws the footer copy's Skia gradient a few frames after the
  // window shows: keep the global controls, unblurred, under it until then.
  // Keyed on `visible` too: reopening mid-close never re-fires onShow.
  const [handedOff, setHandedOff] = useState(false);
  useEffect(() => {
    if (!shown || !visible) return;
    const handOff = () => {
      setHandedOff(true);
      onFooterShownChange?.(true);
    };
    if (Platform.OS !== "android" || handedOff) {
      handOff();
      return;
    }
    const timer = setTimeout(handOff, ANDROID_FOOTER_HANDOFF_MS);
    return () => clearTimeout(timer);
  }, [shown, visible, handedOff, onFooterShownChange]);

  const resetSearch = search.reset;
  const resetPages = useCallback(() => {
    expandPendingRef.current = false;
    heightsRef.current.language = 0;
    heightsRef.current.rest = 0;
    resetSearch();
    setPage("main");
    setLanguageMounted(false);
    m.expand.set(0);
    mainOpacity.set(1);
    footerOpacity.set(1);
    languageOpacity.set(0);
  }, [m, mainOpacity, footerOpacity, languageOpacity, resetSearch]);

  useLayoutEffect(() => {
    // The target is written by gestures on the UI thread; check it there.
    scheduleOnUI(settlePanel, m, visible);
    if (visible) {
      const anim = Animated.timing(fadeAnim, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: true,
      });
      anim.start();
      return () => anim.stop();
    }
    Keyboard.dismiss();
    footerOpacity.set(withTiming(1, { duration: FOOTER_RETURN_MS }));
  }, [visible, m, fadeAnim, footerOpacity]);

  useEffect(() => {
    if (!closing) return;
    const anim = Animated.timing(fadeAnim, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => finished && setFaded(true));
    return () => anim.stop();
  }, [closing, fadeAnim]);

  useEffect(() => {
    if (!closing || !faded || !atRest) return;
    onFooterShownChange?.(false);
    // Give the global controls a frame to reappear before the footer goes.
    const frame = requestAnimationFrame(() => {
      setShown(false);
      setHandedOff(false);
      setClosing(false);
      setFaded(false);
      resetPages();
    });
    return () => cancelAnimationFrame(frame);
  }, [closing, faded, atRest, onFooterShownChange, resetPages]);

  const expandToLanguage = (delay: number) => {
    const t = LANGUAGE_MOTION.open;
    m.expand.set(withDelay(delay, withSpring(1, EXPAND_SPRING)));
    languageOpacity.set(
      withDelay(
        delay + t.listFadeDelay - t.expandDelay,
        withTiming(1, { duration: t.listFade }),
      ),
    );
  };

  const syncTravel = () => {
    const { main } = heightsRef.current;
    if (main) m.travel.set(main - GRABBER_TOP - homeBottom);
  };
  useEffect(syncTravel, [homeBottom, m]);

  const searchPageHeight = windowBottom - insets.top - SEARCH_TOP_GAP - 1;

  // The language page resizes in place while search opens or closes.
  const resizeLanguagePage = (height: number) => {
    const extra = height - heightsRef.current.main;
    if (extra === extraTargetRef.current) return;
    extraTargetRef.current = extra;
    m.extra.set(withSpring(extra, EXPAND_SPRING));
  };

  const measure = (key: "main" | "language") => (e: LayoutChangeEvent) => {
    const heights = heightsRef.current;
    const resized = key === "language" && heights.language > 0;
    heights[key] = e.nativeEvent.layout.height;
    if (key === "language" && !search.searching)
      heights.rest = heights.language;
    mainHeight.set(heights.main);
    syncTravel();
    const extra = heights.language ? heights.language - heights.main : 0;
    if (extra !== extraTargetRef.current) {
      extraTargetRef.current = extra;
      m.extra.set(resized ? withSpring(extra, EXPAND_SPRING) : extra);
    }
    setPagesHeight(Math.max(heights.main, heights.language));
    if (key === "language" && expandPendingRef.current) {
      expandPendingRef.current = false;
      expandToLanguage(0);
    }
  };

  const openLanguage = () => {
    setPinnedCode(selectedLanguage.code);
    resetSearch();
    setPage("language");
    mainOpacity.set(
      withTiming(0, {
        duration: LANGUAGE_MOTION.open.mainFadeOut,
      }),
    );
    footerOpacity.set(
      withTiming(0, {
        duration: LANGUAGE_MOTION.open.mainFadeOut,
      }),
    );
    if (languageMounted) {
      expandToLanguage(LANGUAGE_MOTION.open.expandDelay);
    } else {
      expandPendingRef.current = true;
      setLanguageMounted(true);
    }
  };

  // Grows or shrinks right away instead of waiting for the relayout.
  const openSearch = () => {
    if (search.open()) resizeLanguagePage(searchPageHeight);
  };
  const closeSearch = () => {
    if (search.close() && heightsRef.current.rest) {
      resizeLanguagePage(heightsRef.current.rest);
    }
  };

  const back = () => {
    const t = LANGUAGE_MOTION.back;
    expandPendingRef.current = false;
    setPage("main");
    Keyboard.dismiss();
    // Keeps the search results until they've faded out.
    languageOpacity.set(
      withTiming(0, { duration: t.listFadeOut }, (finished) => {
        if (finished) scheduleOnRN(resetSearch);
      }),
    );
    m.expand.set(withDelay(t.collapseDelay, withSpring(0, EXPAND_SPRING)));
    mainOpacity.set(
      withDelay(t.mainFadeDelay, withTiming(1, { duration: t.mainFade })),
    );
    footerOpacity.set(
      withDelay(t.mainFadeDelay, withTiming(1, { duration: t.mainFade })),
    );
  };

  const runAfterDismiss = () => {
    afterDismissRef.current?.();
    afterDismissRef.current = null;
  };

  const dismissThen = (action: () => void) => {
    onDismiss();
    if (Platform.OS === "ios") {
      afterDismissRef.current = action;
    } else {
      action();
    }
  };

  // The store logs and rolls back failed saves.
  const handleSelectMode = (mode: TranscriptionMode) => {
    if (mode !== selectedMode) void Haptics.selectionAsync();
    setTranscriptionMode(mode).catch(() => {});
  };

  const handleSelectLanguage = async (language: SpokenLanguage) => {
    if (savingRef.current) return;
    if (language.code !== selectedLanguage.code) {
      void Haptics.selectionAsync();
      savingRef.current = true;
      // No try/finally: React Compiler can't compile it.
      const saved = await setLanguage(language).then(
        () => true,
        () => false,
      );
      savingRef.current = false;
      if (!saved) return;
      if (
        shouldSuggestLargerModel(language.code, selectedModelId) &&
        !hasSeenLargerModelSuggestion
      ) {
        dismissThen(showLargerModelSuggestion);
        return;
      }
    }
    back();
  };

  const onDrag = useCallback(
    (open: boolean) => !open && onDismiss(),
    [onDismiss],
  );
  // One pan each on the sheet and the footer: on Android a pan on a
  // box-none wrapper never receives touches.
  // The language list scrolls, so only the header drags the panel there.
  const sheetPan = usePanelPan(m, onDrag, visible && page === "main");
  const footerPan = usePanelPan(m, onDrag, visible && page === "main");
  const headerPan = usePanelPan(m, onDrag, visible && page === "language");

  const v = useDerivedValue(() => panelVisuals(m.q.value, panelTravel(m)));
  const straightness = useDerivedValue(() => v.value.barStraightness);
  const blur = useDerivedValue(() => v.value.contentBlur);
  const hasSnapshot = snapshot?.key === contentKey;
  const blurred = useDerivedValue(
    () => hasSnapshot && v.value.contentBlur > BLUR_MAX * 0.01,
  );
  const snapshotOpacity = useDerivedValue(() =>
    blurred.value ? v.value.contentOpacity : 0,
  );

  // Bottom-anchored, so growing toward the language page expands it upward.
  const sheetHeightStyle = useAnimatedStyle(() => ({
    height:
      mainHeight.value + m.extra.value * m.expand.value + 1 + OVERSHOOT_PAD,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: v.value.panelOpacity,
    transform: [{ translateY: v.value.panelTranslateY }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: v.value.barTranslateY }],
  }));
  const liveContentStyle = useAnimatedStyle(() => ({
    opacity: blurred.value ? 0 : v.value.contentOpacity,
  }));
  const mainStyle = useAnimatedStyle(() => ({ opacity: mainOpacity.value }));
  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
  }));
  const languageStyle = useAnimatedStyle(() => ({
    opacity: languageOpacity.value,
    transform: [
      {
        translateY: LANGUAGE_MOTION.listSlide * (1 - languageOpacity.value),
      },
    ],
  }));

  const modelInfo = getModelInfo(selectedModelId);
  const languages = useMemo(
    () =>
      SupportedLanguages.pickerOrder(
        SupportedLanguages.search(
          SupportedLanguages.forCodes(modelInfo.supportedLanguageCodes),
          search.query,
        ),
        pinnedCode,
      ),
    [modelInfo.supportedLanguageCodes, search.query, pinnedCode],
  );
  const hidden = (p: "main" | "language") =>
    page !== p
      ? ({
          accessibilityElementsHidden: true,
          importantForAccessibility: "no-hide-descendants",
        } as const)
      : {};

  const mainPage = (
    <Reanimated.View
      {...hidden("main")}
      pointerEvents={page === "main" ? "auto" : "none"}
      onLayout={measure("main")}
      style={[
        styles.page,
        {
          paddingBottom:
            bottomInset +
            FOOTER_GAP +
            (footer ? AppConstants.RECORDING_CONTROLS_HEIGHT : 0),
        },
        mainStyle,
      ]}
    >
      <View style={styles.grabberSpace} />
      <View style={styles.content}>
        <View style={styles.section}>
          <Text variant="body2" weight="medium" color={colors.textSecondary}>
            {loc.transcriptionModeTitle}
          </Text>
          <TranscriptionModeSelector
            supportedModes={modelInfo.supportedModes}
            selectedMode={selectedMode}
            onSelectMode={handleSelectMode}
          />
        </View>
        <View style={styles.section}>
          <Text variant="body2" weight="medium" color={colors.textSecondary}>
            {loc.spokenLanguageTitle}
          </Text>
          <ListItem
            testID={TestID.TranscriptionSettingsLanguage}
            title={selectedLanguage.name}
            iconLeading={
              <FlagIcon name={getCountryCode(selectedLanguage)} size={24} />
            }
            iconTrailing={
              <Icon
                name="chevron_right"
                size={18}
                color={colors.textSecondary}
              />
            }
            onPress={openLanguage}
          />
        </View>
      </View>
    </Reanimated.View>
  );

  const languagePage = (
    <Reanimated.View
      {...hidden("language")}
      pointerEvents={page === "language" ? "auto" : "none"}
      onLayout={measure("language")}
      style={[
        styles.page,
        search.searching
          ? {
              height: searchPageHeight,
              paddingBottom: Math.max(keyboardHeight, bottomInset) + FOOTER_GAP,
            }
          : { paddingBottom: bottomInset + FOOTER_GAP },
        languageStyle,
      ]}
    >
      <GestureDetector gesture={headerPan}>
        <View
          testID={TestID.TranscriptionSettingsDragHeader}
          style={styles.dragHeader}
          collapsable={false}
        >
          <View style={styles.grabberSpace} />
          <View style={styles.header}>
            <RipplePressable
              testID={TestID.TranscriptionSettingsBack}
              onPress={back}
              hitSlop={10}
              rippleColor={colors.ripple}
              borderless
              accessibilityRole="button"
              accessibilityLabel={loc.back}
              style={styles.headerSide}
            >
              <Icon name="chevron_left" size={24} color={colors.textPrimary} />
            </RipplePressable>
            <Text
              variant="subtitle"
              weight="semibold"
              color={colors.textPrimary}
              align="center"
              style={styles.headerTitle}
            >
              {loc.spokenLanguageTitle}
            </Text>
            <RipplePressable
              testID={
                search.searching
                  ? TestID.LanguageSearchClose
                  : TestID.LanguageSearchOpen
              }
              onPress={search.searching ? closeSearch : openSearch}
              hitSlop={10}
              rippleColor={colors.ripple}
              borderless
              accessibilityRole="button"
              accessibilityLabel={
                search.searching ? loc.close : loc.searchLanguage
              }
              style={styles.headerSide}
            >
              <Icon
                name={search.searching ? "close" : "search"}
                size={24}
                color={colors.textPrimary}
              />
            </RipplePressable>
          </View>
        </View>
      </GestureDetector>
      {search.searching && (
        <Reanimated.View
          entering={FadeIn.duration(FADE_MS)}
          exiting={FadeOut.duration(FADE_MS)}
          style={styles.searchField}
        >
          <TextField
            value={search.query}
            onChangeText={search.setQuery}
            variant="outlined"
            iconLeading="search"
            showClearIcon
            autoFocus
            debounceTime={0}
            accessibilityLabel={loc.searchLanguage}
          />
        </Reanimated.View>
      )}
      <FlatList
        data={languages}
        keyExtractor={(language) => language.code}
        initialNumToRender={LANGUAGE_ROWS_FIRST_RENDER}
        windowSize={LANGUAGE_LIST_WINDOW}
        style={
          search.searching
            ? styles.fill
            : { maxHeight: Math.min(LANGUAGE_LIST_HEIGHT, windowHeight * 0.5) }
        }
        contentContainerStyle={styles.languageList}
        ListEmptyComponent={<NoLanguagesFound />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={clearSnapshot}
        onScrollEndDrag={clearSnapshot}
        onMomentumScrollEnd={clearSnapshot}
        renderItem={({ item: language }) => (
          <LanguageListItem
            testID={dynamicTestID.language(language.code)}
            language={language}
            selected={language.code === selectedLanguage.code}
            onSelect={handleSelectLanguage}
          />
        )}
      />
    </Reanimated.View>
  );

  return (
    <Modal
      visible={visible || closing}
      transparent
      animationType="none"
      onShow={() => setShown(true)}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={
        search.searching ? closeSearch : page === "language" ? back : onDismiss
      }
      onDismiss={runAfterDismiss}
      supportedOrientations={["portrait", "portrait-upside-down", "landscape"]}
    >
      {/* Android: a Modal is its own window, gestures in it need their own root. */}
      <GestureHandlerRootView
        style={styles.fill}
        onLayout={(e) => setModalHeight(e.nativeEvent.layout.height)}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={loc.close}
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}
          >
            <DimmerBackdrop blurred={handedOff && !closing} />
          </Animated.View>
        </Pressable>
        <GestureDetector gesture={sheetPan}>
          <Reanimated.View
            testID={TestID.TranscriptionSettingsSheet}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surfaceBackground,
                borderColor: colors.surfaceBorderPrimary,
              },
              sheetHeightStyle,
              sheetStyle,
            ]}
          >
            <Reanimated.View
              pointerEvents={visible ? "auto" : "none"}
              style={[{ height: pagesHeight }, liveContentStyle]}
            >
              <View ref={pagesRef} collapsable={false} style={styles.fill}>
                {mainPage}
                {languageMounted && languagePage}
              </View>
            </Reanimated.View>
            {hasSnapshot && (
              <Canvas
                style={[styles.snapshot, { height: pagesHeight }]}
                pointerEvents="none"
              >
                <SkiaImage
                  image={snapshot.image}
                  x={0}
                  y={0}
                  width={snapshot.image.width() / PixelRatio.get()}
                  height={snapshot.image.height() / PixelRatio.get()}
                  opacity={snapshotOpacity}
                >
                  <Blur blur={blur} mode="decal" />
                </SkiaImage>
              </Canvas>
            )}
          </Reanimated.View>
        </GestureDetector>
        {footer && (
          <GestureDetector gesture={footerPan}>
            <Reanimated.View
              {...hidden("main")}
              style={[styles.footer, { top: controlsTop }, footerStyle]}
              pointerEvents={page === "main" ? "auto" : "none"}
            >
              {footer}
            </Reanimated.View>
          </GestureDetector>
        )}
        <Reanimated.View
          pointerEvents="none"
          style={[styles.bar, { top: homeTop }, barStyle]}
        >
          <MorphingGrabber
            straightness={straightness}
            color={colors.systemBackgroundColor}
          />
        </Reanimated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -OVERSHOOT_PAD,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  fill: {
    flex: 1,
  },
  page: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    gap: PAGE_GAP,
  },
  // Space for the grabber; MorphingGrabber draws it on top.
  grabberSpace: {
    height: 5,
    marginTop: GRABBER_TOP,
  },
  snapshot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  dragHeader: {
    gap: 32,
  },
  content: {
    paddingHorizontal: 16,
    gap: 24,
  },
  section: {
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  headerSide: {
    width: 24,
  },
  headerTitle: {
    flex: 1,
  },
  searchField: {
    paddingHorizontal: 16,
    marginBottom: SEARCH_FIELD_GAP - PAGE_GAP,
  },
  languageList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
