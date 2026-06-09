import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

import { AquaTypography, getShadow, useTheme } from "@/theme";
import type { GalleryEntry } from "@/design-system/manifest";

/**
 * Manual test harness for the Echos custom keyboard's field-type adaptive
 * layouts (see docs/keyboard_tasks.md §9). Each field pins the native input
 * traits the keyboards read — `keyboardType` (iOS `UIKeyboardType` /
 * Android `inputType`), `returnKeyType` (Android `imeOptions`),
 * `secureTextEntry`, `textContentType`, `autoComplete` — so focusing a field
 * shows exactly the layout that field type triggers.
 *
 * Note (Android): React Native folds the iOS-only `keyboardType` values
 * (`ascii-capable`, `numbers-and-punctuation`, `name-phone-pad`, `twitter`,
 * `web-search`, `ascii-capable-number-pad`) back to the text keyboard. The
 * fields below still set the iOS value so iOS gets the right type; on Android
 * those rows fall back to QWERTY, which is the expected RN behavior.
 *
 * Note (iOS): for `phone-pad` / `name-phone-pad` and secure-entry fields
 * (password, etc.) iOS forbids third-party keyboards and shows the SYSTEM
 * keyboard instead — so those rows have no globe switcher and no Echos mic
 * button. That is expected, not a bug (see docs/keyboard_tasks.md §9.1); those
 * fields exist here to verify the system takeover.
 */

type FieldSpec = {
  label: string;
  props: Partial<TextInputProps>;
  placeholder?: string;
};

const KeyboardTestField = ({ label, props, placeholder }: FieldSpec) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [value, setValue] = useState("");

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputShadow,
          getShadow("input"),
          { backgroundColor: colors.surfacePrimary },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            AquaTypography.body1,
            { color: colors.textPrimary },
          ]}
          value={value}
          onChangeText={setValue}
          placeholder={placeholder ?? label}
          placeholderTextColor={colors.textTertiary}
          cursorColor={colors.accentBrand}
          underlineColorAndroid="transparent"
          disableFullscreenUI
          {...props}
        />
      </View>
    </View>
  );
};

const FieldList = ({ fields }: { fields: FieldSpec[] }) => (
  <View style={styles.column}>
    {fields.map((field) => (
      <KeyboardTestField key={field.label} {...field} />
    ))}
  </View>
);

// -- iOS UIKeyboardType coverage (the 12 documented virtual keyboards) --

const TEXT_FIELDS: FieldSpec[] = [
  { label: "default", props: { keyboardType: "default" } },
  { label: "ascii-capable (iOS)", props: { keyboardType: "ascii-capable" } },
  {
    label: "numbers-and-punctuation (iOS)",
    props: { keyboardType: "numbers-and-punctuation" },
  },
];

const NUMERIC_FIELDS: FieldSpec[] = [
  { label: "number-pad", props: { keyboardType: "number-pad" } },
  { label: "decimal-pad", props: { keyboardType: "decimal-pad" } },
  { label: "numeric (signed + decimal)", props: { keyboardType: "numeric" } },
  // NOTE: `.asciiCapableNumberPad` (UIKeyboardType) is not exposed by RN's
  // `keyboardType`, so it can't be triggered from JS — covered in
  // docs/keyboard_tasks.md §9.1 #6 (behaves like `.numberPad`).
];

const PHONE_FIELDS: FieldSpec[] = [
  {
    label: "phone-pad",
    props: {
      keyboardType: "phone-pad",
      textContentType: "telephoneNumber",
      autoComplete: "tel",
    },
  },
  {
    label: "name-phone-pad (iOS)",
    props: { keyboardType: "name-phone-pad", textContentType: "name" },
  },
];

const CONTEXTUAL_FIELDS: FieldSpec[] = [
  {
    label: "email-address",
    props: {
      keyboardType: "email-address",
      textContentType: "emailAddress",
      autoComplete: "email",
      autoCapitalize: "none",
    },
  },
  {
    label: "url",
    props: {
      keyboardType: "url",
      textContentType: "URL",
      autoComplete: "off",
      autoCapitalize: "none",
      returnKeyType: "go",
    },
  },
  {
    label: "web-search (iOS)",
    props: { keyboardType: "web-search", returnKeyType: "search" },
  },
  { label: "twitter (iOS)", props: { keyboardType: "twitter" } },
];

const SECURE_FIELDS: FieldSpec[] = [
  {
    label: "password (secureTextEntry)",
    props: {
      secureTextEntry: true,
      textContentType: "password",
      autoComplete: "password",
      autoCapitalize: "none",
    },
  },
  {
    label: "visible-password (Android)",
    props: { keyboardType: "visible-password", autoCapitalize: "none" },
  },
  {
    label: "one-time-code",
    props: {
      keyboardType: "number-pad",
      textContentType: "oneTimeCode",
      autoComplete: "sms-otp",
    },
  },
  {
    // Android: TYPE_CLASS_NUMBER + VARIATION_PASSWORD → the stripped
    // digits-only numeric pad (§9.2). iOS forces the system keyboard for
    // secure entry, so this row verifies the system takeover there.
    label: "numeric-password / PIN",
    props: {
      keyboardType: "number-pad",
      secureTextEntry: true,
      textContentType: "password",
      autoComplete: "off",
    },
  },
];

// -- Return key (iOS returnKeyType / Android imeOptions) --

const RETURN_KEY_FIELDS: FieldSpec[] = (
  ["go", "google", "search", "send", "next", "done"] as const
).map((returnKeyType) => ({
  label: `returnKeyType: ${returnKeyType}`,
  props: { returnKeyType },
}));

export const TextLayouts = () => <FieldList fields={TEXT_FIELDS} />;
export const NumericPads = () => <FieldList fields={NUMERIC_FIELDS} />;
export const PhonePads = () => <FieldList fields={PHONE_FIELDS} />;
export const ContextualText = () => <FieldList fields={CONTEXTUAL_FIELDS} />;
export const SecureAndCodes = () => <FieldList fields={SECURE_FIELDS} />;
export const ReturnKey = () => <FieldList fields={RETURN_KEY_FIELDS} />;

const styles = StyleSheet.create({
  column: {
    width: "100%",
    gap: 16,
  },
  field: {
    width: "100%",
    gap: 6,
  },
  fieldLabel: {
    ...AquaTypography.caption1Medium,
  },
  inputShadow: {
    borderRadius: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
});

const gallery: GalleryEntry = {
  slug: "keyboard-layouts",
  title: "Keyboard Layouts",
  group: "Domain",
  demos: [
    { name: "Text layouts", render: TextLayouts },
    { name: "Numeric pads", render: NumericPads },
    { name: "Phone pads", render: PhonePads },
    { name: "Contextual text", render: ContextualText },
    { name: "Secure & codes", render: SecureAndCodes },
    { name: "Return key", render: ReturnKey },
  ],
};

export default gallery;
