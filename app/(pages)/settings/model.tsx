import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListItem } from '../../../components/shared/list-item';
import { Divider } from '../../../components/ui/divider';
import { Radio } from '../../../components/ui/radio';
import { Text } from '../../../components/ui/text';
import { TopAppBar } from '../../../components/ui/top-app-bar';
import { useLocalization } from '../../../hooks/useLocalization';
import { ModelType } from '../../../models/ModelType';
import {
  useSelectedModelType,
  useSettingsStore,
} from '../../../stores/settingsStore';
import { getShadow, useTheme } from '../../../theme';

const APP_BAR_HEIGHT = 60;

export default function ModelSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const selectedModelType = useSelectedModelType();
  const setModelType = useSettingsStore((s) => s.setModelType);

  const handleSelect = async (modelType: ModelType) => {
    try {
      await setModelType(modelType);
      router.back();
    } catch (error) {
      console.error('Failed to set model type:', error);
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

        <View
          style={[
            styles.card,
            getShadow('card'),
            { backgroundColor: theme.colors.surfacePrimary },
          ]}
        >
          <ListItem
            title={loc.whisperModelFileTitle}
            titleTrailing={loc.whisperModelSubtitle}
            titleTrailingColor={theme.colors.textSecondary}
            iconTrailing={
              <Radio<ModelType>
                value={ModelType.WHISPER_FILE}
                groupValue={selectedModelType}
              />
            }
            onPress={() => handleSelect(ModelType.WHISPER_FILE)}
            backgroundColor={theme.colors.surfacePrimary}
          />

          <Divider color={theme.colors.surfaceBorderPrimary} />

          <ListItem
            title={loc.whisperModelRealtimeTitle}
            titleTrailing={loc.whisperModelSubtitle}
            titleTrailingColor={theme.colors.textSecondary}
            iconTrailing={
              <Radio<ModelType>
                value={ModelType.WHISPER_REALTIME}
                groupValue={selectedModelType}
              />
            }
            onPress={() => handleSelect(ModelType.WHISPER_REALTIME)}
            backgroundColor={theme.colors.surfacePrimary}
          />
        </View>
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
  card: {
    borderRadius: 8,
    overflow: 'hidden',
  },
});
