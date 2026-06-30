import { Chip, FlagIcon, Icon } from "@/components";
import { useTheme } from "@/theme";
import type { GalleryEntry } from "@/design-system/manifest";

const LargeDefault = () => <Chip size="large" label="Label" />;

const LargeWithFlagIcon = () => (
  <Chip
    size="large"
    label="English"
    iconLeading={<FlagIcon name="united_states" size={16} />}
  />
);

const LargeWithIcon = () => {
  const { theme } = useTheme();
  return (
    <Chip
      size="large"
      label="Label"
      iconLeading={
        <Icon name="globe" size={16} color={theme.colors.textSecondary} />
      }
    />
  );
};

const SmallDefault = () => <Chip size="small" label="Included" />;

const SmallWithIcon = () => {
  const { theme } = useTheme();
  return (
    <Chip
      size="small"
      label="Included"
      iconLeading={
        <Icon name="check" size={12} color={theme.colors.accentBrand} />
      }
    />
  );
};

const SmallSuccess = () => {
  const { theme } = useTheme();
  return (
    <Chip
      size="small"
      label="Active"
      backgroundColor={theme.colors.chipSuccessBackgroundColor}
      textColor={theme.colors.chipSuccessForegroundColor}
    />
  );
};

const SmallError = () => {
  const { theme } = useTheme();
  return (
    <Chip
      size="small"
      label="High Risk"
      backgroundColor={theme.colors.chipErrorBackgroundColor}
      textColor={theme.colors.chipErrorForegroundColor}
    />
  );
};

const gallery: GalleryEntry = {
  slug: "chip",
  title: "Chip",
  group: "UI",
  demos: [
    { name: "LargeDefault", render: LargeDefault },
    { name: "LargeWithFlagIcon", render: LargeWithFlagIcon },
    { name: "LargeWithIcon", render: LargeWithIcon },
    { name: "SmallDefault", render: SmallDefault },
    { name: "SmallWithIcon", render: SmallWithIcon },
    { name: "SmallSuccess", render: SmallSuccess },
    { name: "SmallError", render: SmallError },
  ],
};

export default gallery;
