import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components";
import { AquaTypography, useTheme } from "@/theme";
import type { GalleryEntry } from "@/design-system/manifest";

import { CTAModule } from "./CTAModule";
import { FloatingCTAModule } from "./FloatingCTAModule";

const SectionLabel = ({ children }: { children: string }) => {
  const { theme } = useTheme();
  return (
    <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
      {children}
    </Text>
  );
};

const PrimaryOnlyContent = () => (
  <View style={styles.column}>
    <SectionLabel>Primary Only</SectionLabel>
    <CTAModule primary={{ text: "Save", onPress: () => console.log("save") }} />
  </View>
);

export const PrimaryOnly = () => <PrimaryOnlyContent />;

const PrimaryAndSecondaryContent = () => (
  <View style={styles.column}>
    <SectionLabel>Primary + Secondary</SectionLabel>
    <CTAModule
      primary={{ text: "Save", onPress: () => console.log("save") }}
      secondary={{ text: "Cancel", onPress: () => console.log("cancel") }}
    />
  </View>
);

export const PrimaryAndSecondary = () => <PrimaryAndSecondaryContent />;

const AllThreeContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <SectionLabel>Primary + Secondary + Tertiary</SectionLabel>
      <CTAModule
        primary={{
          text: "Save",
          icon: (
            <Icon name="check" size={20} color={theme.colors.textInverse} />
          ),
          onPress: () => console.log("save"),
        }}
        secondary={{ text: "Cancel", onPress: () => console.log("cancel") }}
        tertiary={{ text: "Discard", onPress: () => console.log("discard") }}
      />
    </View>
  );
};

export const AllThree = () => <AllThreeContent />;

const FloatingContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <SectionLabel>Floating Over Scroll Content</SectionLabel>
      <View style={styles.stage}>
        <ScrollView contentContainerStyle={styles.stageContent}>
          {Array.from({ length: 8 }, (_, i) => (
            <View
              key={i}
              style={[
                styles.stageRow,
                { backgroundColor: theme.colors.accentBrand },
              ]}
            />
          ))}
        </ScrollView>
        <FloatingCTAModule
          primary={{ text: "Save", onPress: () => console.log("save") }}
        />
      </View>
    </View>
  );
};

export const Floating = () => <FloatingContent />;

const styles = StyleSheet.create({
  stage: {
    height: 320,
    borderRadius: 16,
    overflow: "hidden",
  },
  stageContent: {
    gap: 16,
    padding: 16,
    paddingBottom: 120,
  },
  stageRow: {
    height: 48,
    borderRadius: 8,
  },
  column: {
    gap: 16,
  },
  label: {
    ...AquaTypography.h5SemiBold,
    marginTop: 8,
  },
});

const gallery: GalleryEntry = {
  slug: "cta-module",
  title: "CTA Module",
  group: "UI",
  demos: [
    { name: "PrimaryOnly", render: PrimaryOnly },
    { name: "PrimaryAndSecondary", render: PrimaryAndSecondary },
    { name: "AllThree", render: AllThree },
    { name: "Floating", render: Floating },
  ],
};

export default gallery;
