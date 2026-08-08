import { useRouter } from "expo-router";
import { useRef } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  DownloadProgressBar,
  Icon,
  ListItem,
  Screen,
  Text,
  Toggle,
  TopAppBar,
} from "@/components";
import { AppConstants, Routes, TestID } from "@/constants";
import {
  useEnsureModelDownloaded,
  useLocalization,
  useScrollSurface,
} from "@/hooks";
import { ModelId, getModelInfo } from "@/models";
import {
  useIsModelDownloaded,
  useModelDownloadProgress,
  useKeyboardAutocorrect,
  useKeyboardContextAwareAutocorrect,
  useKeyboardHaptic,
  useKeyboardLmStrength,
  useKeyboardMicTimeout,
  useKeyboardSound,
  useSetKeyboardAutocorrect,
  useSetKeyboardContextAwareAutocorrect,
  useSetKeyboardHaptic,
  useSetKeyboardSound,
  useSetSmartSplitEnabled,
  useShowKeyboardPrompt,
  useSmartSplitEnabled,
} from "@/stores";
import { useTheme } from "@/theme";
import { FeatureFlag, formatBytes, logError } from "@/utils";
import { lmStrengthLabelKey } from "@/utils/keyboard-settings/lmStrengthLabel";
import { micTimeoutLabelKey } from "@/utils/keyboard-settings/micTimeoutLabel";

const LM_SIZE_LABEL = formatBytes(getModelInfo(ModelId.KEYBOARD_LM).sizeBytes);

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
  const contextAwareAutocorrect = useKeyboardContextAwareAutocorrect();
  const setContextAwareAutocorrect = useSetKeyboardContextAwareAutocorrect();
  const lmStrength = useKeyboardLmStrength();
  const isLmDownloaded = useIsModelDownloaded(ModelId.KEYBOARD_LM);
  const lmProgress = useModelDownloadProgress(ModelId.KEYBOARD_LM);
  const ensureModelDownloaded = useEnsureModelDownloaded();
  const showKeyboardPrompt = useShowKeyboardPrompt();

  // "checking" is the pre-flight beat before the first byte lands; treating it
  // as downloading keeps the row from flickering back to its idle state.
  const isLmDownloading =
    lmProgress?.status === "downloading" || lmProgress?.status === "checking";

  const micTimeoutDisplay = loc[micTimeoutLabelKey(keyboardMicTimeout)];
  const lmStrengthDisplay = loc[lmStrengthLabelKey(lmStrength)];

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

  const handleContextAwareToggle = async (next: boolean) => {
    try {
      if (!next) {
        await setContextAwareAutocorrect(false);
        return;
      }
      if (isLmDownloaded) {
        await setContextAwareAutocorrect(true);
        return;
      }
      // Turning the feature on without the model behind it is a lie: the
      // keyboard gates the LM path on the file existing, so the setting would
      // read as on and change nothing. Fetch first and only flip on success —
      // the shared hook owns the disk-space pre-check and the failure toast,
      // and reports a user-initiated cancel as a plain `false`.
      const downloaded = await ensureModelDownloaded(ModelId.KEYBOARD_LM);
      if (downloaded) {
        await setContextAwareAutocorrect(true);
      }
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to set context-aware autocorrect",
      });
    }
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
          <ListItem
            testID={TestID.SettingsKeyboardSoundToggle}
            title={loc.keyboardSoundTitle}
            subtitle={loc.keyboardSoundDescription}
            iconTrailing={
              <Toggle
                value={keyboardSound}
                onValueChange={handleSoundToggle}
                accessibilityLabel={loc.keyboardSoundTitle}
              />
            }
            onPress={() => handleSoundToggle(!keyboardSound)}
          />
          <ListItem
            testID={TestID.SettingsContextAwareAutocorrectToggle}
            title={loc.contextAwareAutocorrectTitle}
            // While the model is in flight the row trades its description for
            // the progress readout — the description has already done its job
            // (the user just opted in) and stacking both would push the row to
            // the clipped height this replaced.
            subtitle={
              isLmDownloading
                ? undefined
                : isLmDownloaded
                  ? loc.contextAwareAutocorrectDescription
                  : `${loc.contextAwareAutocorrectDescription} ${loc.contextAwareAutocorrectDownloadHint(LM_SIZE_LABEL)}`
            }
            contentWidget={
              isLmDownloading ? (
                <View
                  testID={TestID.SettingsContextAwareAutocorrectProgress}
                  style={styles.lmProgress}
                >
                  <DownloadProgressBar ratio={lmProgress?.progressRatio ?? 0} />
                  <Text
                    variant="body2"
                    weight="medium"
                    color={theme.colors.textSecondary}
                  >
                    {`${loc.contextAwareAutocorrectDownloading} ${Math.round((lmProgress?.progressRatio ?? 0) * 100)}%`}
                  </Text>
                </View>
              ) : undefined
            }
            iconTrailing={
              <Toggle
                value={contextAwareAutocorrect}
                // Off until the bytes are actually on disk, so the switch can
                // never sit in the on position with nothing behind it.
                enabled={!isLmDownloading}
                onValueChange={
                  isLmDownloading
                    ? undefined
                    : (next) => void handleContextAwareToggle(next)
                }
                accessibilityLabel={loc.contextAwareAutocorrectTitle}
              />
            }
            onPress={
              isLmDownloading
                ? undefined
                : () => void handleContextAwareToggle(!contextAwareAutocorrect)
            }
          />
          {contextAwareAutocorrect && (
            <ListItem
              testID={TestID.SettingsLmStrengthRow}
              title={loc.lmStrengthTitle}
              subtitle={loc.lmStrengthDescription}
              titleTrailing={lmStrengthDisplay}
              titleTrailingColor={theme.colors.textSecondary}
              iconTrailing={
                <Icon
                  name="chevron_right"
                  size={24}
                  color={theme.colors.textSecondary}
                />
              }
              onPress={() => router.push(Routes.settingsLmStrength)}
            />
          )}
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
  lmProgress: {
    marginTop: 8,
    gap: 6,
  },
});
