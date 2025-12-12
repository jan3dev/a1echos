import {
  AquaColors,
  AquaTypography,
  darkColors,
  lightColors,
  shadows,
  spacing,
  useThemeStore,
} from '@/theme';
import { useMemo } from 'react';

export interface Theme {
  colors: AquaColors;
  typography: typeof AquaTypography;
  spacing: typeof spacing;
  shadows: typeof shadows;
}

export const useTheme = () => {
  const { currentTheme, selectedTheme, setTheme } = useThemeStore();

  const theme = useMemo<Theme>(() => {
    const colors = currentTheme === 'dark' ? darkColors : lightColors;

    return {
      colors,
      typography: AquaTypography,
      spacing,
      shadows,
    };
  }, [currentTheme]);

  const isDark = useMemo(() => currentTheme === 'dark', [currentTheme]);

  return {
    theme,
    isDark,
    selectedTheme,
    setTheme,
  };
};
