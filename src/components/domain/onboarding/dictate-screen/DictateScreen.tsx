import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardHeight, useLocalization } from "@/hooks";
import { AquaTypography, darkColors, spacing } from "@/theme";

import { AmbientGlow } from "../../../shared/ambient-glow/AmbientGlow";
import { Button } from "../../../ui/button/Button";
import { Text } from "../../../ui/text/Text";
import { OnboardingHeader } from "../header/OnboardingHeader";

const TUTORIAL_STEP = 1;

export interface DictateScreenProps {
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
  testID?: string;
}

/** Next appears once the user has dictated (or typed) into the field. */
export const DictateScreen = ({
  onBack,
  onSkip,
  onNext,
  testID,
}: DictateScreenProps) => {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { loc } = useLocalization();
  const [text, setText] = useState("");
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />
      <AmbientGlow />
      <OnboardingHeader
        step={TUTORIAL_STEP}
        onBack={onBack}
        onSkip={onSkip}
        testID={testID}
      />

      <View
        style={[
          styles.content,
          {
            paddingBottom: Math.max(keyboardHeight, insets.bottom) + spacing.md,
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
            {loc.onboardingDictateTitle}
          </Text>
          <Text
            variant="body1"
            weight="medium"
            align="center"
            color={darkColors.textSecondary}
          >
            {loc.onboardingDictateSubtitle}
          </Text>
        </View>

        <TextInput
          testID={childTestID("input")}
          value={text}
          onChangeText={setText}
          placeholder={loc.onboardingDictatePlaceholder}
          placeholderTextColor={darkColors.textSecondary}
          accessibilityLabel={loc.onboardingDictatePlaceholder}
          autoFocus
          multiline
          keyboardAppearance="dark"
          textAlignVertical="top"
          style={styles.field}
        />

        {text.trim().length > 0 && (
          <View style={styles.cta}>
            <Button.primary
              testID={childTestID("next")}
              text={loc.onboardingNext}
              onPress={onNext}
            />
          </View>
        )}
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
    paddingTop: spacing.xl,
  },
  copy: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  field: {
    ...AquaTypography.body1,
    height: 120,
    flexShrink: 1,
    minHeight: 56,
    padding: spacing.md,
    paddingTop: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: darkColors.surfaceTertiary,
    backgroundColor: darkColors.surfacePrimary,
    color: darkColors.textPrimary,
  },
  cta: {
    marginTop: spacing.md,
  },
});
