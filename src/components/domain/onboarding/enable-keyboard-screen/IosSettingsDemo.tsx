import { type FC, type ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import type { SvgProps } from "react-native-svg";

import AppleIntelligenceSiriIcon from "@/assets/images/ios-settings/apple_intelligence_siri.svg";
import CellularDataIcon from "@/assets/images/ios-settings/cellular_data.svg";
import KeyboardsIcon from "@/assets/images/ios-settings/keyboards.svg";
import LiveActivitiesIcon from "@/assets/images/ios-settings/live_activities.svg";
import MicrophoneIcon from "@/assets/images/ios-settings/microphone.svg";
import SearchIcon from "@/assets/images/ios-settings/search.svg";
import { useLocalization } from "@/hooks";
import { AquaPrimitiveColors, spacing } from "@/theme";

import { Icon } from "../../../ui/icon/Icon";
import { Text } from "../../../ui/text/Text";

import { TouchIndicator } from "./TouchIndicator";
import {
  type DemoProps,
  easeInOutCubic,
  easeOutBack,
  LIST_MAX_WIDTH,
  mix,
  pressAmount,
  segment,
} from "./walkthrough";

// Mimics the system Settings app, so these are iOS system colors, not theme tokens.
const GROUPED_BACKGROUND = "#1C1C1E";
const SEPARATOR = "rgba(84, 84, 88, 0.65)";
const ROW_PRESSED = "rgba(118, 118, 128, 0.24)";
const CHEVRON = "rgba(235, 235, 245, 0.3)";
const SWITCH_OFF = "rgba(120, 120, 128, 0.36)";
const SWITCH_ON = "#30D158";

const ROW_HEIGHT = 52;
const ICON_SIZE = 36;
const SEPARATOR_INSET = spacing.md * 2 + ICON_SIZE;
const LIST_GAP = spacing.sm;
const SETTINGS_HEIGHT = ROW_HEIGHT * 6;
const KEYBOARDS_HEIGHT = ROW_HEIGHT * 2;
// Until the tooltip reports its real (localized) height.
const TOOLTIP_HEIGHT_ESTIMATE = 68;
const SWITCH_TRAVEL = 22;

// Timeline (ms). Each TAP_* is the moment the finger presses down.
const TAP_KEYBOARDS = 1150;
const PUSH_AT = TAP_KEYBOARDS + 260;
const PUSH_MS = 560;
const TOOLTIP_AT = PUSH_AT + 260;
const TAP_ECHOS = PUSH_AT + PUSH_MS + 800;
const REVEAL_AT = TAP_ECHOS + 560;
const REVEAL_MS = 460;
const TAP_FULL_ACCESS = REVEAL_AT + REVEAL_MS + 700;
export const IOS_DEMO_DONE = TAP_FULL_ACCESS + 600;

const pushProgress = (t: number) => {
  "worklet";
  return segment(t, PUSH_AT, PUSH_MS, easeInOutCubic);
};

/** Settings → Keyboards → Echos on, Allow Full Access on. */
export function IosSettingsDemo({ t, tooltip, testID }: DemoProps) {
  const { loc } = useLocalization();
  const [tooltipHeight, setTooltipHeight] = useState(TOOLTIP_HEIGHT_ESTIMATE);
  const cardWidth = useSharedValue(LIST_MAX_WIDTH);
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;

  const groupHeight = tooltipHeight + LIST_GAP + KEYBOARDS_HEIGHT;
  const stageHeight = Math.max(SETTINGS_HEIGHT, groupHeight);
  const settingsTop = (stageHeight - SETTINGS_HEIGHT) / 2;
  const tooltipTop = (stageHeight - groupHeight) / 2;
  const keyboardsTop = tooltipTop + tooltipHeight + LIST_GAP;

  const cardStyle = useAnimatedStyle(() => {
    const push = pushProgress(t.value);
    const reveal = segment(t.value, REVEAL_AT, REVEAL_MS, easeInOutCubic);
    return {
      top: mix(push, settingsTop, keyboardsTop),
      height:
        t.value < REVEAL_AT
          ? mix(push, SETTINGS_HEIGHT, ROW_HEIGHT)
          : mix(reveal, ROW_HEIGHT, KEYBOARDS_HEIGHT),
      borderRadius: mix(push, 24, 26),
    };
  });
  // iOS push: the outgoing page drifts a third of the way and dims.
  const settingsPageStyle = useAnimatedStyle(() => {
    const push = pushProgress(t.value);
    return {
      opacity: 1 - push,
      transform: [{ translateX: -0.3 * cardWidth.value * push }],
    };
  });
  const keyboardsPageStyle = useAnimatedStyle(() => {
    const push = pushProgress(t.value);
    return { transform: [{ translateX: (1 - push) * cardWidth.value }] };
  });
  const tooltipStyle = useAnimatedStyle(() => {
    const p = segment(t.value, TOOLTIP_AT, 420);
    return {
      opacity: p,
      transform: [
        { translateY: mix(p, 10, 0) },
        { scale: mix(segment(t.value, TOOLTIP_AT, 520, easeOutBack), 0.94, 1) },
      ],
    };
  });
  const fullAccessStyle = useAnimatedStyle(() => {
    const p = segment(t.value, REVEAL_AT + 120, 360);
    return { opacity: p, transform: [{ translateY: mix(p, -8, 0) }] };
  });
  const keyboardsRowPressed = useAnimatedStyle(() => ({
    opacity: segment(t.value, TAP_KEYBOARDS, 90),
  }));

  const settingsRows: {
    icon: FC<SvgProps>;
    label: string;
    toggle?: boolean;
  }[] = [
    {
      icon: MicrophoneIcon,
      label: loc.onboardingEnableKeyboardRowMicrophone,
      toggle: true,
    },
    {
      icon: AppleIntelligenceSiriIcon,
      label: loc.onboardingEnableKeyboardRowSiri,
    },
    { icon: SearchIcon, label: loc.onboardingEnableKeyboardRowSearch },
    {
      icon: LiveActivitiesIcon,
      label: loc.onboardingEnableKeyboardRowLiveActivities,
      toggle: true,
    },
    {
      icon: CellularDataIcon,
      label: loc.onboardingEnableKeyboardRowCellularData,
      toggle: true,
    },
  ];

  return (
    <View style={[styles.stage, { height: stageHeight }]}>
      <Animated.View
        style={[styles.tooltip, { top: tooltipTop }, tooltipStyle]}
        onLayout={(e) => setTooltipHeight(e.nativeEvent.layout.height)}
        testID={childTestID("tooltip")}
      >
        {tooltip}
      </Animated.View>

      <Animated.View
        style={[styles.card, cardStyle]}
        onLayout={(e) => {
          cardWidth.value = e.nativeEvent.layout.width;
        }}
        testID={childTestID("list")}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View style={[styles.page, settingsPageStyle]}>
          {settingsRows.map(({ icon, label, toggle }, index) => (
            <Row key={label} icon={icon} label={label} separator={index > 0}>
              {toggle ? <OnSwitch /> : <Chevron />}
            </Row>
          ))}
          <Row
            icon={KeyboardsIcon}
            label={loc.onboardingEnableKeyboardRowKeyboards}
            separator
            highlight={
              <Animated.View style={[styles.rowPressed, keyboardsRowPressed]} />
            }
          >
            <Chevron />
            <TouchIndicator
              t={t}
              at={TAP_KEYBOARDS}
              style={styles.keyboardsTouch}
            />
          </Row>
        </Animated.View>

        <Animated.View
          style={[styles.page, styles.incomingPage, keyboardsPageStyle]}
        >
          <Row
            label={loc.onboardingEnableKeyboardRowEchos}
            testID={childTestID("echos")}
          >
            <GlassSwitch t={t} at={TAP_ECHOS} />
          </Row>
          <Animated.View style={fullAccessStyle}>
            <Row
              icon={KeyboardsIcon}
              label={loc.onboardingEnableKeyboardRowFullAccess}
              separator
              testID={childTestID("full-access")}
            >
              <GlassSwitch
                t={t}
                at={TAP_FULL_ACCESS}
                testID={childTestID("full-access-toggle")}
              />
            </Row>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

interface RowProps {
  icon?: FC<SvgProps>;
  label: string;
  separator?: boolean;
  highlight?: ReactNode;
  testID?: string;
  children: ReactNode;
}

function Row({
  icon: Glyph,
  label,
  separator,
  highlight,
  testID,
  children,
}: RowProps) {
  return (
    <View style={styles.row} testID={testID}>
      {highlight}
      {separator && <View style={styles.separator} />}
      {Glyph && <Glyph width={ICON_SIZE} height={ICON_SIZE} />}
      <Text
        variant="body1"
        weight="regular"
        color={AquaPrimitiveColors.white}
        style={styles.rowLabel}
        numberOfLines={1}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function Chevron() {
  return <Icon name="chevron_right" color={CHEVRON} style={styles.chevron} />;
}

function OnSwitch() {
  return (
    <View style={[styles.track, styles.trackOn]}>
      <View style={[styles.knob, styles.knobOn]} />
    </View>
  );
}

interface GlassSwitchProps {
  t: SharedValue<number>;
  /** Tap time on the timeline. */
  at: number;
  testID?: string;
}

// iOS 27 Liquid Glass switch (Figma "Toggle - Switch"). On touch the knob
// swells into a translucent lens, then slides across with a little overshoot.
function GlassSwitch({ t, at, testID }: GlassSwitchProps) {
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      segment(t.value, at + 140, 260),
      [0, 1],
      [SWITCH_OFF, SWITCH_ON],
    ),
  }));
  const knobStyle = useAnimatedStyle(() => {
    const press = pressAmount(t.value, at);
    return {
      backgroundColor: `rgba(255, 255, 255, ${1 - 0.3 * press})`,
      transform: [
        {
          translateX:
            SWITCH_TRAVEL * segment(t.value, at + 140, 380, easeOutBack),
        },
        { scaleX: 1 + 0.18 * press },
        { scaleY: 1 + 0.3 * press },
      ],
    };
  });

  return (
    <View>
      <Animated.View style={[styles.track, trackStyle]} testID={testID}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
      <TouchIndicator t={t} at={at} style={styles.switchTouch} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: "100%",
    maxWidth: LIST_MAX_WIDTH,
  },
  tooltip: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
    backgroundColor: GROUPED_BACKGROUND,
  },
  page: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GROUPED_BACKGROUND,
  },
  // The incoming page casts a soft shadow over the one it covers, as in UIKit.
  incomingPage: {
    boxShadow: "-8px 0px 24px rgba(0, 0, 0, 0.45)",
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowPressed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ROW_PRESSED,
  },
  rowLabel: {
    flex: 1,
  },
  separator: {
    position: "absolute",
    top: 0,
    left: SEPARATOR_INSET,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: SEPARATOR,
  },
  // The 24pt glyph box has 8pt of air on the right; Figma's chevron sits flush.
  chevron: {
    marginRight: -spacing.sm,
  },
  keyboardsTouch: {
    right: 63,
    top: 4,
  },
  track: {
    width: 64,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  trackOn: {
    backgroundColor: SWITCH_ON,
  },
  knob: {
    width: 38,
    height: 24,
    borderRadius: 12,
    backgroundColor: AquaPrimitiveColors.white,
    boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.18)",
  },
  knobOn: {
    transform: [{ translateX: SWITCH_TRAVEL }],
  },
  switchTouch: {
    left: 15,
    top: -8.5,
  },
});
