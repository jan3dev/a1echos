import { LinearGradient } from "expo-linear-gradient";
import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import FolderAddBottom from "@/assets/images/folder_add_bottom.svg";
import FolderBottom from "@/assets/images/folder_bottom.svg";
import { useLocalization } from "@/hooks";
import type { FolderSummary } from "@/models";
import { AquaPrimitiveColors, useTheme } from "@/theme";
import { formatDate, iosPressed } from "@/utils";

import { Icon } from "../../../ui/icon/Icon";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { Text } from "../../../ui/text/Text";

// The back panel's gradient (#AE63FF→#0077FF over 126pt) sampled at the front
// panel's 16pt offset, standing in for the Figma backdrop blur over it.
const FRONT_GRADIENT = ["#9866FF", "#0077FF"] as const;
const GLOW_STOPS = [
  [0, 0.31],
  [0.38, 0.19],
  [0.57, 0.1],
  [0.75, 0.04],
  [1, 0],
] as const;

const PLUS_PATH =
  "M8 16C7.4 16 7 15.6 7 15V9H1C0.4 9 0 8.6 0 8C0 7.4 0.4 7 1 7H7V1C7 0.4 7.4 0 8 0C8.6 0 9 0.4 9 1V7H15C15.6 7 16 7.4 16 8C16 8.6 15.6 9 15 9H9V15C9 15.6 8.6 16 8 16Z";

export type { FolderSummary };

type FolderGroupItemProps =
  | {
      variant?: "default";
      folder: FolderSummary;
      onPress?: () => void;
      onMorePress?: () => void;
      /** Defined in pick mode: swaps the more button for a radio. */
      selected?: boolean;
    }
  | {
      variant: "addNew";
      onPress?: () => void;
    };

export const FolderGroupItem = (props: FolderGroupItemProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const isAddNew = props.variant === "addNew";
  const uid = useId().replace(/:/g, "");
  const glowId = `folderGlow-${uid}`;
  const clipId = `folderAddClip-${uid}`;
  const onMorePress = isAddNew ? undefined : props.onMorePress;
  const selected = isAddNew ? undefined : props.selected;

  return (
    <RipplePressable
      onPress={props.onPress}
      onLongPress={onMorePress}
      rippleColor={theme.colors.ripple}
      accessibilityRole={selected === undefined ? "button" : "radio"}
      accessibilityState={
        selected === undefined ? undefined : { checked: selected }
      }
      accessibilityLabel={
        isAddNew
          ? loc.homeNewFolder
          : [
              props.folder.name,
              formatDate(props.folder.createdAt),
              loc.sessionCount(props.folder.sessionCount),
            ].join(", ")
      }
      accessibilityActions={
        onMorePress ? [{ name: "more", label: loc.folderMoreOptions }] : []
      }
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "more") onMorePress?.();
      }}
      style={({ pressed }) => [
        styles.container,
        { opacity: iosPressed(pressed) },
      ]}
    >
      <View style={styles.folder}>
        {isAddNew ? (
          <>
            <View style={styles.bottom}>
              <FolderAddBottom
                width="100%"
                height="100%"
                preserveAspectRatio="none"
                color={theme.colors.surfacePrimary}
              />
            </View>
            <View style={styles.top}>
              {/* Figma's export bakes the dashes into a notched outline that
                  distorts when stretched; a 2pt stroke clipped to the shape
                  is its 1pt inside dashed border at any width. */}
              <Svg width="100%" height="100%">
                <Defs>
                  <ClipPath id={clipId}>
                    <Rect width="100%" height="100%" rx={16} />
                  </ClipPath>
                </Defs>
                <Rect
                  width="100%"
                  height="100%"
                  rx={16}
                  fill={theme.colors.surfaceBorderPrimary}
                  stroke={theme.colors.surfaceBorderSecondary}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  clipPath={`url(#${clipId})`}
                />
              </Svg>
              <Svg width={16} height={16} style={styles.plus}>
                <Path d={PLUS_PATH} fill={theme.colors.textPrimary} />
              </Svg>
            </View>
          </>
        ) : (
          <>
            <View style={styles.bottom}>
              <FolderBottom
                width="100%"
                height="100%"
                preserveAspectRatio="none"
              />
            </View>
            <View style={[styles.top, styles.glassTop]}>
              <LinearGradient
                colors={FRONT_GRADIENT}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.tint} pointerEvents="none" />
              {/* Gaussian-blurred r=32 disc (σ=37) from Figma; native SVG
                  ignores feGaussianBlur, so its falloff is a radial gradient. */}
              <Svg
                width={212}
                height={212}
                style={styles.glow}
                pointerEvents="none"
              >
                <Defs>
                  <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
                    {GLOW_STOPS.map(([offset, opacity]) => (
                      <Stop
                        key={offset}
                        offset={offset}
                        stopColor={AquaPrimitiveColors.white}
                        stopOpacity={opacity}
                      />
                    ))}
                  </RadialGradient>
                </Defs>
                <Circle cx={106} cy={106} r={106} fill={`url(#${glowId})`} />
              </Svg>
              {selected !== undefined ? (
                <View
                  style={[
                    styles.radio,
                    selected
                      ? { backgroundColor: theme.colors.accentBrand }
                      : styles.radioOff,
                  ]}
                >
                  {selected && <View style={styles.radioDot} />}
                </View>
              ) : (
                <RipplePressable
                  onPress={onMorePress}
                  hitSlop={10}
                  rippleColor={theme.colors.rippleOnPrimary}
                  borderless
                  accessibilityRole="button"
                  accessibilityLabel={loc.folderMoreOptions}
                >
                  <Icon
                    name="more"
                    size={18}
                    color={AquaPrimitiveColors.white}
                  />
                </RipplePressable>
              )}
              <Text
                variant="body2"
                weight="medium"
                height={16}
                align="center"
                color={AquaPrimitiveColors.white}
                style={styles.counter}
              >
                {loc.sessionCount(props.folder.sessionCount)}
              </Text>
            </View>
          </>
        )}
      </View>
      <View style={styles.text}>
        <Text variant="body1" weight="medium" align="center" numberOfLines={1}>
          {isAddNew ? loc.homeNewFolder : props.folder.name}
        </Text>
        {!isAddNew && (
          <Text
            variant="body2"
            weight="medium"
            height={16}
            align="center"
            color={theme.colors.textSecondary}
          >
            {formatDate(props.folder.createdAt)}
          </Text>
        )}
      </View>
    </RipplePressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 16,
  },
  folder: {
    width: "100%",
    height: 126,
  },
  bottom: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "0.8%",
    right: "0.85%",
  },
  top: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    bottom: 0,
  },
  plus: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    marginTop: -8,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AquaPrimitiveColors.glassSurfaceSecondaryDark,
  },
  glassTop: {
    borderRadius: 16,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 16,
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  glow: {
    position: "absolute",
    left: -74,
    top: -74,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOff: {
    backgroundColor: AquaPrimitiveColors.glassSurfaceSecondaryDark,
    borderWidth: 1,
    borderColor: AquaPrimitiveColors.glassSurfaceBorderDark,
  },
  radioDot: {
    width: 7.5,
    height: 7.5,
    borderRadius: 4,
    backgroundColor: AquaPrimitiveColors.white,
  },
  counter: {
    alignSelf: "stretch",
  },
  text: {
    width: "100%",
    height: 39,
    gap: 4,
  },
});
