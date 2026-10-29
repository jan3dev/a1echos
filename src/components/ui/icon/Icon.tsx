import { I18nManager, StyleSheet, View, ViewStyle } from "react-native";

import { AquaPrimitiveColors } from "@/theme";
import { logWarn } from "@/utils";

import { iconMap, IconName } from "./iconMap";

export type { IconName };

// A caller's style.transform replaces this mirroring (ScrollToEdgeButton).
const MIRRORED_IN_RTL = new Set<IconName>([
  "chevron_left",
  "chevron_right",
  "folder_move_to",
  "redo",
]);

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export const Icon = ({
  name,
  size = 24,
  color = AquaPrimitiveColors.metal950,
  style,
}: IconProps) => {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    logWarn(`Icon not found: ${name}`);
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size },
        I18nManager.isRTL && MIRRORED_IN_RTL.has(name) && styles.mirrored,
        style,
      ]}
    >
      <IconComponent width={size} height={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  mirrored: {
    transform: [{ scaleX: -1 }],
  },
});
