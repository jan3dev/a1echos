import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalization } from "@/hooks";
import { darkColors, spacing } from "@/theme";

import { Button } from "../../../ui/button/Button";
import { Text } from "../../../ui/text/Text";
import { OnboardingHeader } from "../header/OnboardingHeader";

const PRIVACY_IMAGE = require("@/assets/images/nothing-leaves-your-device.png");
const TUTORIAL_STEP = 4;

export interface PrivacyScreenProps {
  onBack: () => void;
  onNext: () => void;
  testID?: string;
}

export const PrivacyScreen = ({
  onBack,
  onNext,
  testID,
}: PrivacyScreenProps) => {
  const insets = useSafeAreaInsets();
  const { loc } = useLocalization();

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />
      <OnboardingHeader step={TUTORIAL_STEP} onBack={onBack} testID={testID} />

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
        <View style={styles.top}>
          <View style={styles.copy}>
            <Text
              variant="h4"
              weight="medium"
              align="center"
              color={darkColors.textPrimary}
            >
              {loc.onboardingPrivacyTitle}
            </Text>
            <Text
              variant="body1"
              weight="medium"
              align="center"
              color={darkColors.textSecondary}
            >
              {loc.onboardingPrivacySubtitle}
            </Text>
          </View>
          <View
            style={styles.illustration}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Image
              source={PRIVACY_IMAGE}
              style={styles.illustrationImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <LinearGradient
              colors={[
                `${darkColors.surfaceBackground}00`,
                darkColors.surfaceBackground,
              ]}
              style={styles.fade}
            />
          </View>
        </View>

        <Button.primary
          testID={testID ? `${testID}-next` : undefined}
          text={loc.onboardingNext}
          onPress={onNext}
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
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  top: {
    flexShrink: 1,
    minHeight: 0,
    alignItems: "center",
    gap: spacing.md,
  },
  copy: {
    alignSelf: "stretch",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  illustration: {
    height: 355,
    aspectRatio: 908 / 1065,
    flexShrink: 1,
    minHeight: 0,
  },
  illustrationImage: {
    width: "100%",
    height: "100%",
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
});
