import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  FlagIcon,
  ListItem,
  Radio,
  Screen,
  TopAppBar,
} from "@/components";
import { AppConstants, dynamicTestID, Routes } from "@/constants";
import { useLocalization, useScrollSurface } from "@/hooks";
import { getCountryCode, getModelInfo, SupportedLanguages } from "@/models";
import { useSelectedModelId } from "@/stores";
import { useTheme } from "@/theme";

export default function TranscriptionLanguageScreen() {
  const { id, language } = useLocalSearchParams<{
    id: string;
    language: string;
  }>();
  const router = useRouter();
  const { loc } = useLocalization();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);
  const { scrolled, onScroll } = useScrollSurface();

  const languages = SupportedLanguages.forCodes(
    getModelInfo(useSelectedModelId()).supportedLanguageCodes,
  );

  const select = (code: string) =>
    router.dismissTo(Routes.transcriptionEdit(id, code));

  return (
    <Screen>
      <AppBarBlurTarget targetRef={blurTargetRef} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
              paddingBottom: insets.bottom + 16,
              backgroundColor: theme.colors.surfaceBackground,
            },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {languages.map((option) => (
            <ListItem
              key={option.code}
              testID={dynamicTestID.language(option.code)}
              title={option.name}
              iconLeading={<FlagIcon name={getCountryCode(option)} size={24} />}
              iconTrailing={
                <Radio<string>
                  value={option.code}
                  size="small"
                  groupValue={language}
                  onValueChange={() => select(option.code)}
                />
              }
              onPress={() => select(option.code)}
            />
          ))}
        </ScrollView>
      </AppBarBlurTarget>

      <TopAppBar
        title={loc.spokenLanguageTitle}
        blurTarget={blurTargetRef}
        scrolled={scrolled}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
});
