import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Divider, ListItem, Radio, Text, TopAppBar } from '@/components';
import { useLocalization } from '@/hooks';
import { ModelType } from '@/models';
import { useSelectedModelType, useSetModelType } from '@/stores';
import { getShadow, useTheme } from '@/theme';
import { FeatureFlag, logError } from '@/utils';

const APP_BAR_HEIGHT = 60;

export default function ModelSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const selectedModelType = useSelectedModelType();
  const setModelType = useSetModelType();

  const handleSelect = async (modelType: ModelType) => {
    try {
      await setModelType(modelType);
      router.back();
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: 'Failed to set model type',
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

        <View
          style={[
            styles.shadowContainer,
            getShadow('card'),
            { backgroundColor: theme.colors.surfacePrimary },
          ]}
        >
          <View style={styles.clipContainer}>
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
  shadowContainer: {
    borderRadius: 8,
  },
  clipContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
});
