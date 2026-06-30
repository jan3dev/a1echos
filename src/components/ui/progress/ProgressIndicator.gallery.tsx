import { View } from "react-native";

import { ProgressIndicator } from "@/components";
import { lightColors, useTheme } from "@/theme";
import type { GalleryEntry } from "@/design-system/manifest";

const DefaultStory = () => {
  const { theme } = useTheme();
  return <ProgressIndicator color={theme.colors.accentBrand} />;
};

export const Default = () => <DefaultStory />;

const CustomColorStory = () => {
  const { theme } = useTheme();
  return <ProgressIndicator color={theme.colors.accentDanger} />;
};

export const CustomColor = () => <CustomColorStory />;

const CustomSizeStory = () => {
  const { theme } = useTheme();
  return <ProgressIndicator color={theme.colors.accentBrand} size={48} />;
};

export const CustomSize = () => <CustomSizeStory />;

const InverseColorStory = () => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.accentBrand,
        padding: 20,
        borderRadius: 8,
      }}
    >
      <ProgressIndicator color={lightColors.textInverse} />
    </View>
  );
};

export const InverseColor = () => <InverseColorStory />;

const AllVariantsStory = () => {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 20 }}>
      <View style={{ alignItems: "center" }}>
        <ProgressIndicator color={theme.colors.accentBrand} size={24} />
      </View>
      <View style={{ alignItems: "center" }}>
        <ProgressIndicator color={theme.colors.accentDanger} size={24} />
      </View>
      <View style={{ alignItems: "center" }}>
        <ProgressIndicator color={theme.colors.accentSuccess} size={24} />
      </View>
      <View style={{ alignItems: "center" }}>
        <ProgressIndicator color={theme.colors.accentWarning} size={24} />
      </View>
    </View>
  );
};

export const AllVariants = () => <AllVariantsStory />;

const gallery: GalleryEntry = {
  slug: "progress",
  title: "Progress Indicator",
  group: "UI",
  demos: [
    { name: "Default", render: Default },
    { name: "CustomColor", render: CustomColor },
    { name: "CustomSize", render: CustomSize },
    { name: "InverseColor", render: InverseColor },
    { name: "AllVariants", render: AllVariants },
  ],
};

export default gallery;
