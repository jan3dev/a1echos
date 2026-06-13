import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  ListItem,
  Radio,
  Screen,
  TopAppBar,
} from "@/components";
import { AppConstants, TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { AppTheme } from "@/models";
import { useSetTheme } from "@/stores";
import { useTheme } from "@/theme";
import { delay, FeatureFlag, logError } from "@/utils";

export default function ThemeSettingsScreen() {
  const router = useRouter();
  const { selectedTheme, setTheme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);

  const setSettingsTheme = useSetTheme();

  const [pendingTheme, setPendingTheme] = useState<AppTheme | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const effectiveTheme = pendingTheme ?? selectedTheme;

  const handleSelect = async (appTheme: AppTheme) => {
    if (appTheme === selectedTheme) {
      router.back();
      return;
    }
    if (isSaving) return;

    setPendingTheme(appTheme);
    setIsSaving(true);

    const feedback = delay(400);
    try {
      await setTheme(appTheme);
      await setSettingsTheme(appTheme);
      await feedback;
      router.back();
    } catch (error) {
      setPendingTheme(null);
      setIsSaving(false);
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to set theme",
      });
    }
  };

  return (
    <Screen>
      <TopAppBar title={loc.themeTitle} blurTarget={blurTargetRef} />

      <AppBarBlurTarget targetRef={blurTargetRef} style={{ flex: 1 }}>
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
          <View style={styles.list}>
            <ListItem
              testID={TestID.ThemeAuto}
              title={loc.auto}
              iconTrailing={
                <Radio<AppTheme>
                  value={AppTheme.AUTO}
                  size="small"
                  groupValue={effectiveTheme}
                  onValueChange={
                    isSaving ? undefined : () => handleSelect(AppTheme.AUTO)
                  }
                  enabled={!isSaving}
                />
              }
              onPress={isSaving ? undefined : () => handleSelect(AppTheme.AUTO)}
            />

            <ListItem
              testID={TestID.ThemeLight}
              title={loc.light}
              iconTrailing={
                <Radio<AppTheme>
                  value={AppTheme.LIGHT}
                  size="small"
                  groupValue={effectiveTheme}
                  onValueChange={
                    isSaving ? undefined : () => handleSelect(AppTheme.LIGHT)
                  }
                  enabled={!isSaving}
                />
              }
              onPress={
                isSaving ? undefined : () => handleSelect(AppTheme.LIGHT)
              }
            />

            <ListItem
              testID={TestID.ThemeDark}
              title={loc.dark}
              iconTrailing={
                <Radio<AppTheme>
                  value={AppTheme.DARK}
                  size="small"
                  groupValue={effectiveTheme}
                  onValueChange={
                    isSaving ? undefined : () => handleSelect(AppTheme.DARK)
                  }
                  enabled={!isSaving}
                />
              }
              onPress={isSaving ? undefined : () => handleSelect(AppTheme.DARK)}
            />
          </View>
        </ScrollView>
      </AppBarBlurTarget>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
  },
  list: {
    gap: 16,
  },
});
