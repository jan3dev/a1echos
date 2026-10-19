import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppConstants, dynamicTestID, TestID } from "@/constants";
import { useLocalization } from "@/hooks";
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

import { ListItem } from "../../../shared/list-item/ListItem";
import { FlagIcon } from "../../../ui/icon/FlagIcon";
import { Icon } from "../../../ui/icon/Icon";
import { DimmerBackdrop } from "../../../ui/modal/Dimmer";
import { useSwipeToDismiss } from "../../../ui/modal/useSwipeToDismiss";
import { Radio } from "../../../ui/radio/Radio";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { Text } from "../../../ui/text/Text";
import { TranscriptionModeSelector } from "../../settings/model-card/ModelCard";

const LANGUAGE_LIST_HEIGHT = 409;
const FOOTER_GAP = 16;
const FADE_MS = 200;

interface TranscriptionSettingsSheetProps {
  visible: boolean;
  onDismiss: () => void;
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
  footer,
  onFooterShownChange,
}: TranscriptionSettingsSheetProps) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const selectedModelId = useSelectedModelId();
  const selectedMode = useSelectedTranscriptionMode();
  const setTranscriptionMode = useSetTranscriptionMode();
  const selectedLanguage = useSelectedLanguage();
  const setLanguage = useSetLanguage();
  const hasSeenLargerModelSuggestion = useHasSeenLargerModelSuggestion();
  const showLargerModelSuggestion = useShowLargerModelSuggestion();

  const [page, setPage] = useState<"main" | "language">("main");
  // iOS can't present the suggestion modal while this one is still dismissing.
  const afterDismissRef = useRef<(() => void) | null>(null);
  const savingRef = useRef(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { dragY, panHandlers } = useSwipeToDismiss(visible, onDismiss);

  // The Modal itself never fades: the footer must stay crisp while it swaps
  // with the global controls, so only the backdrop and sheet fade, and the
  // blur ramps from and back to zero around the swap.
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    setClosing(!visible);
  }

  const handleShow = () => {
    setShown(true);
    onFooterShownChange?.(true);
  };

  useEffect(() => {
    if (!closing) return;
    let frame: number | undefined;
    const anim = Animated.timing(fadeAnim, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (!finished) return;
      onFooterShownChange?.(false);
      // Give the global controls a frame to reappear before the footer goes.
      frame = requestAnimationFrame(() => {
        setShown(false);
        setClosing(false);
      });
    });
    return () => {
      anim.stop();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [closing, fadeAnim, onFooterShownChange]);

  // Reset before paint so the sheet never flashes its last page/position on open.
  useLayoutEffect(() => {
    if (!visible) return;
    setPage("main");
    slideAnim.setValue(0);
    const anim = Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [visible, slideAnim, fadeAnim]);

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
    setTranscriptionMode(mode).catch(() => {});
  };

  const handleSelectLanguage = async (language: SpokenLanguage) => {
    if (savingRef.current) return;
    if (language.code !== selectedLanguage.code) {
      savingRef.current = true;
      try {
        await setLanguage(language);
      } catch {
        return;
      } finally {
        savingRef.current = false;
      }
      if (
        shouldSuggestLargerModel(language.code, selectedModelId) &&
        !hasSeenLargerModelSuggestion
      ) {
        dismissThen(showLargerModelSuggestion);
        return;
      }
    }
    setPage("main");
  };

  const modelInfo = getModelInfo(selectedModelId);
  const languages = SupportedLanguages.forCodes(
    modelInfo.supportedLanguageCodes,
  );

  const showFooter = page === "main" && !!footer;
  const translateY = Animated.add(
    slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [windowHeight, 0],
    }),
    dragY,
  );

  const renderMainPage = () => (
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
            <Icon name="chevron_right" size={18} color={colors.textSecondary} />
          }
          onPress={() => setPage("language")}
        />
      </View>
    </View>
  );

  const grabber = (
    <View
      style={[
        styles.grabber,
        { backgroundColor: colors.systemBackgroundColor },
      ]}
    />
  );

  // The language list scrolls, so only the header drags the sheet here.
  const renderLanguagePage = () => (
    <>
      <View
        testID={TestID.TranscriptionSettingsDragHeader}
        style={styles.dragHeader}
        {...panHandlers}
      >
        {grabber}
        <View style={styles.header}>
          <RipplePressable
            testID={TestID.TranscriptionSettingsBack}
            onPress={() => setPage("main")}
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
          <View style={styles.headerSide} />
        </View>
      </View>
      <ScrollView
        style={{
          maxHeight: Math.min(LANGUAGE_LIST_HEIGHT, windowHeight * 0.5),
        }}
        contentContainerStyle={styles.languageList}
        showsVerticalScrollIndicator={false}
      >
        {languages.map((language) => (
          <ListItem
            key={language.code}
            testID={dynamicTestID.language(language.code)}
            title={language.name}
            iconLeading={<FlagIcon name={getCountryCode(language)} size={24} />}
            iconTrailing={
              <Radio<string>
                value={language.code}
                size="small"
                groupValue={selectedLanguage.code}
                onValueChange={() => handleSelectLanguage(language)}
              />
            }
            onPress={() => handleSelectLanguage(language)}
          />
        ))}
      </ScrollView>
    </>
  );

  return (
    <Modal
      visible={visible || closing}
      transparent
      animationType="none"
      onShow={handleShow}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={page === "language" ? () => setPage("main") : onDismiss}
      onDismiss={runAfterDismiss}
      supportedOrientations={["portrait", "portrait-upside-down", "landscape"]}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={loc.close}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
          <DimmerBackdrop blurred={shown && !closing} />
        </Animated.View>
      </Pressable>
      <Animated.View
        testID={TestID.TranscriptionSettingsSheet}
        {...(page === "main" ? panHandlers : undefined)}
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surfaceBackground,
            borderColor: colors.surfaceBorderPrimary,
            paddingBottom:
              insets.bottom +
              FOOTER_GAP +
              (showFooter ? AppConstants.RECORDING_CONTROLS_HEIGHT : 0),
            transform: [{ translateY }],
            opacity: fadeAnim,
          },
        ]}
      >
        {page === "main" ? (
          <>
            {grabber}
            {renderMainPage()}
          </>
        ) : (
          renderLanguagePage()
        )}
      </Animated.View>
      {showFooter && (
        <View
          style={[styles.footer, { paddingBottom: insets.bottom }]}
          pointerEvents="box-none"
          {...panHandlers}
        >
          {footer}
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  grabber: {
    width: 48,
    height: 5,
    borderRadius: 100,
    marginTop: 8,
    alignSelf: "center",
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
  languageList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
