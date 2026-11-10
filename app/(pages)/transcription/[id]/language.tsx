import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef } from "react";
import { ScrollView, StyleSheet, type HostInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  LanguageListItem,
  Screen,
  TopAppBar,
} from "@/components";
import { AppConstants, dynamicTestID, Routes } from "@/constants";
import { useLocalization, useScrollSurface } from "@/hooks";
import { getModelInfo, SupportedLanguages } from "@/models";
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
  const blurTargetRef = useRef<HostInstance>(null);
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
            <LanguageListItem
              key={option.code}
              testID={dynamicTestID.language(option.code)}
              language={option}
              selected={option.code === language}
              onSelect={(picked) => select(picked.code)}
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
