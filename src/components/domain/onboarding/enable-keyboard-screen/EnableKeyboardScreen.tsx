import { Platform, StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import KeyboardTile from "@/assets/icons/keyboard_tile.svg";
import { useLocalization } from "@/hooks";
import { AquaPrimitiveColors, darkColors, spacing } from "@/theme";

import { Button } from "../../../ui/button/Button";
import { Icon } from "../../../ui/icon/Icon";
import { Text } from "../../../ui/text/Text";
import { Toggle } from "../../../ui/toggle/Toggle";
import { OnboardingHeader } from "../header/OnboardingHeader";

const ENABLE_KEYBOARD_STEP = 3;
// Mimics the system Settings list, so these are iOS system colors, not theme tokens.
const SYSTEM_GROUPED_BACKGROUND = "#1C1C1E";
const SYSTEM_SEPARATOR = "rgba(84, 84, 88, 0.65)";
const SYSTEM_GREEN = "#34C759";
const POINTER_WIDTH = 14;
const POINTER_HEIGHT = 8;
const LIST_MAX_WIDTH = 343;

export interface EnableKeyboardScreenProps {
  onBack: () => void;
  onSkip: () => void;
  onGoToSettings: () => void;
  testID?: string;
}

interface MockRowProps {
  label: string;
  showIcon?: boolean;
  testID?: string;
}

function MockRow({ label, showIcon, testID }: MockRowProps) {
  return (
    <View style={styles.row} testID={testID}>
      {showIcon ? <KeyboardTile width={36} height={36} /> : null}
      <Text
        variant="body1"
        weight="regular"
        color={AquaPrimitiveColors.white}
        style={styles.rowLabel}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Toggle value activeColor={SYSTEM_GREEN} />
      </View>
    </View>
  );
}

/**
 * Presentational only — opening Settings and navigation live at the route.
 * Full Access only exists on iOS; Android just needs the keyboard enabled.
 */
export const EnableKeyboardScreen = ({
  onBack,
  onSkip,
  onGoToSettings,
  testID,
}: EnableKeyboardScreenProps) => {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const landscape = frame.width > frame.height;
  const { loc } = useLocalization();
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;
  const isIos = Platform.OS === "ios";

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />
      <OnboardingHeader
        step={ENABLE_KEYBOARD_STEP}
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
          {loc.onboardingEnableKeyboardTitle}
        </Text>

        <View style={styles.illustration}>
          <View style={styles.tooltip}>
            <View style={styles.bubble}>
              <Icon
                name="info_circle"
                size={18}
                color={darkColors.textPrimary}
              />
              <Text
                variant="body2"
                weight="medium"
                color={darkColors.textPrimary}
                style={styles.bubbleText}
              >
                {loc.onboardingEnableKeyboardTooltip}
              </Text>
            </View>
            <Svg
              width={POINTER_WIDTH}
              height={POINTER_HEIGHT}
              viewBox={`0 0 ${POINTER_WIDTH} ${POINTER_HEIGHT}`}
            >
              <Path
                d={`M0 0 L${POINTER_WIDTH / 2} ${POINTER_HEIGHT} L${POINTER_WIDTH} 0 Z`}
                fill={AquaPrimitiveColors.glassSurfaceSecondaryDark}
              />
            </Svg>
          </View>

          <View style={styles.list} testID={childTestID("list")}>
            <MockRow
              label={loc.onboardingEnableKeyboardRowEchos}
              showIcon
              testID={childTestID("echos")}
            />
            {isIos && (
              <>
                <View style={styles.separator} />
                <MockRow
                  label={loc.onboardingEnableKeyboardRowFullAccess}
                  testID={childTestID("full-access")}
                />
              </>
            )}
          </View>
        </View>

        <View style={styles.cta}>
          <Button.primary
            testID={childTestID("go-to-settings")}
            text={loc.onboardingGoToSettings}
            onPress={onGoToSettings}
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
    alignItems: "stretch",
  },
  title: {
    flexShrink: 0,
  },
  illustration: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    overflow: "hidden",
  },
  tooltip: {
    alignItems: "center",
    maxWidth: 290,
  },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 300,
    backgroundColor: AquaPrimitiveColors.glassSurfaceSecondaryDark,
  },
  bubbleText: {
    flexShrink: 1,
  },
  list: {
    width: "100%",
    maxWidth: LIST_MAX_WIDTH,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: SYSTEM_GROUPED_BACKGROUND,
  },
  row: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowLabel: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md,
    backgroundColor: SYSTEM_SEPARATOR,
  },
  cta: {
    flexShrink: 0,
    alignSelf: "stretch",
  },
});
