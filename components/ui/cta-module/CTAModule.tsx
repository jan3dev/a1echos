import { StyleSheet, View } from "react-native";

import { Button, ButtonProps } from "../button/Button";

export type CTAButton = ButtonProps;

export interface CTAModuleProps {
  primary: CTAButton;
  secondary?: CTAButton;
  tertiary?: CTAButton;
  testID?: string;
}

const CTA_GAP = 16;

export const CTAModule = ({
  primary,
  secondary,
  tertiary,
  testID,
}: CTAModuleProps) => (
  <View style={styles.container} testID={testID}>
    <Button.primary {...primary} />
    {secondary && <Button.secondary {...secondary} />}
    {tertiary && <Button.tertiary {...tertiary} />}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    gap: CTA_GAP,
  },
});
