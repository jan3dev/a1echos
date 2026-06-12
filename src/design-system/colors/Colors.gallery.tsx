import { StyleSheet, View } from "react-native";

import { Text } from "@/components";
import { useTheme } from "@/theme";
import type { AquaColors } from "@/theme";
import type { GalleryEntry } from "@/design-system/manifest";

type ColorToken = keyof AquaColors;

interface ColorSection {
  title: string;
  tokens: ColorToken[];
}

const SECTIONS: ColorSection[] = [
  {
    title: "Text",
    tokens: ["textPrimary", "textSecondary", "textTertiary", "textInverse"],
  },
  {
    title: "Surface",
    tokens: [
      "surfacePrimary",
      "surfaceBorderPrimary",
      "surfaceSecondary",
      "surfaceBorderSecondary",
      "surfaceTertiary",
      "surfaceSelected",
      "surfaceBorderSelected",
      "surfaceBackground",
      "surfaceInverse",
    ],
  },
  {
    title: "Glass",
    tokens: [
      "glassSurface",
      "glassSurfaceBorder",
      "glassSurfaceSecondary",
      "glassInverse",
      "glassBackground",
    ],
  },
  {
    title: "Accent",
    tokens: [
      "accentBrand",
      "accentBrandTransparent",
      "accentSuccess",
      "accentSuccessTransparent",
      "accentWarning",
      "accentWarningTransparent",
      "accentDanger",
      "accentDangerTransparent",
    ],
  },
];

const Swatch = ({ token }: { token: ColorToken }) => {
  const { theme } = useTheme();
  const value = theme.colors[token];

  return (
    <View style={styles.swatchItem}>
      <View
        style={[
          styles.swatchChecker,
          { backgroundColor: theme.colors.surfaceSecondary },
        ]}
      >
        <View
          style={[
            styles.swatch,
            {
              backgroundColor: value,
              borderColor: theme.colors.surfaceBorderSecondary,
            },
          ]}
        />
      </View>
      <Text variant="caption2" style={styles.tokenName}>
        {token}
      </Text>
      <Text
        variant="caption2"
        style={[styles.tokenValue, { color: theme.colors.textTertiary }]}
      >
        {value}
      </Text>
    </View>
  );
};

const Palette = () => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text
            variant="subtitle"
            weight="semibold"
            style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}
          >
            {section.title}
          </Text>
          <View style={styles.grid}>
            {section.tokens.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  swatchItem: {
    width: 96,
    gap: 4,
  },
  swatchChecker: {
    borderRadius: 8,
    padding: 6,
  },
  swatch: {
    height: 56,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tokenName: {
    fontVariant: ["tabular-nums"],
  },
  tokenValue: {
    fontVariant: ["tabular-nums"],
  },
});

const gallery: GalleryEntry = {
  slug: "colors",
  title: "Colors",
  group: "UI",
  demos: [{ name: "Palette", render: Palette }],
};

export default gallery;
