import { useMemo } from "react";

import { shadows } from "../shadows/shadows";
import { spacing } from "../spacing/spacing";
import {
  AquaColors,
  darkColors,
  lightColors,
} from "../theme-colors/themeColors";
import { AquaTypography } from "../typography/typography";
import { useThemeStore } from "../use-theme-store/useThemeStore";

export interface Theme {
  colors: AquaColors;
  typography: typeof AquaTypography;
  spacing: typeof spacing;
  shadows: typeof shadows;
}

export const useTheme = () => {
  const { currentTheme, selectedTheme, setTheme } = useThemeStore();

  const theme = useMemo<Theme>(() => {
    const colors = currentTheme === "dark" ? darkColors : lightColors;

    return {
      colors,
      typography: AquaTypography,
      spacing,
      shadows,
    };
  }, [currentTheme]);

  const isDark = useMemo(() => currentTheme === "dark", [currentTheme]);

  return {
    theme,
    isDark,
    selectedTheme,
    setTheme,
  };
};
