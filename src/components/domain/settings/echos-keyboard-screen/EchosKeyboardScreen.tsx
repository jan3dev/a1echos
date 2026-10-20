import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppConstants } from "@/constants";
import { useLocalization } from "@/hooks";
import { spacing, useTheme } from "@/theme";
import { iosPressed } from "@/utils";

import { Screen } from "../../../shared/screen/Screen";
import { Button } from "../../../ui/button/Button";
import { Icon } from "../../../ui/icon/Icon";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { TopAppBar } from "../../../ui/top-app-bar/TopAppBar";
import {
  SettingsWalkthrough,
  useSettingsWalkthrough,
} from "../../onboarding/enable-keyboard-screen/SettingsWalkthrough";

export interface EchosKeyboardScreenProps {
  onClose: () => void;
  onAddKeyboard: () => void;
  /** Checking the keyboard after the return from Settings. */
  checking?: boolean;
  testID?: string;
}

/**
 * Presentational only — opening Settings and navigation live at the route.
 */
export const EchosKeyboardScreen = ({
  onClose,
  onAddKeyboard,
  checking,
  testID,
}: EchosKeyboardScreenProps) => {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { loc } = useLocalization();
  const { t } = useSettingsWalkthrough();
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;

  return (
    <Screen>
      <View
        testID={testID}
        style={[
          styles.content,
          {
            paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + spacing.xl,
            paddingBottom: insets.bottom + spacing.md,
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
      >
        <SettingsWalkthrough t={t} dark={isDark} testID={testID} />

        <View style={styles.ctas}>
          <Button.primary
            testID={childTestID("add-keyboard")}
            text={loc.keyboardPromptCta}
            isLoading={checking}
            onPress={onAddKeyboard}
          />
          <Button.secondary
            testID={childTestID("maybe-later")}
            text={loc.keyboardPromptDismiss}
            onPress={onClose}
          />
        </View>
      </View>

      <TopAppBar
        title={loc.advancedSettingsKeyboardTitle}
        onBackPressed={onClose}
        actions={[
          <RipplePressable
            key="close"
            testID={childTestID("close")}
            onPress={onClose}
            hitSlop={10}
            rippleColor={theme.colors.ripple}
            borderless
            accessibilityRole="button"
            accessibilityLabel={loc.close}
            style={({ pressed }) => ({ opacity: iosPressed(pressed) })}
          >
            <Icon name="close" size={24} color={theme.colors.textPrimary} />
          </RipplePressable>,
        ]}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    minHeight: 0,
  },
  ctas: {
    flexShrink: 0,
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
