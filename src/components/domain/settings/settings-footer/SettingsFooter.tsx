import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useLocalization } from "@/hooks";
import { useShowGlobalTooltip } from "@/stores";
import { useTheme } from "@/theme";
import { iosPressed } from "@/utils";

import { Divider } from "../../../ui/divider/Divider";
import { Icon } from "../../../ui/icon/Icon";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { Text } from "../../../ui/text/Text";

interface SocialTag {
  tag: string;
  handle: string;
}

const SOCIAL_TAGS: SocialTag[] = [
  { tag: "Echos", handle: "a1echos" },
  { tag: "A1 Lab", handle: "a1laboratory" },
  { tag: "JAN3", handle: "jan3com" },
];

export const SettingsFooter = () => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const showGlobalTooltip = useShowGlobalTooltip();
  const [version, setVersion] = useState("");

  useEffect(() => {
    const appVersion =
      Constants.nativeApplicationVersion ??
      Constants.expoConfig?.version ??
      "0.1.0";
    const buildNumber =
      Constants.nativeBuildVersion ??
      Constants.expoConfig?.ios?.buildNumber ??
      Constants.expoConfig?.android?.versionCode?.toString() ??
      "1";
    setVersion(`App Version ${appVersion} (${buildNumber})`);
  }, []);

  const handleLaunchX = async (handle: string) => {
    const sanitizedHandle = handle.replace(/^@/, "");
    const url = `https://x.com/${sanitizedHandle}`;

    try {
      await Linking.openURL(url);
    } catch {
      showGlobalTooltip(loc.couldNotOpenLink, "error");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <Icon
          name="footer_logo"
          size={108}
          style={{ width: 108, height: 24 }}
          color={theme.colors.textPrimary}
        />
      </View>

      <Divider color={theme.colors.surfaceBorderSecondary} />

      <View style={styles.followUs}>
        <Text variant="body2" weight="medium" color={theme.colors.textTertiary}>
          {loc.followUsOnX}
        </Text>
        <View style={styles.socialContainer}>
          {SOCIAL_TAGS.map((tagData) => (
            <RipplePressable
              key={tagData.handle}
              onPress={() => handleLaunchX(tagData.handle)}
              style={({ pressed }) => [
                styles.socialLink,
                { opacity: iosPressed(pressed) },
              ]}
              accessibilityLabel={`Open ${tagData.tag} on X`}
              accessibilityRole="link"
            >
              <Text
                variant="body2"
                weight="medium"
                color={theme.colors.textPrimary}
              >
                {tagData.tag}
              </Text>
            </RipplePressable>
          ))}
        </View>
      </View>

      <Divider color={theme.colors.surfaceBorderSecondary} />

      <Text
        variant="caption1"
        weight="regular"
        color={theme.colors.textTertiary}
        align="center"
      >
        {version}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    gap: 8,
    alignItems: "center",
  },
  logoRow: {
    paddingBottom: 8,
  },
  followUs: {
    paddingVertical: 8,
    gap: 16,
    alignItems: "center",
  },
  socialContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  socialLink: {
    paddingHorizontal: 12,
  },
});
