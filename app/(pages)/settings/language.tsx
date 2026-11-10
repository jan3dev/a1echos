import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, type HostInstance } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  Icon,
  LanguageListItem,
  NoLanguagesFound,
  Screen,
  Text,
  TextField,
  TopAppBar,
} from "@/components";
import { RipplePressable } from "@/components/ui/ripple-pressable/RipplePressable";
import { AppConstants, dynamicTestID, TestID } from "@/constants";
import {
  LANGUAGE_LIST_WINDOW,
  SEARCH_FADE_MS,
  useLanguageSearch,
  useLocalization,
  useScrollSurface,
} from "@/hooks";
import {
  getModelInfo,
  shouldSuggestLargerModel,
  SpokenLanguage,
  SupportedLanguages,
} from "@/models";
import {
  useHasSeenLargerModelSuggestion,
  useSelectedLanguage,
  useSelectedModelId,
  useSetLanguage,
  useShowLargerModelSuggestion,
} from "@/stores";
import { useTheme } from "@/theme";
import { delay, FeatureFlag, iosPressed, logError } from "@/utils";

const LANGUAGE_ROWS_FIRST_RENDER = 12;

export default function LanguageSettingsScreen() {
  const router = useRouter();
  const { loc } = useLocalization();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<HostInstance>(null);
  const listRef = useRef<FlatList<SpokenLanguage>>(null);
  const { scrolled, onScroll } = useScrollSurface();

  const selectedLanguage = useSelectedLanguage();
  const selectedModelId = useSelectedModelId();
  const setLanguage = useSetLanguage();
  const hasSeenLargerModelSuggestion = useHasSeenLargerModelSuggestion();
  const showLargerModelSuggestion = useShowLargerModelSuggestion();

  const [pendingLanguageCode, setPendingLanguageCode] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const search = useLanguageSearch();
  // Pinned at mount so the list doesn't reorder while a new pick saves.
  const [pinnedCode] = useState(selectedLanguage.code);
  const effectiveLanguageCode = pendingLanguageCode ?? selectedLanguage.code;

  const handleSelect = async (language: SpokenLanguage) => {
    if (language.code === selectedLanguage.code) {
      router.back();
      return;
    }
    if (isSaving) return;

    setPendingLanguageCode(language.code);
    setIsSaving(true);

    const feedback = delay(400);
    // Only the awaits sit in the try: React Compiler can't compile
    // conditionals inside one, and without it every row re-renders.
    try {
      await setLanguage(language);
      await feedback;
    } catch (error) {
      setPendingLanguageCode(null);
      setIsSaving(false);
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to set language",
      });
      return;
    }
    // Nudge once. The sheet is rendered globally because this screen
    // unmounts on `back()`.
    if (
      shouldSuggestLargerModel(language.code, selectedModelId) &&
      !hasSeenLargerModelSuggestion
    ) {
      showLargerModelSuggestion();
    }
    router.back();
  };

  const { supportedLanguageCodes } = getModelInfo(selectedModelId);
  const { query } = search;
  // Keyed on primitives so toggling search doesn't re-render every row.
  const languages = useMemo(
    () =>
      SupportedLanguages.pickerOrder(
        SupportedLanguages.search(
          SupportedLanguages.forCodes(supportedLanguageCodes),
          query,
        ),
        pinnedCode,
      ),
    [supportedLanguageCodes, query, pinnedCode],
  );

  // The field sits at the list's top; bring it into view.
  const openSearch = () => {
    if (search.open()) listRef.current?.scrollToOffset({ offset: 0 });
  };
  const leave = () => search.close(router.back);

  const headerAction = (
    icon: "search" | "close",
    label: string,
    onPress: () => void,
    testID: string,
  ) => (
    <RipplePressable
      key={icon}
      testID={testID}
      onPress={onPress}
      hitSlop={10}
      rippleColor={theme.colors.ripple}
      borderless
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: iosPressed(pressed) })}
    >
      <Icon name={icon} size={24} color={theme.colors.textPrimary} />
    </RipplePressable>
  );

  return (
    <Screen>
      {/* Bars render after content so Android's blur target ref is populated
          before the bar's BlurView mounts and resolves its `blurTarget`. */}
      <AppBarBlurTarget targetRef={blurTargetRef} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={languages}
          keyExtractor={(language) => language.code}
          initialNumToRender={LANGUAGE_ROWS_FIRST_RENDER}
          windowSize={LANGUAGE_LIST_WINDOW}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
              paddingBottom: insets.bottom + 16,
              backgroundColor: theme.colors.surfaceBackground,
            },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          ListHeaderComponentStyle={styles.header}
          ListHeaderComponent={
            <Animated.View
              key={search.searching ? "search" : "intro"}
              entering={FadeIn.duration(SEARCH_FADE_MS)}
              exiting={FadeOut.duration(SEARCH_FADE_MS)}
            >
              {search.searching ? (
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
              ) : (
                <Text
                  variant="body1"
                  weight="medium"
                  color={theme.colors.textSecondary}
                >
                  {loc.spokenLanguageDescription}
                </Text>
              )}
            </Animated.View>
          }
          ListEmptyComponent={<NoLanguagesFound />}
          renderItem={({ item: language }) => (
            <LanguageListItem
              testID={dynamicTestID.language(language.code)}
              language={language}
              selected={language.code === effectiveLanguageCode}
              enabled={!isSaving}
              onSelect={handleSelect}
            />
          )}
        />
      </AppBarBlurTarget>

      <TopAppBar
        title={loc.spokenLanguageTitle}
        blurTarget={blurTargetRef}
        scrolled={scrolled}
        onBackPressed={leave}
        actions={[
          headerAction(
            "search",
            loc.searchLanguage,
            openSearch,
            TestID.LanguageSearchOpen,
          ),
          headerAction("close", loc.close, leave, TestID.LanguageSearchClose),
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  // With the rows' 16 gap, 24 between the intro or field and the list.
  header: {
    marginBottom: 8,
  },
});
