import { ComponentProps, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { GalleryEntry } from "@/app/(dev)/design-system/manifest";
import { Checkbox } from "@/components";
import { AquaTypography, useTheme } from "@/theme";

const CheckboxWithState = (props: ComponentProps<typeof Checkbox>) => {
  const [checked, setChecked] = useState(props.value ?? false);
  return <Checkbox {...props} value={checked} onValueChange={setChecked} />;
};

export const LargeChecked = () => (
  <CheckboxWithState value={true} size="large" />
);

export const LargeUnchecked = () => (
  <CheckboxWithState value={false} size="large" />
);

export const SmallChecked = () => (
  <CheckboxWithState value={true} size="small" />
);

export const SmallUnchecked = () => (
  <CheckboxWithState value={false} size="small" />
);

const DisabledContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <Checkbox value={false} enabled={false} size="large" />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Unchecked Disabled
        </Text>
      </View>
      <View style={styles.item}>
        <Checkbox value={true} enabled={false} size="large" />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Checked Disabled
        </Text>
      </View>
    </View>
  );
};

export const Disabled = () => <DisabledContent />;

const AllVariantsContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Large
        </Text>
        <View style={styles.row}>
          <View style={styles.item}>
            <CheckboxWithState value={false} size="large" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Unchecked
            </Text>
          </View>
          <View style={styles.item}>
            <CheckboxWithState value={true} size="large" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Checked
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Small
        </Text>
        <View style={styles.row}>
          <View style={styles.item}>
            <CheckboxWithState value={false} size="small" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Unchecked
            </Text>
          </View>
          <View style={styles.item}>
            <CheckboxWithState value={true} size="small" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Checked
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
            <Checkbox value={false} enabled={false} size="large" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Unchecked
            </Text>
          </View>
          <View style={styles.item}>
            <Checkbox value={true} enabled={false} size="large" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Checked
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
  slug: "checkbox",
  title: "Checkbox",
  group: "UI",
  demos: [
    { name: "LargeChecked", render: LargeChecked },
    { name: "LargeUnchecked", render: LargeUnchecked },
    { name: "SmallChecked", render: SmallChecked },
    { name: "SmallUnchecked", render: SmallUnchecked },
    { name: "Disabled", render: Disabled },
    { name: "AllVariants", render: AllVariants },
  ],
};

export default gallery;
