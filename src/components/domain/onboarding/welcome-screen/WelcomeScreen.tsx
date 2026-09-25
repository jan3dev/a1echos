import { StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useLocalization } from "@/hooks";
import { darkColors, spacing } from "@/theme";

import { AmbientGlow } from "../../../shared/ambient-glow/AmbientGlow";
import { Icon } from "../../../ui/icon/Icon";
import { Text } from "../../../ui/text/Text";
import { GlowCtaButton } from "../glow-cta-button/GlowCtaButton";

export interface WelcomeScreenProps {
  onGetStarted: () => void;
  testID?: string;
}

/**
 * First-launch welcome screen. Dark-fixed (uses `darkColors` regardless of the
 * active theme) so the ambient glow reads correctly, matching the design.
 * Presentational only — persistence and navigation live at the route.
 */
export const WelcomeScreen = ({ onGetStarted, testID }: WelcomeScreenProps) => {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const landscape = frame.width > frame.height;
  const { loc } = useLocalization();

  return (
    <View
      testID={testID}
      style={[styles.root, { backgroundColor: darkColors.surfaceBackground }]}
    >
      <SystemBars style="light" />
      <AmbientGlow />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + (landscape ? spacing.sm : spacing.lg),
            paddingBottom: insets.bottom + spacing.md,
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
      >
        <View style={[styles.intro, landscape && styles.introLandscape]}>
          <Icon name="echos_mark" size={64} color={darkColors.textPrimary} />
          <View style={styles.copy}>
            <Text
              variant="h4"
              weight="medium"
              align="center"
              color={darkColors.textPrimary}
            >
              {loc.welcomeTitle}
            </Text>
            <Text
              variant="body1"
              weight="medium"
              align="center"
              color={darkColors.textSecondary}
            >
              {loc.welcomeSubtitle}
            </Text>
          </View>
        </View>

        <View style={styles.cta}>
          <GlowCtaButton
            text={loc.welcomeGetStarted}
            onPress={onGetStarted}
            testID={testID ? `${testID}-cta` : undefined}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  intro: {
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  introLandscape: {
    gap: spacing.md,
  },
  copy: {
    alignItems: "center",
    gap: spacing.md,
  },
  cta: {
    minHeight: 56,
    justifyContent: "center",
    alignSelf: "stretch",
  },
});
