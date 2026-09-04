import { Button as RNButton, StyleSheet, View } from "react-native";

import { Toast, ToastVariant, useToast } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

const ToastDemo = ({
  variant,
  withPrimaryButton,
  withSecondaryButton,
  durationMs,
}: {
  variant: ToastVariant;
  withPrimaryButton?: boolean;
  withSecondaryButton?: boolean;
  durationMs?: number;
}) => {
  const { show, toastState } = useToast();

  const handleShow = () => {
    show({
      title: "Toast Title",
      message: "This is a toast message with some descriptive text.",
      variant,
      durationMs,
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

export const Info = () => <ToastDemo variant="info" />;

export const Warning = () => <ToastDemo variant="warning" />;

export const Error = () => <ToastDemo variant="error" />;

export const NoActions = () => <ToastDemo variant="warning" />;

export const WithPrimaryButton = () => (
  <ToastDemo variant="info" withPrimaryButton />
);

export const WithBothButtons = () => (
  <ToastDemo variant="warning" withPrimaryButton withSecondaryButton />
);

export const WithCountdown = () => (
  <ToastDemo variant="info" withPrimaryButton durationMs={4000} />
);

export const WithCountdownNoActions = () => (
  <ToastDemo variant="warning" durationMs={3000} />
);

export const LongText = () => {
  const { show, toastState } = useToast();

  const handleShow = () => {
    show({
      title: "This is a very long title that might wrap to multiple lines",
      message:
        "This is a very long message with lots of descriptive text that will definitely wrap to multiple lines to test the layout.",
      variant: "error",
      titleMaxLines: 3,
      messageMaxLines: 5,
      primaryButtonText: "Got It",
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
    { name: "Info", render: Info },
    { name: "Warning", render: Warning },
    { name: "Error", render: Error },
    { name: "NoActions", render: NoActions },
    { name: "WithPrimaryButton", render: WithPrimaryButton },
    { name: "WithBothButtons", render: WithBothButtons },
    { name: "WithCountdown", render: WithCountdown },
    { name: "WithCountdownNoActions", render: WithCountdownNoActions },
    { name: "LongText", render: LongText },
  ],
};

export default gallery;
