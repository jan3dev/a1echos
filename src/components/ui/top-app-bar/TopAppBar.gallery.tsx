import { Icon, TopAppBar } from "@/components";
import { useTheme } from "@/theme";

import type { GalleryEntry } from "@/design-system/manifest";

export const Default = () => (
  <TopAppBar title="Page Title" showBackButton={true} />
);

export const WithoutBackButton = () => (
  <TopAppBar title="Home" showBackButton={false} />
);

const WithActionsContent = () => {
  const { theme } = useTheme();
  return (
    <TopAppBar
      title="Details"
      showBackButton={true}
      actions={[
        <Icon
          key="1"
          name="close"
          size={24}
          color={theme.colors.textPrimary}
        />,
        <Icon key="2" name="more" size={24} color={theme.colors.textPrimary} />,
      ]}
    />
  );
};

export const WithActions = () => <WithActionsContent />;

const WithCustomLeadingContent = () => {
  const { theme } = useTheme();
  return (
    <TopAppBar
      title="Custom Leading"
      showBackButton={false}
      leading={<Icon name="close" size={24} color={theme.colors.textPrimary} />}
    />
  );
};

export const WithCustomLeading = () => <WithCustomLeadingContent />;

export const Transparent = () => (
  <TopAppBar title="Transparent Bar" transparent={true} showBackButton={true} />
);

const LongTitleContent = () => {
  const { theme } = useTheme();
  return (
    <TopAppBar
      title="Very Long Page Title That Should Truncate Or Handle Gracefully"
      showBackButton={true}
      actions={[
        <Icon key="1" name="more" size={24} color={theme.colors.textPrimary} />,
      ]}
    />
  );
};

export const LongTitle = () => <LongTitleContent />;

const gallery: GalleryEntry = {
  slug: "top-app-bar",
  title: "Top App Bar",
  group: "UI",
  demos: [
    { name: "Default", render: Default },
    { name: "WithoutBackButton", render: WithoutBackButton },
    { name: "WithActions", render: WithActions },
    { name: "WithCustomLeading", render: WithCustomLeading },
    { name: "Transparent", render: Transparent },
    { name: "LongTitle", render: LongTitle },
  ],
};

export default gallery;
