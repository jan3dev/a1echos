import { ComponentProps, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Toggle } from "@/components";
import { AquaTypography, useTheme } from "@/theme";
import type { GalleryEntry } from "@/design-system/manifest";

const ToggleWithState = (props: ComponentProps<typeof Toggle>) => {
  const [value, setValue] = useState(props.value || false);
  return <Toggle {...props} value={value} onValueChange={setValue} />;
};

export const Off = () => <ToggleWithState value={false} />;

export const On = () => <ToggleWithState value={true} />;

const DisabledContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <Toggle value={false} enabled={false} />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Off Disabled
        </Text>
      </View>
      <View style={styles.item}>
        <Toggle value={true} enabled={false} />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          On Disabled
        </Text>
      </View>
    </View>
  );
};

export const Disabled = () => <DisabledContent />;

const CustomColorsContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <ToggleWithState value={false} activeColor="#18A23B" />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Custom Green
        </Text>
      </View>
      <View style={styles.item}>
        <ToggleWithState value={false} activeColor="#FF3B13" />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Custom Red
        </Text>
      </View>
      <View style={styles.item}>
        <ToggleWithState value={false} activeColor="#FFAB1B" />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Custom Amber
        </Text>
      </View>
    </View>
  );
};

export const CustomColors = () => <CustomColorsContent />;

const AllVariantsContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Basic
        </Text>
        <View style={styles.row}>
          <View style={styles.item}>
            <ToggleWithState value={false} />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Off
            </Text>
          </View>
          <View style={styles.item}>
            <ToggleWithState value={true} />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              On
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Disabled
        </Text>
        <View style={styles.row}>
          <View style={styles.item}>
            <Toggle value={false} enabled={false} />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Off
            </Text>
          </View>
          <View style={styles.item}>
            <Toggle value={true} enabled={false} />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              On
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Custom Colors
        </Text>
        <View style={styles.row}>
          <View style={styles.item}>
            <ToggleWithState value={true} activeColor="#18A23B" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Green
            </Text>
          </View>
          <View style={styles.item}>
            <ToggleWithState value={true} activeColor="#FF3B13" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Red
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export const AllVariants = () => <AllVariantsContent />;

const styles = StyleSheet.create({
  column: {
    gap: 32,
  },
  section: {
    gap: 16,
  },
  heading: {
    ...AquaTypography.h5SemiBold,
  },
  row: {
    flexDirection: "row",
    gap: 32,
    alignItems: "center",
  },
  item: {
    gap: 8,
    alignItems: "center",
  },
  label: {
    ...AquaTypography.body2,
  },
});

const gallery: GalleryEntry = {
  slug: "toggle",
  title: "Toggle",
  group: "UI",
  demos: [
    { name: "Off", render: Off },
    { name: "On", render: On },
    { name: "Disabled", render: Disabled },
    { name: "CustomColors", render: CustomColors },
    { name: "AllVariants", render: AllVariants },
  ],
};

export default gallery;
