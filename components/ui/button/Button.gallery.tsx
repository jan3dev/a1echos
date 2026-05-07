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

const PrimaryContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <Button.primary
        text="Primary Button"
        onPress={() => console.log("Pressed")}
      />
      <Button.primary
        text="With Icon"
        icon={<Icon name="check" size={20} color={theme.colors.textInverse} />}
        onPress={() => console.log("Pressed")}
      />
      <Button.primary text="Loading" isLoading={true} />
      <Button.primary text="Disabled" enabled={false} />
    </View>
  );
};

export const Primary = () => <PrimaryContent />;

const PrimarySmallContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <Button.primary
        text="Small Primary"
        size="small"
        onPress={() => console.log("Pressed")}
      />
      <Button.primary
        text="Small with Icon"
        size="small"
        icon={<Icon name="check" size={16} color={theme.colors.textInverse} />}
        onPress={() => console.log("Pressed")}
      />
    </View>
  );
};

export const PrimarySmall = () => <PrimarySmallContent />;

const PrimaryVariantsContent = () => (
  <View style={styles.column}>
    <Button.primary
      text="Normal"
      variant="normal"
      onPress={() => console.log("Pressed")}
    />
    <Button.primary
      text="Error"
      variant="error"
      onPress={() => console.log("Pressed")}
    />
    <Button.primary
      text="Success"
      variant="success"
      onPress={() => console.log("Pressed")}
    />
    <Button.primary
      text="Warning"
      variant="warning"
      onPress={() => console.log("Pressed")}
    />
  </View>
);

export const PrimaryVariants = () => <PrimaryVariantsContent />;

const SecondaryContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <Button.secondary
        text="Secondary Button"
        onPress={() => console.log("Pressed")}
      />
      <Button.secondary
        text="With Icon"
        icon={
          <Icon name="settings" size={20} color={theme.colors.accentBrand} />
        }
        onPress={() => console.log("Pressed")}
      />
      <Button.secondary text="Loading" isLoading={true} />
      <Button.secondary text="Disabled" enabled={false} />
    </View>
  );
};

export const Secondary = () => <SecondaryContent />;

const SecondaryVariantsContent = () => (
  <View style={styles.column}>
    <Button.secondary
      text="Normal"
      variant="normal"
      onPress={() => console.log("Pressed")}
    />
    <Button.secondary
      text="Error"
      variant="error"
      onPress={() => console.log("Pressed")}
    />
    <Button.secondary
      text="Success"
      variant="success"
      onPress={() => console.log("Pressed")}
    />
    <Button.secondary
      text="Warning"
      variant="warning"
      onPress={() => console.log("Pressed")}
    />
  </View>
);

export const SecondaryVariants = () => <SecondaryVariantsContent />;

const TertiaryContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <Button.tertiary
        text="Tertiary Button"
        onPress={() => console.log("Pressed")}
      />
      <Button.tertiary
        text="With Icon"
        icon={
          <Icon name="settings" size={20} color={theme.colors.textPrimary} />
        }
        onPress={() => console.log("Pressed")}
      />
      <Button.tertiary text="Loading" isLoading={true} />
      <Button.tertiary text="Disabled" enabled={false} />
    </View>
  );
};

export const Tertiary = () => <TertiaryContent />;

const UtilityContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <Button.utility text="Utility" onPress={() => console.log("Pressed")} />
      <Button.utility
        text="With Icon"
        icon={
          <Icon name="settings" size={16} color={theme.colors.textPrimary} />
        }
        onPress={() => console.log("Pressed")}
      />
      <Button.utility text="Loading" isLoading={true} />
      <Button.utility text="Disabled" enabled={false} />
    </View>
  );
};

export const Utility = () => <UtilityContent />;

const UtilitySecondaryContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <Button.utilitySecondary
        text="Utility 2"
        onPress={() => console.log("Pressed")}
      />
      <Button.utilitySecondary
        text="With Icon"
        icon={
          <Icon name="settings" size={16} color={theme.colors.textPrimary} />
        }
        onPress={() => console.log("Pressed")}
      />
      <Button.utilitySecondary text="Loading" isLoading={true} />
      <Button.utilitySecondary text="Disabled" enabled={false} />
    </View>
  );
};

export const UtilitySecondary = () => <UtilitySecondaryContent />;

const AllVariantsContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <StorySection title="Primary">
        <Button.primary text="Primary" onPress={() => console.log("Pressed")} />
        <Button.primary
          text="Primary Error"
          variant="error"
          onPress={() => console.log("Pressed")}
        />
      </StorySection>

      <StorySection title="Secondary">
        <Button.secondary
          text="Secondary"
          onPress={() => console.log("Pressed")}
        />
        <Button.secondary
          text="Secondary Success"
          variant="success"
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
          <Button.utilitySecondary
            text="Utility 2"
            onPress={() => console.log("Pressed")}
          />
          <Button.utility
            text="Utility"
            isLoading={true}
            onPress={() => console.log("Pressed")}
          />
          <Button.utilitySecondary
            text="Utility 2"
            isLoading={true}
            onPress={() => console.log("Pressed")}
          />
          <Button.utility
            text="Utility"
            icon={
              <Icon
                name="settings"
                size={16}
                color={theme.colors.textPrimary}
              />
            }
            onPress={() => console.log("Pressed")}
          />
          <Button.utilitySecondary
            text="Utility 2"
            icon={
              <Icon
                name="settings"
                size={16}
                color={theme.colors.textPrimary}
              />
            }
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
    { name: "Primary", render: Primary },
    { name: "PrimarySmall", render: PrimarySmall },
    { name: "PrimaryVariants", render: PrimaryVariants },
    { name: "Secondary", render: Secondary },
    { name: "SecondaryVariants", render: SecondaryVariants },
    { name: "Tertiary", render: Tertiary },
    { name: "Utility", render: Utility },
    { name: "UtilitySecondary", render: UtilitySecondary },
    { name: "AllVariants", render: AllVariants },
  ],
};

export default gallery;
