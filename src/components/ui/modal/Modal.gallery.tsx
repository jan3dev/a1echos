import { Button as RNButton, StyleSheet, View } from "react-native";

import { Icon, Modal, useModal } from "@/components";
import { useTheme } from "@/theme";

import type { GalleryEntry } from "@/design-system/manifest";

const ModalDemo = ({
  withIcon,
  withSecondaryButton,
}: {
  withIcon?: boolean;
  withSecondaryButton?: boolean;
}) => {
  const { show, modalState } = useModal();
  const { theme } = useTheme();

  const handleShow = () => {
    show({
      title: "Modal Title",
      message: "This is a modal message with some descriptive text.",
      primaryButton: {
        text: "Primary Action",
        onTap: () => console.log("Primary tapped"),
      },
      secondaryButton: withSecondaryButton
        ? {
            text: "Secondary Action",
            onTap: () => console.log("Secondary tapped"),
          }
        : undefined,
      icon: withIcon ? (
        <Icon name="warning" size={24} color={theme.colors.textPrimary} />
      ) : undefined,
    });
  };

  return (
    <View style={styles.container}>
      <RNButton title="Show Modal" onPress={handleShow} />
      <Modal {...modalState} />
    </View>
  );
};

export const Primary = () => <ModalDemo withIcon />;

export const PrimaryAndSecondary = () => (
  <ModalDemo withIcon withSecondaryButton />
);

export const LongText = () => {
  const { show, modalState } = useModal();
  const { theme } = useTheme();

  const handleShow = () => {
    show({
      title: "This is a very long title that might wrap to multiple lines",
      message:
        "This is a very long message with lots of descriptive text that will definitely wrap to multiple lines to demonstrate the layout behavior in the modal.",
      primaryButton: {
        text: "Got it",
        onTap: () => console.log("Got it"),
      },
      secondaryButton: {
        text: "Cancel",
        onTap: () => console.log("Cancel"),
      },
      icon: <Icon name="warning" size={24} color={theme.colors.textPrimary} />,
      titleMaxLines: 5,
      messageMaxLines: 10,
    });
  };

  return (
    <View style={styles.container}>
      <RNButton title="Show Modal with Long Text" onPress={handleShow} />
      <Modal {...modalState} />
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
  slug: "modal",
  title: "Modal",
  group: "UI",
  demos: [
    { name: "Primary", render: Primary },
    { name: "PrimaryAndSecondary", render: PrimaryAndSecondary },
    { name: "LongText", render: LongText },
  ],
};

export default gallery;
