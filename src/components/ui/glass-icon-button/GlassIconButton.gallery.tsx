import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { GalleryEntry } from "@/app/(dev)/design-system/manifest";
import { Icon } from "@/components";
import { AquaTypography, useTheme } from "@/theme";

import { GlassIconButton } from "./GlassIconButton";

const StateLabel = ({ children }: { children: string }) => {
  const { theme } = useTheme();
  return (
    <Text style={[styles.stateLabel, { color: theme.colors.textSecondary }]}>
      {children}
    </Text>
  );
};

const ColorfulBackdrop = ({
  children,
  dark,
}: {
  children: ReactNode;
  dark?: boolean;
}) => (
  <View style={[styles.backdrop, dark && styles.backdropDark]}>
    <View style={[styles.stripe, { backgroundColor: "#E53935" }]} />
    <View style={[styles.stripe, { backgroundColor: "#43A047" }]} />
    <View style={[styles.stripe, { backgroundColor: "#1E88E5" }]} />
    <View style={styles.backdropContent}>{children}</View>
  </View>
);

const OnColorfulBackdropContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <StateLabel>
        Over a colorful backdrop so the blur is visible. iOS press fades to 0.6
        opacity; Android shows a circular borderless ripple.
      </StateLabel>
      <ColorfulBackdrop>
        <View style={styles.row}>
          <GlassIconButton
            onPress={() => console.log("Pressed menu")}
            accessibilityLabel="Settings"
          >
            <Icon name="menu" size={24} color={theme.colors.textPrimary} />
          </GlassIconButton>
          <GlassIconButton
            onPress={() => console.log("Pressed ghost")}
            accessibilityLabel="Toggle incognito"
          >
            <Icon name="ghost" size={24} color={theme.colors.textPrimary} />
          </GlassIconButton>
          <GlassIconButton
            onPress={() => console.log("Pressed trash")}
            accessibilityLabel="Delete"
          >
            <Icon name="trash" size={24} color={theme.colors.textPrimary} />
          </GlassIconButton>
        </View>
      </ColorfulBackdrop>
    </View>
  );
};

export const OnColorfulBackdrop = () => <OnColorfulBackdropContent />;

const OnDarkBackdropContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <StateLabel>
        Same buttons over a dark surface — confirms tint and `blurType` flip
        correctly for dark contexts.
      </StateLabel>
      <ColorfulBackdrop dark>
        <View style={styles.row}>
          <GlassIconButton
            onPress={() => console.log("Pressed menu")}
            accessibilityLabel="Settings"
          >
            <Icon name="menu" size={24} color={theme.colors.textInverse} />
          </GlassIconButton>
          <GlassIconButton
            onPress={() => console.log("Pressed ghost")}
            accessibilityLabel="Toggle incognito"
          >
            <Icon name="ghost" size={24} color={theme.colors.textInverse} />
          </GlassIconButton>
          <GlassIconButton
            onPress={() => console.log("Pressed trash")}
            accessibilityLabel="Delete"
          >
            <Icon name="trash" size={24} color={theme.colors.textInverse} />
          </GlassIconButton>
        </View>
      </ColorfulBackdrop>
    </View>
  );
};

export const OnDarkBackdrop = () => <OnDarkBackdropContent />;

const styles = StyleSheet.create({
  column: {
    gap: 16,
  },
  row: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  stateLabel: {
    ...AquaTypography.body2,
    marginTop: 4,
  },
  backdrop: {
    height: 120,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
  },
  backdropDark: {
    backgroundColor: "#111111",
  },
  stripe: {
    flex: 1,
  },
  backdropContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});

const gallery: GalleryEntry = {
  slug: "glass-icon-button",
  title: "Glass Icon Button",
  group: "UI",
  demos: [
    { name: "OnColorfulBackdrop", render: OnColorfulBackdrop },
    { name: "OnDarkBackdrop", render: OnDarkBackdrop },
  ],
};

export default gallery;
