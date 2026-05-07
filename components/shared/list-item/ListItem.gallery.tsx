import { View } from "react-native";

import { Icon, ListItem, Text } from "@/components";
import { useTheme } from "@/theme";
import type { GalleryEntry } from "@/app/(design-system)/manifest";

export const Default = () => (
  <ListItem title="List Item Title" onPress={() => console.log("Pressed")} />
);

export const WithSubtitle = () => (
  <ListItem
    title="Transaction Sent"
    subtitle="Yesterday, 10:30 AM"
    onPress={() => console.log("Pressed")}
  />
);

const WithLeadingIconContent = () => {
  const { theme } = useTheme();
  return (
    <ListItem
      title="Security"
      subtitle="Manage your security settings"
      iconLeading={
        <Icon name="shield" size={24} color={theme.colors.accentBrand} />
      }
      onPress={() => console.log("Pressed")}
    />
  );
};

export const WithLeadingIcon = () => <WithLeadingIconContent />;

const WithTrailingIconContent = () => {
  const { theme } = useTheme();
  return (
    <ListItem
      title="Language"
      subtitle="English"
      iconLeading={
        <Icon name="language" size={24} color={theme.colors.textPrimary} />
      }
      iconTrailing={
        <Icon
          name="chevron_right"
          size={20}
          color={theme.colors.textSecondary}
        />
      }
      onPress={() => console.log("Pressed")}
    />
  );
};

export const WithTrailingIcon = () => <WithTrailingIconContent />;

const WithTrailingTextContent = () => {
  const { theme } = useTheme();
  return (
    <ListItem
      title="Bitcoin"
      subtitle="BTC"
      titleTrailing="$45,230.50"
      subtitleTrailing="+2.5%"
      subtitleTrailingColor={theme.colors.accentSuccess}
      iconLeading={<Icon name="bitcoin_generic" size={32} color="#F7931A" />}
      onPress={() => console.log("Pressed")}
    />
  );
};

export const WithTrailingText = () => <WithTrailingTextContent />;

const SelectedContent = () => {
  const { theme } = useTheme();
  return (
    <ListItem
      title="Selected Item"
      subtitle="This item is currently selected"
      selected={true}
      iconLeading={
        <Icon name="check_circle" size={24} color={theme.colors.accentBrand} />
      }
      onPress={() => console.log("Pressed")}
    />
  );
};

export const Selected = () => <SelectedContent />;

const WithCustomContentContent = () => {
  const { theme } = useTheme();
  return (
    <ListItem
      title="Custom Content"
      iconLeading={
        <Icon name="warning" size={24} color={theme.colors.accentDanger} />
      }
      onPress={() => console.log("Pressed")}
      contentWidget={
        <View style={{ flexDirection: "row", marginTop: 4 }}>
          <View
            style={{
              backgroundColor: theme.colors.chipErrorBackgroundColor,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 4,
              marginRight: 8,
            }}
          >
            <Text
              variant="caption1"
              style={{ color: theme.colors.chipErrorForegroundColor }}
            >
              High Risk
            </Text>
          </View>
          <Text
            variant="caption1"
            style={{ color: theme.colors.textSecondary }}
          >
            Manual review required
          </Text>
        </View>
      }
    />
  );
};

export const WithCustomContent = () => <WithCustomContentContent />;

const gallery: GalleryEntry = {
  slug: "list-item",
  title: "List Item",
  group: "Shared",
  demos: [
    { name: "Default", render: Default },
    { name: "WithSubtitle", render: WithSubtitle },
    { name: "WithLeadingIcon", render: WithLeadingIcon },
    { name: "WithTrailingIcon", render: WithTrailingIcon },
    { name: "WithTrailingText", render: WithTrailingText },
    { name: "Selected", render: Selected },
    { name: "WithCustomContent", render: WithCustomContent },
  ],
};

export default gallery;
