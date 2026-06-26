import { useRouter } from "expo-router";
import { Fragment, ReactNode, RefObject } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppConstants, TestID } from "@/constants";
import { useTheme } from "@/theme";
import { iosPressed } from "@/utils";

import { AnimatedGlassSurface } from "../animated-glass-surface/AnimatedGlassSurface";
import { Icon } from "../icon/Icon";
import { RipplePressable } from "../ripple-pressable/RipplePressable";
import { Text } from "../text/Text";

export interface TopAppBarProps {
  title?: string;
  showBackButton?: boolean;
  leading?: ReactNode;
  onBackPressed?: () => void;
  onTitlePressed?: () => void;
  onTitleLongPressed?: () => void;
  titleWidget?: ReactNode;
  actions?: ReactNode[];
  transparent?: boolean;
  /**
   * Render the bar's own glass/blur background. Default true. Set false when a
   * screen supplies its own shared glass surface behind the bar.
   */
  showBackground?: boolean;
  /**
   * Android only: ref to the screen's `AppBarBlurTarget` wrapping the content
   * that should show through the blurred bar. expo-blur needs this explicit
   * target to blur underlying views; iOS blurs natively and ignores it.
   */
  blurTarget?: RefObject<View | null>;
  /**
   * When false (default) the bar is a solid `surfaceBackground` that blends into
   * the screen; when true its glass/blur background fades in. Drive from the
   * screen's scroll position so the blur shows only with content behind the bar.
   */
  scrolled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIDE_WIDTH = 64; // 2 × 24px icon + 16px gap

export const TopAppBar = ({
  title = "",
  showBackButton = true,
  leading,
  onBackPressed,
  onTitlePressed,
  onTitleLongPressed,
  titleWidget,
  actions = [],
  transparent = false,
  showBackground = true,
  blurTarget,
  scrolled = false,
  style,
}: TopAppBarProps) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const showSurface = !transparent && showBackground;

  const handleBack = () => {
    if (onBackPressed) {
      onBackPressed();
    } else {
      router.back();
    }
  };

  const topPadding = insets.top;
  const totalHeight = AppConstants.APP_BAR_HEIGHT + topPadding;

  return (
    <View
      testID={TestID.TopAppBar}
      style={[
        styles.container,
        {
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {showSurface && (
        <AnimatedGlassSurface scrolled={scrolled} blurTarget={blurTarget} />
      )}
      <View
        style={[
          styles.contentContainer,
          {
            paddingTop: topPadding + 16,
            height: totalHeight,
            backgroundColor: "transparent",
          },
        ]}
      >
        <View style={styles.row}>
          <View style={styles.leadingContainer}>
            {showBackButton ? (
              <RipplePressable
                testID={TestID.TopAppBarBack}
                onPress={handleBack}
                hitSlop={10}
                rippleColor={theme.colors.ripple}
                borderless
                style={({ pressed }) => ({ opacity: iosPressed(pressed) })}
              >
                <Icon
                  name="chevron_left"
                  size={24}
                  color={
                    transparent
                      ? theme.colors.textInverse
                      : theme.colors.textPrimary
                  }
                />
              </RipplePressable>
            ) : leading ? (
              leading
            ) : null}
          </View>

          <View style={styles.titleContainer}>
            <RipplePressable
              onPress={onTitlePressed}
              onLongPress={onTitleLongPressed}
              disabled={!onTitlePressed && !onTitleLongPressed}
              rippleColor={
                onTitlePressed || onTitleLongPressed
                  ? theme.colors.ripple
                  : undefined
              }
              borderless
              style={({ pressed }) => ({
                opacity: iosPressed(pressed),
              })}
            >
              {titleWidget ?? (
                <Text
                  variant="subtitle"
                  weight="semibold"
                  align="center"
                  numberOfLines={1}
                  color={
                    transparent
                      ? theme.colors.textInverse
                      : theme.colors.textPrimary
                  }
                >
                  {title}
                </Text>
              )}
            </RipplePressable>
          </View>

          <View style={styles.actionsContainer}>
            {actions.map((action, index) => (
              <Fragment key={index}>
                {action}
                {index < actions.length - 1 && <View style={{ width: 16 }} />}
              </Fragment>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  contentContainer: {
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leadingContainer: {
    width: SIDE_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "visible",
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  actionsContainer: {
    width: SIDE_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
