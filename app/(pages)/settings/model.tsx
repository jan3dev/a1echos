import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, Divider, ListItem, Radio, Text, TopAppBar } from "@/components";
import { useLocalization } from "@/hooks";
import { ModelType } from "@/models";
import { useSelectedModelType, useSetModelType } from "@/stores";
import { useTheme } from "@/theme";
import { delay, FeatureFlag, logError } from "@/utils";

const APP_BAR_HEIGHT = 60;

export default function ModelSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const selectedModelType = useSelectedModelType();
  const setModelType = useSetModelType();

  const [pendingModelType, setPendingModelType] = useState<ModelType | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const effectiveModelType = pendingModelType ?? selectedModelType;

  const handleSelect = async (modelType: ModelType) => {
    if (modelType === selectedModelType) {
      router.back();
      return;
    }
    if (isSaving) return;

    setPendingModelType(modelType);
    setIsSaving(true);

    const feedback = delay(400);
    try {
      await setModelType(modelType);
      await feedback;
      router.back();
    } catch (error) {
      setPendingModelType(null);
      setIsSaving(false);
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to set model type",
      });
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <TopAppBar title={loc.modelTitle} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + APP_BAR_HEIGHT + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text
          variant="body1"
          color={theme.colors.textPrimary}
          style={styles.description}
        >
          {loc.modelDescription}
        </Text>

        <Card>
          <ListItem
            testID="model-whisper-file"
            title={loc.whisperModelFileTitle}
            titleTrailing={loc.whisperModelFileSubtitle}
            titleTrailingColor={theme.colors.textSecondary}
            iconTrailing={
              <Radio<ModelType>
                value={ModelType.WHISPER_FILE}
                groupValue={effectiveModelType}
                onValueChange={
                  isSaving
                    ? undefined
                    : () => handleSelect(ModelType.WHISPER_FILE)
                }
                enabled={!isSaving}
              />
            }
            onPress={
              isSaving ? undefined : () => handleSelect(ModelType.WHISPER_FILE)
            }
            backgroundColor={theme.colors.surfacePrimary}
          />

          <Divider color={theme.colors.surfaceBorderPrimary} />

          <ListItem
            testID="model-whisper-realtime"
            title={loc.whisperModelRealtimeTitle}
            titleTrailing={loc.whisperModelRealtimeSubtitle}
            titleTrailingColor={theme.colors.textSecondary}
            iconTrailing={
              <Radio<ModelType>
                value={ModelType.WHISPER_REALTIME}
                groupValue={effectiveModelType}
                onValueChange={
                  isSaving
                    ? undefined
                    : () => handleSelect(ModelType.WHISPER_REALTIME)
                }
                enabled={!isSaving}
              />
            }
            onPress={
              isSaving
                ? undefined
                : () => handleSelect(ModelType.WHISPER_REALTIME)
            }
            backgroundColor={theme.colors.surfacePrimary}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  description: {
    marginBottom: 16,
  },
});
