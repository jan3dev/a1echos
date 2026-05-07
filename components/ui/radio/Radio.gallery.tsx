import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Radio } from "@/components";
import { AquaTypography, useTheme } from "@/theme";
import type { GalleryEntry } from "@/app/(design-system)/manifest";

const RadioGroup = ({ size = "large" }: { size?: "large" | "small" }) => {
  const [selected, setSelected] = useState("option1");
  const { theme } = useTheme();

  return (
    <View style={styles.radioGroup}>
      <View style={styles.radioItem}>
        <Radio
          value="option1"
          groupValue={selected}
          onValueChange={setSelected}
          size={size}
        />
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
          Option 1
        </Text>
      </View>
      <View style={styles.radioItem}>
        <Radio
          value="option2"
          groupValue={selected}
          onValueChange={setSelected}
          size={size}
        />
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
          Option 2
        </Text>
      </View>
      <View style={styles.radioItem}>
        <Radio
          value="option3"
          groupValue={selected}
          onValueChange={setSelected}
          size={size}
        />
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
          Option 3
        </Text>
      </View>
    </View>
  );
};

export const Large = () => <RadioGroup size="large" />;

export const Small = () => <RadioGroup size="small" />;

const DisabledContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.radioGroup}>
      <View style={styles.radioItem}>
        <Radio
          value="option1"
          groupValue="option1"
          enabled={false}
          size="large"
        />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Selected Disabled
        </Text>
      </View>
      <View style={styles.radioItem}>
        <Radio
          value="option2"
          groupValue="option1"
          enabled={false}
          size="large"
        />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Unselected Disabled
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
        <RadioGroup size="large" />
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Small
        </Text>
        <RadioGroup size="small" />
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Disabled
        </Text>
        <View style={styles.radioGroup}>
          <View style={styles.radioItem}>
            <Radio
              value="option1"
              groupValue="option1"
              enabled={false}
              size="large"
            />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Selected
            </Text>
          </View>
          <View style={styles.radioItem}>
            <Radio
              value="option2"
              groupValue="option1"
              enabled={false}
              size="large"
            />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Unselected
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
  radioGroup: {
    gap: 16,
  },
  radioItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  label: {
    ...AquaTypography.body1,
  },
});

const gallery: GalleryEntry = {
  slug: "radio",
  title: "Radio",
  group: "UI",
  demos: [
    { name: "Large", render: Large },
    { name: "Small", render: Small },
    { name: "Disabled", render: Disabled },
    { name: "AllVariants", render: AllVariants },
  ],
};

export default gallery;
