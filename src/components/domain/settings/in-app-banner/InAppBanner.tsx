import * as Linking from "expo-linking";
import {
  Image,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import AquaLogo from "@/assets/images/aqua-logo.svg";
import { Text } from "@/components/ui/text";
import { RipplePressable } from "@/components/ui/ripple-pressable/RipplePressable";
import { useLocalization } from "@/hooks";
import { FeatureFlag, iosPressed, logWarn } from "@/utils";

const AQUA_APP_URLS = {
  android:
    "https://play.google.com/store/apps/details?id=io.aquawallet.android",
  ios: "https://apps.apple.com/us/app/aqua-wallet/id6468594241",
};

// AQUA brand colors, not part of the Echos palette.
const AQUA_COLORS = {
  base: "#10BBEB",
  buttonBackground: "#022173",
  buttonText: "#00C7F9",
};

// Figma frame is 343×211; the phone mockup is placed in that coordinate space.
const DESIGN_WIDTH = 343;
const DESIGN_HEIGHT = 211;
const MAX_BANNER_WIDTH = 633;
const PHONE = { start: 202.07, top: 26.07, width: 115.87, height: 184.93 };

export const InAppBanner = () => {
  const { width: screenWidth } = useWindowDimensions();
  const { loc } = useLocalization();

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
      <RipplePressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.container,
          {
            width: bannerWidth,
            height: bannerHeight,
            opacity: iosPressed(pressed, 0.9),
          },
        ]}
        accessibilityLabel={loc.aquaBannerAccessibilityLabel}
        accessibilityRole="link"
      >
        <Image
          source={require("@/assets/images/aqua-banner-bg.png")}
          style={{
            position: "absolute",
            width: bannerWidth,
            height: bannerHeight,
          }}
          resizeMode="stretch"
        />
        <Image
          source={require("@/assets/images/aqua-banner-phone.png")}
          style={{
            position: "absolute",
            start: PHONE.start * scale,
            top: PHONE.top * scale,
            width: PHONE.width * scale,
            height: PHONE.height * scale,
          }}
          resizeMode="cover"
        />
        <View style={styles.content}>
          <AquaLogo width={96.55} height={18} />
          <Text variant="body1" weight="medium" size={18} color="#FFFFFF">
            {loc.aquaBannerTitle}
          </Text>
          <View style={styles.button}>
            <Text
              variant="body2"
              weight="semibold"
              color={AQUA_COLORS.buttonText}
            >
              {loc.aquaBannerButton}
            </Text>
          </View>
        </View>
      </RipplePressable>
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
