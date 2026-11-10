import { useMemo, useState } from "react";
import { FlatList, Keyboard, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SystemBars } from "react-native-edge-to-edge";
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { dynamicTestID } from "@/constants";
import {
  LANGUAGE_LIST_WINDOW,
  SEARCH_FADE_MS,
  useKeyboardHeight,
  useLanguageSearch,
  useLocalization,
} from "@/hooks";
import { SpokenLanguage, SupportedLanguages } from "@/models";
import { darkColors, spacing } from "@/theme";

import { Button } from "../../../ui/button/Button";
import { Text } from "../../../ui/text/Text";
import { TextField } from "../../../ui/textfield/TextField";
import { LanguageListItem } from "../../../shared/language-list-item/LanguageListItem";
import { NoLanguagesFound } from "../../../shared/no-languages-found/NoLanguagesFound";
import { OnboardingHeader } from "../header/OnboardingHeader";

const SPOKEN_LANGUAGE_STEP = 3;
const LANGUAGE_ROWS_FIRST_RENDER = 12;

export interface SpokenLanguageScreenProps {
  languages: SpokenLanguage[];
  selectedCode: string;
  onSelect: (language: SpokenLanguage) => void;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
  isSaving?: boolean;
  testID?: string;
}

/** Presentational only — persisting the language and navigation live at the route. */
export const SpokenLanguageScreen = ({
  languages,
  selectedCode,
  onSelect,
  onBack,
  onSkip,
  onNext,
  isSaving = false,
  testID,
}: SpokenLanguageScreenProps) => {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const frame = useSafeAreaFrame();
  const landscape = frame.width > frame.height;
  const { loc } = useLocalization();
  const search = useLanguageSearch();
  // Pinned at mount so the list doesn't reorder on each pick.
  const [pinnedCode] = useState(selectedCode);
  const { query } = search;
  // Keyed on primitives so toggling search doesn't re-render every row.
  const results = useMemo(
    () =>
      SupportedLanguages.pickerOrder(
        SupportedLanguages.search(languages, query),
        pinnedCode,
      ),
    [languages, query, pinnedCode],
  );
  const select = (language: SpokenLanguage) => {
    Keyboard.dismiss();
    onSelect(language);
  };
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />
      <OnboardingHeader
        step={SPOKEN_LANGUAGE_STEP}
        onBack={onBack}
        onSkip={onSkip}
        search={{
          active: search.searching,
          onOpen: search.open,
          onClose: () => search.close(),
        }}
        testID={testID}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: landscape
              ? spacing.sm
              : search.searching
                ? spacing.md
                : spacing.xl,
            gap: search.searching ? spacing.lg : spacing.xl,
            // Next stays put under the keyboard; the list scrolls clear of it.
            paddingBottom: insets.bottom + spacing.md,
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
      >
        <Animated.View
          key={search.searching ? "search" : "title"}
          entering={FadeIn.duration(SEARCH_FADE_MS)}
          exiting={FadeOut.duration(SEARCH_FADE_MS)}
          style={search.searching ? undefined : styles.title}
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
              colors={darkColors}
            />
          ) : (
            <Text
              variant="h4"
              weight="medium"
              align="center"
              color={darkColors.textPrimary}
            >
              {loc.onboardingSpokenLanguageTitle}
            </Text>
          )}
        </Animated.View>

        <FlatList
          data={results}
          keyExtractor={(language) => language.code}
          initialNumToRender={LANGUAGE_ROWS_FIRST_RENDER}
          windowSize={LANGUAGE_LIST_WINDOW}
          style={styles.scroll}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: keyboardHeight },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={<NoLanguagesFound colors={darkColors} />}
          renderItem={({ item: language }) => (
            <LanguageListItem
              testID={childTestID(dynamicTestID.language(language.code))}
              language={language}
              selected={language.code === selectedCode}
              enabled={!isSaving}
              onSelect={select}
              colors={darkColors}
            />
          )}
        />

        <Button.primary
          testID={childTestID("next")}
          text={loc.onboardingNext}
          onPress={onNext}
          isLoading={isSaving}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: darkColors.surfaceBackground,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
  title: {
    flexShrink: 0,
    paddingHorizontal: spacing.xl,
  },
  scroll: {
    flex: 1,
  },
  list: {
    gap: spacing.md,
  },
});
