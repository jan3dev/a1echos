import { StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalization } from "@/hooks";
import { darkColors, spacing } from "@/theme";

import { AmbientGlow } from "../../../shared/ambient-glow/AmbientGlow";
import { Text } from "../../../ui/text/Text";
import { GlowCtaButton } from "../glow-cta-button/GlowCtaButton";
import { OnboardingHeader } from "../header/OnboardingHeader";

export interface TutorialIntroScreenProps {
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
  testID?: string;
}

/** Opens the tutorial, which counts its own steps, so no step indicator. */
export const TutorialIntroScreen = ({
  onBack,
  onSkip,
  onNext,
  testID,
}: TutorialIntroScreenProps) => {
  const insets = useSafeAreaInsets();
  const { loc } = useLocalization();

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />
      <AmbientGlow />
      <OnboardingHeader onBack={onBack} onSkip={onSkip} testID={testID} />

      <View
        style={[
          styles.content,
          {
            paddingBottom: insets.bottom + spacing.md,
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
      >
        <View style={styles.copy}>
          <Text
            variant="h4"
            weight="medium"
            align="center"
            color={darkColors.textPrimary}
          >
            {loc.onboardingTutorialIntroTitle}
          </Text>
          <Text
            variant="body1"
            weight="medium"
            align="center"
            color={darkColors.textSecondary}
          >
            {loc.onboardingTutorialIntroSubtitle}
          </Text>
        </View>

        <GlowCtaButton
          text={loc.onboardingNext}
          onPress={onNext}
          testID={testID ? `${testID}-next` : undefined}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: darkColors.surfaceBackground,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
  copy: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});
