import { useRouter } from "expo-router";
import { type ReactNode, useRef } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  Icon,
  ListItem,
  Screen,
  Text,
  Toggle,
  TopAppBar,
} from "@/components";
import { AppConstants, Routes, TestID } from "@/constants";
import { useLocalization, useScrollSurface } from "@/hooks";
import {
  useKeyboardAutocorrect,
  useKeyboardHaptic,
  useKeyboardMicTimeout,
  useKeyboardSound,
  useSetKeyboardAutocorrect,
  useSetKeyboardHaptic,
  useSetKeyboardSound,
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
  const keyboardSound = useKeyboardSound();
  const setKeyboardSound = useSetKeyboardSound();
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

  const handleSoundToggle = (next: boolean) => {
    void setKeyboardSound(next);
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
          <Captioned caption={loc.smartSplitDescription}>
            <ListItem
              testID={TestID.SettingsSmartSplitToggle}
              title={loc.smartSplitTitle}
              iconTrailing={
                <Toggle
                  value={smartSplitEnabled}
                  onValueChange={handleToggle}
                  accessibilityLabel={loc.smartSplitTitle}
                />
              }
              onPress={() => handleToggle(!smartSplitEnabled)}
            />
          </Captioned>
          <Captioned caption={loc.keyboardAutocorrectDescription}>
            <ListItem
              testID={TestID.SettingsKeyboardAutocorrectToggle}
              title={loc.keyboardAutocorrectTitle}
              iconTrailing={
                <Toggle
                  value={keyboardAutocorrect}
                  onValueChange={handleAutocorrectToggle}
                  accessibilityLabel={loc.keyboardAutocorrectTitle}
                />
              }
              onPress={() => handleAutocorrectToggle(!keyboardAutocorrect)}
            />
          </Captioned>
          <Captioned caption={loc.keyboardHapticDescription}>
            <ListItem
              testID={TestID.SettingsKeyboardHapticToggle}
              title={loc.keyboardHapticTitle}
              iconTrailing={
                <Toggle
                  value={keyboardHaptic}
                  onValueChange={handleHapticToggle}
                  accessibilityLabel={loc.keyboardHapticTitle}
                />
              }
              onPress={() => handleHapticToggle(!keyboardHaptic)}
            />
          </Captioned>
          <Captioned caption={loc.keyboardSoundDescription}>
            <ListItem
              testID={TestID.SettingsKeyboardSoundToggle}
              title={loc.keyboardSoundTitle}
              iconTrailing={
                <Toggle
                  value={keyboardSound}
                  onValueChange={handleSoundToggle}
                  accessibilityLabel={loc.keyboardSoundTitle}
                />
              }
              onPress={() => handleSoundToggle(!keyboardSound)}
            />
          </Captioned>
          {/* The keyboard mic timeout only affects the iOS keyboard's hot-mic
              session; it has no effect on Android, so hide the row there. */}
          {Platform.OS === "ios" && (
            <Captioned caption={loc.micTimeoutDescription}>
              <ListItem
                testID={TestID.SettingsMicTimeoutRow}
                title={loc.micTimeoutTitle}
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
            </Captioned>
          )}
          <Captioned caption={loc.advancedSettingsAddKeyboardDescription}>
            <ListItem
              testID={TestID.SettingsAddKeyboardRow}
              title={loc.advancedSettingsAddKeyboardTitle}
              iconTrailing={
                <Icon
                  name="chevron_right"
                  size={24}
                  color={theme.colors.textSecondary}
                />
              }
              onPress={showKeyboardPrompt}
            />
          </Captioned>
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

function Captioned({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.captioned}>
      {children}
      <Text
        variant="caption1"
        weight="medium"
        color={theme.colors.textSecondary}
      >
        {caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    gap: 24,
  },
  captioned: {
    gap: 8,
  },
});
