import { Button as RNButton, StyleSheet, View } from "react-native";

import type { GalleryEntry } from "@/app/(dev)/design-system/manifest";
import {
  Tooltip,
  TooltipPointerPosition,
  TooltipVariant,
  useTooltip,
} from "@/components";

interface MatrixRow {
  isInfo: boolean;
  isDismissible: boolean;
  pointerPosition: TooltipPointerPosition;
}

const MATRIX: MatrixRow[] = [
  { isInfo: false, isDismissible: false, pointerPosition: "none" },
  { isInfo: true, isDismissible: false, pointerPosition: "none" },
  { isInfo: false, isDismissible: true, pointerPosition: "none" },
  { isInfo: true, isDismissible: true, pointerPosition: "none" },
  { isInfo: false, isDismissible: false, pointerPosition: "bottom" },
  { isInfo: true, isDismissible: false, pointerPosition: "bottom" },
  { isInfo: false, isDismissible: true, pointerPosition: "bottom" },
  { isInfo: true, isDismissible: true, pointerPosition: "bottom" },
];

const VariantMatrix = ({ variant }: { variant: TooltipVariant }) => (
  <View style={styles.matrix}>
    {MATRIX.map((row, index) => (
      <Tooltip
        key={index}
        visible
        message="Tooltip Title"
        variant={variant}
        isInfo={row.isInfo}
        isDismissible={row.isDismissible}
        pointerPosition={row.pointerPosition}
        margin={0}
      />
    ))}
  </View>
);

export const Normal = () => <VariantMatrix variant="normal" />;
export const Error = () => <VariantMatrix variant="error" />;

export const AutoDismiss = () => {
  const { show, tooltipState } = useTooltip();

  return (
    <View style={styles.interactive}>
      <RNButton
        title="Show Auto-Dismiss Tooltip"
        onPress={() =>
          show({
            message: "Auto-dismisses in 2 seconds",
            variant: "normal",
            duration: 2000,
          })
        }
      />
      <View style={styles.inlineTooltip}>
        <Tooltip {...tooltipState} margin={0} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  matrix: {
    gap: 12,
    alignSelf: "stretch",
    alignItems: "center",
  },
  interactive: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 16,
  },
  inlineTooltip: {
    minHeight: 34,
    alignItems: "center",
    alignSelf: "stretch",
  },
});

const gallery: GalleryEntry = {
  slug: "tooltip",
  title: "Tooltip",
  group: "UI",
  demos: [
    { name: "Normal", render: Normal },
    { name: "Error", render: Error },
    { name: "AutoDismiss", render: AutoDismiss },
  ],
};

export default gallery;
