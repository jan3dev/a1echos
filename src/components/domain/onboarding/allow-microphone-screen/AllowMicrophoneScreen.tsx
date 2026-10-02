import { useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useLocalization } from "@/hooks";
import { darkColors, spacing } from "@/theme";

import { RecordingButton } from "../../../shared/recording-controls/RecordingButton";
import { Button } from "../../../ui/button/Button";
import { Text } from "../../../ui/text/Text";
import { OnboardingHeader } from "../header/OnboardingHeader";

import { GRADIENT_BARS_HEIGHT, GradientBars } from "./GradientBars";

const ALLOW_MICROPHONE_STEP = 1;
const RECORD_BUTTON_SIZE = 80;
// Hangs below the bars' baseline to match the design.
const RECORD_BUTTON_OVERHANG = 8;

export interface AllowMicrophoneScreenProps {
  onBack: () => void;
  onSkip: () => void;
  onAllow: () => void;
  testID?: string;
}

/**
 * Dark-fixed like WelcomeScreen, so the header is inline rather than TopAppBar.
 * Presentational only — permission, toasts and navigation live at the route.
 */
export const AllowMicrophoneScreen = ({
  onBack,
  onSkip,
  onAllow,
  testID,
}: AllowMicrophoneScreenProps) => {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const landscape = frame.width > frame.height;
  const { loc } = useLocalization();
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;
  const [artHeight, setArtHeight] = useState(0);

  const onArtLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setArtHeight((prev) => (prev === next ? prev : next));
  };

  // Reserve the overhang inside the art box so the button is never clipped.
  const barsHeight =
    artHeight > 0
      ? Math.min(GRADIENT_BARS_HEIGHT, artHeight - RECORD_BUTTON_OVERHANG)
      : undefined;

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />

      <OnboardingHeader
        step={ALLOW_MICROPHONE_STEP}
        onBack={onBack}
        onSkip={onSkip}
        testID={testID}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: landscape ? spacing.sm : spacing.xl,
            paddingBottom: insets.bottom + spacing.md,
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
      >
        <Text
          variant="h4"
          weight="medium"
          align="center"
          color={darkColors.textPrimary}
          style={styles.title}
        >
          {loc.onboardingAllowMicrophoneTitle}
        </Text>

        <View style={styles.illustration}>
          <View style={styles.art} onLayout={onArtLayout}>
            <GradientBars testID={childTestID("bars")} height={barsHeight} />
            <View style={styles.recordButton}>
              <RecordingButton colors={darkColors} onRecordingStart={onAllow} />
            </View>
          </View>
        </View>

        <View style={styles.cta}>
          <Button.primary
            testID={childTestID("allow")}
            text={loc.onboardingAllow}
            onPress={onAllow}
          />
        </View>
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
    alignItems: "center",
  },
  title: {
    flexShrink: 0,
  },
  illustration: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: RECORD_BUTTON_SIZE,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  art: {
    width: "100%",
    height: "100%",
    maxHeight: GRADIENT_BARS_HEIGHT + RECORD_BUTTON_OVERHANG,
    minHeight: RECORD_BUTTON_SIZE,
    alignItems: "center",
  },
  recordButton: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
  },
  cta: {
    flexShrink: 0,
    alignSelf: "stretch",
    width: "100%",
  },
});
