import { Button as RNButton, StyleSheet, View } from "react-native";

import { Toast, ToastVariant, useToast } from "@/components";
import type { GalleryEntry } from "@/app/(design-system)/manifest";

const ToastDemo = ({
  variant,
  withPrimaryButton,
  withSecondaryButton,
}: {
  variant: ToastVariant;
  withPrimaryButton?: boolean;
  withSecondaryButton?: boolean;
}) => {
  const { show, toastState } = useToast();

  const handleShow = () => {
    show({
      title: "Toast Title",
      message: "This is a toast message with some descriptive text.",
      variant,
      primaryButtonText: withPrimaryButton ? "Primary" : undefined,
      onPrimaryButtonTap: withPrimaryButton
        ? () => console.log("Primary tapped")
        : undefined,
      secondaryButtonText: withSecondaryButton ? "Secondary" : undefined,
      onSecondaryButtonTap: withSecondaryButton
        ? () => console.log("Secondary tapped")
        : undefined,
    });
  };

  return (
    <View style={styles.container}>
      <RNButton title="Show Toast" onPress={handleShow} />
      <Toast {...toastState} />
    </View>
  );
};

export const Informative = () => <ToastDemo variant="informative" />;

export const Warning = () => <ToastDemo variant="warning" />;

export const Danger = () => <ToastDemo variant="danger" />;

export const WithPrimaryButton = () => (
  <ToastDemo variant="informative" withPrimaryButton />
);

export const WithBothButtons = () => (
  <ToastDemo variant="warning" withPrimaryButton withSecondaryButton />
);

export const LongText = () => {
  const { show, toastState } = useToast();

  const handleShow = () => {
    show({
      title: "This is a very long title that might wrap to multiple lines",
      message:
        "This is a very long message with lots of descriptive text that will definitely wrap to multiple lines to test the layout.",
      variant: "danger",
      titleMaxLines: 3,
      messageMaxLines: 5,
      primaryButtonText: "Got it",
      onPrimaryButtonTap: () => console.log("Got it tapped"),
    });
  };

  return (
    <View style={styles.container}>
      <RNButton title="Show Toast with Long Text" onPress={handleShow} />
      <Toast {...toastState} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
});

const gallery: GalleryEntry = {
  slug: "toast",
  title: "Toast",
  group: "UI",
  demos: [
    { name: "Informative", render: Informative },
    { name: "Warning", render: Warning },
    { name: "Danger", render: Danger },
    { name: "WithPrimaryButton", render: WithPrimaryButton },
    { name: "WithBothButtons", render: WithBothButtons },
    { name: "LongText", render: LongText },
  ],
};

export default gallery;
