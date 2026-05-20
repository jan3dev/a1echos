import { View } from "react-native";

import type { GalleryEntry } from "@/app/(dev)/design-system/manifest";
import { Icon, ListItem, Text } from "@/components";
import { useTheme } from "@/theme";

const PRIMARY_LEFT = "Primary Left";
const PRIMARY_RIGHT = "Primary Right";
const SECONDARY_LEFT = "Secondary Left";
const SECONDARY_RIGHT = "Secondary Right";
const FIRST_RIGHT = "1st Right";
const SECOND_RIGHT = "2nd Right";

const Chevron = () => {
  const { theme } = useTheme();
  return (
    <Icon name="chevron_right" size={20} color={theme.colors.textSecondary} />
  );
};

const LeadingIcon = () => {
  const { theme } = useTheme();
  return <Icon name="settings" size={24} color={theme.colors.textPrimary} />;
};

export const PrimaryOnly = () => (
  <ListItem title={PRIMARY_LEFT} onPress={() => {}} />
);

export const PrimaryWithChevron = () => (
  <ListItem
    title={PRIMARY_LEFT}
    iconTrailing={<Chevron />}
    onPress={() => {}}
  />
);

export const PrimaryWithRightText = () => (
  <ListItem
    title={PRIMARY_LEFT}
    titleTrailing={PRIMARY_RIGHT}
    onPress={() => {}}
  />
);

export const PrimaryWithRightTextAndChevron = () => (
  <ListItem
    title={PRIMARY_LEFT}
    titleTrailing={PRIMARY_RIGHT}
    iconTrailing={<Chevron />}
    onPress={() => {}}
  />
);

export const PrimaryWithStackedRightText = () => (
  <ListItem
    title={PRIMARY_LEFT}
    titleTrailing={FIRST_RIGHT}
    subtitleTrailing={SECOND_RIGHT}
    onPress={() => {}}
  />
);

export const PrimaryWithStackedRightTextAndChevron = () => (
  <ListItem
    title={PRIMARY_LEFT}
    titleTrailing={FIRST_RIGHT}
    subtitleTrailing={SECOND_RIGHT}
    iconTrailing={<Chevron />}
    onPress={() => {}}
  />
);

export const StackedLeft = () => (
  <ListItem title={PRIMARY_LEFT} subtitle={SECONDARY_LEFT} onPress={() => {}} />
);

export const StackedLeftWithChevron = () => (
  <ListItem
    title={PRIMARY_LEFT}
    subtitle={SECONDARY_LEFT}
    iconTrailing={<Chevron />}
    onPress={() => {}}
  />
);

export const StackedBothSides = () => (
  <ListItem
    title={PRIMARY_LEFT}
    subtitle={SECONDARY_LEFT}
    titleTrailing={PRIMARY_RIGHT}
    subtitleTrailing={SECONDARY_RIGHT}
    onPress={() => {}}
  />
);

export const StackedBothSidesWithChevron = () => (
  <ListItem
    title={PRIMARY_LEFT}
    subtitle={SECONDARY_LEFT}
    titleTrailing={PRIMARY_RIGHT}
    subtitleTrailing={SECONDARY_RIGHT}
    iconTrailing={<Chevron />}
    onPress={() => {}}
  />
);

export const IconPrimaryOnly = () => (
  <ListItem
    title={PRIMARY_LEFT}
    iconLeading={<LeadingIcon />}
    onPress={() => {}}
  />
);

export const IconPrimaryWithChevron = () => (
  <ListItem
    title={PRIMARY_LEFT}
    iconLeading={<LeadingIcon />}
    iconTrailing={<Chevron />}
    onPress={() => {}}
  />
);

export const IconPrimaryWithRightText = () => (
  <ListItem
    title={PRIMARY_LEFT}
    titleTrailing={PRIMARY_RIGHT}
    iconLeading={<LeadingIcon />}
    onPress={() => {}}
  />
);

export const IconPrimaryWithRightTextAndChevron = () => (
  <ListItem
    title={PRIMARY_LEFT}
    titleTrailing={PRIMARY_RIGHT}
    iconLeading={<LeadingIcon />}
    iconTrailing={<Chevron />}
    onPress={() => {}}
  />
);

export const IconStackedLeft = () => (
  <ListItem
    title={PRIMARY_LEFT}
    subtitle={SECONDARY_LEFT}
    iconLeading={<LeadingIcon />}
    onPress={() => {}}
  />
);

export const IconStackedLeftWithChevron = () => (
  <ListItem
    title={PRIMARY_LEFT}
    subtitle={SECONDARY_LEFT}
    iconLeading={<LeadingIcon />}
    iconTrailing={<Chevron />}
    onPress={() => {}}
  />
);

export const IconStackedBothSides = () => (
  <ListItem
    title={PRIMARY_LEFT}
    subtitle={SECONDARY_LEFT}
    titleTrailing={PRIMARY_RIGHT}
    subtitleTrailing={SECONDARY_RIGHT}
    iconLeading={<LeadingIcon />}
    onPress={() => {}}
  />
);

export const IconStackedBothSidesWithChevron = () => (
  <ListItem
    title={PRIMARY_LEFT}
    subtitle={SECONDARY_LEFT}
    titleTrailing={PRIMARY_RIGHT}
    subtitleTrailing={SECONDARY_RIGHT}
    iconLeading={<LeadingIcon />}
    iconTrailing={<Chevron />}
    onPress={() => {}}
  />
);

export const Selected = () => (
  <ListItem
    title={PRIMARY_LEFT}
    subtitle={SECONDARY_LEFT}
    iconLeading={<LeadingIcon />}
    iconTrailing={<Chevron />}
    selected
    onPress={() => {}}
  />
);

export const WithCustomContent = () => {
  const { theme } = useTheme();
  return (
    <ListItem
      title="Custom Content"
      iconLeading={
        <Icon name="warning" size={24} color={theme.colors.accentDanger} />
      }
      onPress={() => {}}
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

const gallery: GalleryEntry = {
  slug: "list-item",
  title: "List Item",
  group: "Shared",
  demos: [
    { name: "PrimaryOnly", render: PrimaryOnly },
    { name: "PrimaryWithChevron", render: PrimaryWithChevron },
    { name: "PrimaryWithRightText", render: PrimaryWithRightText },
    {
      name: "PrimaryWithRightTextAndChevron",
      render: PrimaryWithRightTextAndChevron,
    },
    {
      name: "PrimaryWithStackedRightText",
      render: PrimaryWithStackedRightText,
    },
    {
      name: "PrimaryWithStackedRightTextAndChevron",
      render: PrimaryWithStackedRightTextAndChevron,
    },
    { name: "StackedLeft", render: StackedLeft },
    { name: "StackedLeftWithChevron", render: StackedLeftWithChevron },
    { name: "StackedBothSides", render: StackedBothSides },
    {
      name: "StackedBothSidesWithChevron",
      render: StackedBothSidesWithChevron,
    },
    { name: "IconPrimaryOnly", render: IconPrimaryOnly },
    { name: "IconPrimaryWithChevron", render: IconPrimaryWithChevron },
    { name: "IconPrimaryWithRightText", render: IconPrimaryWithRightText },
    {
      name: "IconPrimaryWithRightTextAndChevron",
      render: IconPrimaryWithRightTextAndChevron,
    },
    { name: "IconStackedLeft", render: IconStackedLeft },
    { name: "IconStackedLeftWithChevron", render: IconStackedLeftWithChevron },
    { name: "IconStackedBothSides", render: IconStackedBothSides },
    {
      name: "IconStackedBothSidesWithChevron",
      render: IconStackedBothSidesWithChevron,
    },
    { name: "Selected", render: Selected },
    { name: "WithCustomContent", render: WithCustomContent },
  ],
};

export default gallery;
