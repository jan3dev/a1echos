import { ComponentProps, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { TextField } from "@/components";
import { AquaTypography, useTheme } from "@/theme";

import type { GalleryEntry } from "@/design-system/manifest";

const TextFieldWithState = (
  props: Omit<ComponentProps<typeof TextField>, "onChangeText">,
) => {
  const [value, setValue] = useState(props.value || "");
  return <TextField {...props} value={value} onChangeText={setValue} />;
};

export const Default = () => (
  <TextFieldWithState
    label="Label"
    value="Input Text"
    showClearIcon
    showPasteIcon
    assistiveText="Assistive text"
  />
);

export const Brand = () => (
  <TextFieldWithState
    label="Label"
    value="Input Text"
    variant="brand"
    showClearIcon
    showPasteIcon
    assistiveText="Assistive text"
  />
);

export const ErrorState = () => (
  <TextFieldWithState
    label="Label"
    value="Input Text"
    error
    showClearIcon
    showPasteIcon
    assistiveText="Assistive text"
  />
);

export const Disabled = () => (
  <TextFieldWithState
    label="Label"
    value="Input Text"
    enabled={false}
    showClearIcon
    showPasteIcon
    assistiveText="Assistive text"
  />
);

const AllVariantsContent = () => {
  const { theme } = useTheme();
  const sectionStyle = [styles.heading, { color: theme.colors.textPrimary }];

  return (
    <View style={styles.column}>
      <View style={styles.section}>
        <Text style={sectionStyle}>Default</Text>
        <TextFieldWithState label="Label" />
        <TextFieldWithState label="Label" value="Input Text" showClearIcon />
        <TextFieldWithState label="Label" showPasteIcon />
        <TextFieldWithState
          label="Label"
          value="Input Text"
          showClearIcon
          showPasteIcon
          assistiveText="Assistive text"
        />
      </View>

      <View style={styles.section}>
        <Text style={sectionStyle}>Brand</Text>
        <TextFieldWithState label="Label" variant="brand" />
        <TextFieldWithState
          label="Label"
          value="Input Text"
          variant="brand"
          showClearIcon
          showPasteIcon
        />
        <TextFieldWithState
          label="Label"
          variant="brand"
          showPasteIcon
          assistiveText="Assistive text"
        />
      </View>

      <View style={styles.section}>
        <Text style={sectionStyle}>Error</Text>
        <TextFieldWithState label="Label" error />
        <TextFieldWithState
          label="Label"
          value="Input Text"
          error
          showClearIcon
          showPasteIcon
          assistiveText="Assistive text"
        />
      </View>

      <View style={styles.section}>
        <Text style={sectionStyle}>Disabled</Text>
        <TextFieldWithState label="Label" enabled={false} />
        <TextFieldWithState
          label="Label"
          value="Input Text"
          enabled={false}
          showClearIcon
          showPasteIcon
          assistiveText="Assistive text"
        />
      </View>
    </View>
  );
};

export const AllVariants = () => <AllVariantsContent />;

const styles = StyleSheet.create({
  column: {
    gap: 24,
  },
  section: {
    gap: 12,
  },
  heading: {
    ...AquaTypography.h5SemiBold,
  },
});

const gallery: GalleryEntry = {
  slug: "textfield",
  title: "TextField",
  group: "UI",
  demos: [
    { name: "Default", render: Default },
    { name: "Brand", render: Brand },
    { name: "Error", render: ErrorState },
    { name: "Disabled", render: Disabled },
    { name: "AllVariants", render: AllVariants },
  ],
};

export default gallery;
