import { StyleSheet, Text, View } from "react-native";

import type { GalleryEntry } from "@/app/(dev)/design-system/manifest";
import { Icon } from "@/components";
import { AquaTypography, useTheme } from "@/theme";

import { CTAModule } from "./CTAModule";

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
    <SectionLabel>Primary only</SectionLabel>
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

const styles = StyleSheet.create({
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
  ],
};

export default gallery;
