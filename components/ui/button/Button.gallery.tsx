import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Icon } from "@/components";
import { AquaTypography, useTheme } from "@/theme";
import type { GalleryEntry } from "@/app/(design-system)/manifest";

const StorySection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => {
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
        {title}
      </Text>
      {children}
    </View>
  );
};

const StateLabel = ({ children }: { children: string }) => {
  const { theme } = useTheme();
  return (
    <Text style={[styles.stateLabel, { color: theme.colors.textSecondary }]}>
      {children}
    </Text>
  );
};

const PrimaryStatesContent = () => {
  const { theme } = useTheme();
  const iconColor = theme.colors.textInverse;
  return (
    <View style={styles.column}>
      <StateLabel>Default</StateLabel>
      <Button.primary text="Primary" onPress={() => console.log("Pressed")} />

      <StateLabel>With icon</StateLabel>
      <Button.primary
        text="Primary"
        icon={<Icon name="check" size={20} color={iconColor} />}
        onPress={() => console.log("Pressed")}
      />

      <StateLabel>Disabled</StateLabel>
      <Button.primary text="Primary" enabled={false} />

      <StateLabel>Loading</StateLabel>
      <Button.primary text="Primary" isLoading={true} />

      <StateLabel>
        Hover / focus / active are interactive — press or tab in.
      </StateLabel>
    </View>
  );
};

export const PrimaryStates = () => <PrimaryStatesContent />;

const SecondaryStatesContent = () => {
  const { theme } = useTheme();
  const iconColor = theme.colors.textSecondary;
  return (
    <View style={styles.column}>
      <StateLabel>Default</StateLabel>
      <Button.secondary
        text="Secondary"
        onPress={() => console.log("Pressed")}
      />

      <StateLabel>With icon</StateLabel>
      <Button.secondary
        text="Secondary"
        icon={<Icon name="settings" size={20} color={iconColor} />}
        onPress={() => console.log("Pressed")}
      />

      <StateLabel>Disabled</StateLabel>
      <Button.secondary text="Secondary" enabled={false} />

      <StateLabel>Loading</StateLabel>
      <Button.secondary text="Secondary" isLoading={true} />
    </View>
  );
};

export const SecondaryStates = () => <SecondaryStatesContent />;

const TertiaryStatesContent = () => {
  const { theme } = useTheme();
  const iconColor = theme.colors.textSecondary;
  return (
    <View style={styles.column}>
      <StateLabel>Default</StateLabel>
      <Button.tertiary text="Tertiary" onPress={() => console.log("Pressed")} />

      <StateLabel>With icon</StateLabel>
      <Button.tertiary
        text="Tertiary"
        icon={<Icon name="settings" size={20} color={iconColor} />}
        onPress={() => console.log("Pressed")}
      />

      <StateLabel>Disabled</StateLabel>
      <Button.tertiary text="Tertiary" enabled={false} />

      <StateLabel>Loading</StateLabel>
      <Button.tertiary text="Tertiary" isLoading={true} />
    </View>
  );
};

export const TertiaryStates = () => <TertiaryStatesContent />;

const UtilityStatesContent = () => {
  const { theme } = useTheme();
  const iconColor = theme.colors.textInverse;
  return (
    <View style={styles.column}>
      <StateLabel>Default (large)</StateLabel>
      <View style={styles.row}>
        <Button.utility text="Utility" onPress={() => console.log("Pressed")} />
        <Button.utility
          text="Utility"
          icon={<Icon name="settings" size={16} color={iconColor} />}
          onPress={() => console.log("Pressed")}
        />
      </View>

      <StateLabel>Small size</StateLabel>
      <View style={styles.row}>
        <Button.utility
          text="Utility"
          size="small"
          onPress={() => console.log("Pressed")}
        />
        <Button.utility
          text="Utility"
          size="small"
          icon={<Icon name="settings" size={16} color={iconColor} />}
          onPress={() => console.log("Pressed")}
        />
      </View>

      <StateLabel>Disabled</StateLabel>
      <View style={styles.row}>
        <Button.utility text="Utility" enabled={false} />
        <Button.utility text="Utility" size="small" enabled={false} />
      </View>

      <StateLabel>Loading</StateLabel>
      <View style={styles.row}>
        <Button.utility text="Utility" isLoading={true} />
        <Button.utility text="Utility" size="small" isLoading={true} />
      </View>
    </View>
  );
};

export const UtilityStates = () => <UtilityStatesContent />;

const AllVariantsContent = () => {
  const { theme } = useTheme();
  const iconColor = theme.colors.textInverse;
  return (
    <View style={styles.column}>
      <StorySection title="Primary">
        <Button.primary text="Primary" onPress={() => console.log("Pressed")} />
        <Button.primary
          text="With icon"
          icon={<Icon name="check" size={20} color={iconColor} />}
          onPress={() => console.log("Pressed")}
        />
      </StorySection>

      <StorySection title="Secondary">
        <Button.secondary
          text="Secondary"
          onPress={() => console.log("Pressed")}
        />
      </StorySection>

      <StorySection title="Tertiary">
        <Button.tertiary
          text="Tertiary"
          onPress={() => console.log("Pressed")}
        />
      </StorySection>

      <StorySection title="Utility">
        <View style={styles.row}>
          <Button.utility
            text="Utility"
            onPress={() => console.log("Pressed")}
          />
          <Button.utility
            text="Utility"
            size="small"
            onPress={() => console.log("Pressed")}
          />
          <Button.utility
            text="Utility"
            icon={<Icon name="settings" size={16} color={iconColor} />}
            onPress={() => console.log("Pressed")}
          />
        </View>
      </StorySection>

      <StorySection title="States">
        <Button.primary text="Loading" isLoading={true} />
        <Button.primary text="Disabled" enabled={false} />
      </StorySection>
    </View>
  );
};

export const AllVariants = () => <AllVariantsContent />;

const styles = StyleSheet.create({
  column: {
    gap: 16,
  },
  section: {
    gap: 12,
  },
  heading: {
    ...AquaTypography.h5SemiBold,
    marginTop: 8,
  },
  stateLabel: {
    ...AquaTypography.body2,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
  },
});

const gallery: GalleryEntry = {
  slug: "button",
  title: "Button",
  group: "UI",
  demos: [
    { name: "PrimaryStates", render: PrimaryStates },
    { name: "SecondaryStates", render: SecondaryStates },
    { name: "TertiaryStates", render: TertiaryStates },
    { name: "UtilityStates", render: UtilityStates },
    { name: "AllVariants", render: AllVariants },
  ],
};

export default gallery;
