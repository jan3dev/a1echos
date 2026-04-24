import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FlagIcon, Screen, Text, TopAppBar } from "@/components";
import { AppConstants } from "@/constants";
import { useLocalization } from "@/hooks";
import type { ModelId } from "@/models";
import {
  MODEL_REGISTRY,
  SupportedLanguages,
  getModelInfo,
  getCountryCode,
} from "@/models";
import { useSelectedModelId } from "@/stores";
import { useTheme } from "@/theme";

export default function ModelLanguagesScreen() {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ modelId?: string }>();
  const selectedModelId = useSelectedModelId();

  const modelId =
    params.modelId && params.modelId in MODEL_REGISTRY
      ? (params.modelId as ModelId)
      : selectedModelId;

  const modelInfo = getModelInfo(modelId);
  const languages = useMemo(
    () => SupportedLanguages.forCodes(modelInfo.supportedLanguageCodes),
    [modelInfo.supportedLanguageCodes],
  );

  return (
    <Screen>
      <TopAppBar title="" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text variant="h4" weight="semibold" color={theme.colors.textPrimary}>
            {modelInfo.name}
          </Text>
          <Text
            variant="body1"
            weight="medium"
            color={theme.colors.textSecondary}
          >
            {loc.languagesSupported(languages.length)}
          </Text>
        </View>

        <View style={styles.chipsGrid}>
          {languages.map((language) => (
            <View
              key={language.code}
              testID={`language-chip-${language.code}`}
              style={[
                styles.chip,
                {
                  backgroundColor: theme.colors.surfacePrimary,
                  borderColor: theme.colors.surfaceBorderPrimary,
                },
              ]}
            >
              <FlagIcon name={getCountryCode(language)} size={16} />
              <Text
                variant="body2"
                weight="medium"
                color={theme.colors.textSecondary}
              >
                {language.name}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
});
