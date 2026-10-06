import { useState } from "react";
import { Keyboard, ScrollView, StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { dynamicTestID } from "@/constants";
import { useKeyboardHeight, useLocalization } from "@/hooks";
import { getCountryCode, SpokenLanguage, SupportedLanguages } from "@/models";
import { darkColors, spacing } from "@/theme";

import { Button } from "../../../ui/button/Button";
import { FlagIcon } from "../../../ui/icon/FlagIcon";
import { Radio } from "../../../ui/radio/Radio";
import { Text } from "../../../ui/text/Text";
import { TextField } from "../../../ui/textfield/TextField";
import { ListItem } from "../../../shared/list-item/ListItem";
import { NoLanguagesFound } from "../../../shared/no-languages-found/NoLanguagesFound";
import { OnboardingHeader } from "../header/OnboardingHeader";

const SPOKEN_LANGUAGE_STEP = 3;

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
  const [query, setQuery] = useState("");
  // Pinned at mount so the list doesn't reorder on each pick.
  const [pinnedCode] = useState(selectedCode);
  const results = SupportedLanguages.pinFirst(
    SupportedLanguages.search(languages, query),
    pinnedCode,
  );
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />
      <OnboardingHeader
        step={SPOKEN_LANGUAGE_STEP}
        onBack={onBack}
        onSkip={onSkip}
        testID={testID}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: landscape ? spacing.sm : spacing.xl,
            paddingBottom: Math.max(keyboardHeight, insets.bottom) + spacing.md,
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
      >
        <Text
          variant="h4"
          weight="medium"
          align="center"
          color={darkColors.textPrimary}
          style={styles.title}
        >
          {loc.onboardingSpokenLanguageTitle}
        </Text>

        <TextField
          label={loc.searchLanguage}
          value={query}
          onChangeText={setQuery}
          variant="outlined"
          showClearIcon
          debounceTime={0}
          colors={darkColors}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {results.length === 0 && (
            <NoLanguagesFound query={query} colors={darkColors} />
          )}
          {results.map((language) => {
            const select = () => {
              Keyboard.dismiss();
              onSelect(language);
            };
            return (
              <ListItem
                key={language.code}
                testID={childTestID(dynamicTestID.language(language.code))}
                title={language.name}
                colors={darkColors}
                iconLeading={
                  <FlagIcon name={getCountryCode(language)} size={24} />
                }
                iconTrailing={
                  <Radio<string>
                    value={language.code}
                    size="small"
                    groupValue={selectedCode}
                    onValueChange={select}
                    enabled={!isSaving}
                    colors={darkColors}
                  />
                }
                onPress={isSaving ? undefined : select}
              />
            );
          })}
        </ScrollView>

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
    gap: spacing.xl,
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
