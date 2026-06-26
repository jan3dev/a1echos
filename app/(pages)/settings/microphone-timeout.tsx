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
import {
  KEYBOARD_MIC_TIMEOUT_OPTIONS,
  useKeyboardMicTimeout,
  useSetKeyboardMicTimeout,
} from "@/stores";
import { useTheme } from "@/theme";
import { delay, FeatureFlag, logError } from "@/utils";
import { micTimeoutLabelKey } from "@/utils/keyboard-settings/micTimeoutLabel";

export default function MicrophoneTimeoutSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);

  const selected = useKeyboardMicTimeout();
  const setMicTimeout = useSetKeyboardMicTimeout();

  const [pending, setPending] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const effective = pending ?? selected;

  const handleSelect = async (seconds: number) => {
    if (seconds === selected) {
      router.back();
      return;
    }
    if (isSaving) return;

    setPending(seconds);
    setIsSaving(true);

    const feedback = delay(400);
    try {
      await setMicTimeout(seconds);
      await feedback;
      router.back();
    } catch (error) {
      setPending(null);
      setIsSaving(false);
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to set microphone timeout",
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
        >
          <View style={styles.list}>
            {KEYBOARD_MIC_TIMEOUT_OPTIONS.map((seconds) => (
              <ListItem
                key={seconds}
                testID={`${TestID.MicTimeoutOption}-${seconds}`}
                title={loc[micTimeoutLabelKey(seconds)]}
                iconTrailing={
                  <Radio<number>
                    value={seconds}
                    size="small"
                    groupValue={effective}
                    onValueChange={
                      isSaving ? undefined : () => handleSelect(seconds)
                    }
                    enabled={!isSaving}
                  />
                }
                onPress={isSaving ? undefined : () => handleSelect(seconds)}
              />
            ))}
          </View>
        </ScrollView>
      </AppBarBlurTarget>

      <TopAppBar title={loc.micTimeoutTitle} blurTarget={blurTargetRef} />
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
