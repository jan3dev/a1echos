import { useLocalSearchParams } from "expo-router";
import { useMemo, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  Chip,
  FlagIcon,
  Screen,
  Text,
  TopAppBar,
} from "@/components";
import { AppConstants } from "@/constants";
import { useLocalization, useScrollSurface } from "@/hooks";
import type { ModelId } from "@/models";
import {
  MODEL_REGISTRY,
  SupportedLanguages,
  getCountryCode,
  getModelInfo,
} from "@/models";
import { useSelectedModelId } from "@/stores";
import { useTheme } from "@/theme";

export default function ModelLanguagesScreen() {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);
  const { scrolled, onScroll } = useScrollSurface();
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
      {/* Bars render after content so Android's blur target ref is populated
          before the bar's BlurView mounts and resolves its `blurTarget`. */}
      <AppBarBlurTarget targetRef={blurTargetRef} style={{ flex: 1 }}>
        <ScrollView
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
        >
          <View style={styles.header}>
            <Text
              variant="h4"
              weight="semibold"
              color={theme.colors.textPrimary}
            >
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
              <Chip
                key={language.code}
                testID={`language-chip-${language.code}`}
                size="large"
                label={language.name}
                iconLeading={
                  <FlagIcon name={getCountryCode(language)} size={16} />
                }
              />
            ))}
          </View>
        </ScrollView>
      </AppBarBlurTarget>

      <TopAppBar title="" blurTarget={blurTargetRef} scrolled={scrolled} />
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
});
