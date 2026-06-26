import { useRouter } from "expo-router";
import { useRef } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  Icon,
  ListItem,
  Screen,
  Toggle,
  TopAppBar,
} from "@/components";
import { AppConstants, Routes, TestID } from "@/constants";
import { useLocalization, useScrollSurface } from "@/hooks";
import {
  useKeyboardAutocorrect,
  useKeyboardHaptic,
  useKeyboardMicTimeout,
  useSetKeyboardAutocorrect,
  useSetKeyboardHaptic,
  useSetSmartSplitEnabled,
  useShowKeyboardPrompt,
  useSmartSplitEnabled,
} from "@/stores";
import { useTheme } from "@/theme";
import { micTimeoutLabelKey } from "@/utils/keyboard-settings/micTimeoutLabel";

export default function AdvancedSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);
  const { scrolled, onScroll } = useScrollSurface();

  const smartSplitEnabled = useSmartSplitEnabled();
  const setSmartSplitEnabled = useSetSmartSplitEnabled();
  const keyboardAutocorrect = useKeyboardAutocorrect();
  const setKeyboardAutocorrect = useSetKeyboardAutocorrect();
  const keyboardHaptic = useKeyboardHaptic();
  const setKeyboardHaptic = useSetKeyboardHaptic();
  const keyboardMicTimeout = useKeyboardMicTimeout();
  const showKeyboardPrompt = useShowKeyboardPrompt();

  const micTimeoutDisplay = loc[micTimeoutLabelKey(keyboardMicTimeout)];

  const handleToggle = (next: boolean) => {
    void setSmartSplitEnabled(next);
  };

  const handleAutocorrectToggle = (next: boolean) => {
    void setKeyboardAutocorrect(next);
  };

  const handleHapticToggle = (next: boolean) => {
    void setKeyboardHaptic(next);
  };

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
          <ListItem
            testID={TestID.SettingsSmartSplitToggle}
            title={loc.smartSplitTitle}
            subtitle={loc.smartSplitDescription}
            iconTrailing={
              <Toggle
                value={smartSplitEnabled}
                onValueChange={handleToggle}
                accessibilityLabel={loc.smartSplitTitle}
              />
            }
            onPress={() => handleToggle(!smartSplitEnabled)}
          />
          <ListItem
            testID={TestID.SettingsKeyboardAutocorrectToggle}
            title={loc.keyboardAutocorrectTitle}
            subtitle={loc.keyboardAutocorrectDescription}
            iconTrailing={
              <Toggle
                value={keyboardAutocorrect}
                onValueChange={handleAutocorrectToggle}
                accessibilityLabel={loc.keyboardAutocorrectTitle}
              />
            }
            onPress={() => handleAutocorrectToggle(!keyboardAutocorrect)}
          />
          <ListItem
            testID={TestID.SettingsKeyboardHapticToggle}
            title={loc.keyboardHapticTitle}
            subtitle={loc.keyboardHapticDescription}
            iconTrailing={
              <Toggle
                value={keyboardHaptic}
                onValueChange={handleHapticToggle}
                accessibilityLabel={loc.keyboardHapticTitle}
              />
            }
            onPress={() => handleHapticToggle(!keyboardHaptic)}
          />
          {/* The keyboard mic timeout only affects the iOS keyboard's hot-mic
              session; it has no effect on Android, so hide the row there. */}
          {Platform.OS === "ios" && (
            <ListItem
              testID={TestID.SettingsMicTimeoutRow}
              title={loc.micTimeoutTitle}
              subtitle={loc.micTimeoutDescription}
              titleTrailing={micTimeoutDisplay}
              titleTrailingColor={theme.colors.textSecondary}
              iconTrailing={
                <Icon
                  name="chevron_right"
                  size={24}
                  color={theme.colors.textSecondary}
                />
              }
              onPress={() => router.push(Routes.settingsMicTimeout)}
            />
          )}
          <ListItem
            testID={TestID.SettingsAddKeyboardRow}
            title={loc.advancedSettingsAddKeyboardTitle}
            subtitle={loc.advancedSettingsAddKeyboardDescription}
            iconTrailing={
              <Icon
                name="chevron_right"
                size={24}
                color={theme.colors.textSecondary}
              />
            }
            onPress={showKeyboardPrompt}
          />
        </ScrollView>
      </AppBarBlurTarget>

      <TopAppBar
        title={loc.advancedSettingsTitle}
        blurTarget={blurTargetRef}
        scrolled={scrolled}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
});
