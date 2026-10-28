import { ReactNode } from "react";
import { Pressable, PressableProps } from "react-native";

import { useTheme } from "@/theme";

type RipplePressableProps = Omit<
  PressableProps,
  "android_ripple" | "children"
> & {
  rippleColor?: string;
  borderless?: boolean;
  children?: ReactNode;
};

export const RipplePressable = ({
  rippleColor,
  borderless = false,
  ...rest
}: RipplePressableProps) => {
  const { theme } = useTheme();
  return (
    <Pressable
      // Foreground so a backgroundColor on the pressable doesn't hide it.
      android_ripple={{
        color: rippleColor ?? theme.colors.ripple,
        borderless,
        foreground: true,
      }}
      {...rest}
    />
  );
};
