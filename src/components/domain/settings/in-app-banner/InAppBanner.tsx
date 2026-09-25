import * as Linking from "expo-linking";
import { useEffect, useId } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import AquaLogo from "@/assets/images/aqua-logo.svg";
import { Text } from "@/components/ui/text";
import { FeatureFlag, logWarn } from "@/utils";

const AQUA_APP_URLS = {
  android:
    "https://play.google.com/store/apps/details?id=io.aquawallet.android",
  ios: "https://apps.apple.com/us/app/aqua-wallet/id6468594241",
};

// AQUA brand colors, not part of the Echos palette.
const AQUA_COLORS = {
  base: "#10BBEB",
  glowLight: "#3BCCF4",
  glowDark: "#06A7DB",
  buttonBackground: "#022173",
  buttonText: "#00C7F9",
};

// Figma frame is 343×211; the phone mockup is placed in that coordinate space.
const DESIGN_WIDTH = 343;
const DESIGN_HEIGHT = 211;
const MAX_BANNER_WIDTH = 633;
const PHONE = { left: 202, top: 26, width: 115.757, height: 243.823 };
const GLOW_SWEEP_MS = 3600;

const Glow = ({
  color,
  width,
  height,
  fromX,
  toX,
  progress,
}: {
  color: string;
  width: number;
  height: number;
  fromX: number;
  toX: number;
  progress: SharedValue<number>;
}) => {
  const gradientId = `aquaGlow-${useId().replace(/:/g, "")}`;
  const rx = width * 0.45;
  const ry = height * 0.8;

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: fromX + (toX - fromX) * progress.value - rx }],
  }));

  return (
    <Animated.View
      style={[
        styles.glow,
        { top: height * 0.45 - ry, width: rx * 2, height: ry * 2 },
        style,
      ]}
    >
      <Svg width={rx * 2} height={ry * 2}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.5" stopColor={color} stopOpacity={0.5} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={rx * 2} height={ry * 2} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
};

export const InAppBanner = () => {
  const { width: screenWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withRepeat(
      withTiming(1, {
        duration: GLOW_SWEEP_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [reducedMotion, progress]);

  const handlePress = async () => {
    try {
      const url =
        Platform.OS === "android" ? AQUA_APP_URLS.android : AQUA_APP_URLS.ios;

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback: try to open anyway
        await Linking.openURL(url);
      }
    } catch (error) {
      logWarn(`Error launching AQUA app URL: ${error}`, {
        flag: FeatureFlag.ui,
      });
    }
  };

  const bannerWidth = Math.min(screenWidth - 32, MAX_BANNER_WIDTH);
  const bannerHeight = bannerWidth * (DESIGN_HEIGHT / DESIGN_WIDTH);
  const scale = bannerWidth / DESIGN_WIDTH;

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.container,
          {
            width: bannerWidth,
            height: bannerHeight,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
        accessibilityLabel="Download AQUA Wallet"
        accessibilityRole="link"
      >
        <Glow
          color={AQUA_COLORS.glowLight}
          width={bannerWidth}
          height={bannerHeight}
          fromX={bannerWidth * 0.8}
          toX={bannerWidth * 0.2}
          progress={progress}
        />
        <Glow
          color={AQUA_COLORS.glowDark}
          width={bannerWidth}
          height={bannerHeight}
          fromX={bannerWidth * 0.15}
          toX={bannerWidth * 0.85}
          progress={progress}
        />
        <Image
          source={require("@/assets/images/aqua-banner-phone.png")}
          style={{
            position: "absolute",
            left: PHONE.left * scale,
            top: PHONE.top * scale,
            width: PHONE.width * scale,
            height: PHONE.height * scale,
          }}
          resizeMode="cover"
        />
        <View style={styles.content}>
          <AquaLogo width={96.55} height={18} />
          <Text variant="body1" weight="medium" size={18} color="#FFFFFF">
            Do you need a Bitcoin Wallet?
          </Text>
          <View style={styles.button}>
            <Text
              variant="body2"
              weight="semibold"
              color={AQUA_COLORS.buttonText}
            >
              Get AQUA
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    alignItems: "center",
  },
  container: {
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    padding: 24,
    backgroundColor: AQUA_COLORS.base,
  },
  glow: {
    position: "absolute",
    left: 0,
  },
  content: {
    width: 171,
    gap: 16,
    alignItems: "flex-start",
  },
  button: {
    height: 34,
    paddingHorizontal: 24,
    borderRadius: 8,
    justifyContent: "center",
    backgroundColor: AQUA_COLORS.buttonBackground,
  },
});
