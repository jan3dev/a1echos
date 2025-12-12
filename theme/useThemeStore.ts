import { AppTheme } from '@/models';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { create } from 'zustand';

type ThemeMode = 'light' | 'dark';

interface ThemeState {
  selectedTheme: AppTheme;
  currentTheme: ThemeMode;
  setTheme: (theme: AppTheme) => Promise<void>;
  initTheme: () => Promise<void>;
}

const SELECTED_THEME_KEY = 'selectedTheme';

let appearanceSubscription: ReturnType<
  typeof Appearance.addChangeListener
> | null = null;

const resolveCurrentTheme = (selectedTheme: AppTheme): ThemeMode => {
  if (selectedTheme === AppTheme.LIGHT) return 'light';
  if (selectedTheme === AppTheme.DARK) return 'dark';

  const systemTheme = Appearance.getColorScheme();
  return systemTheme === 'dark' ? 'dark' : 'light';
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  selectedTheme: AppTheme.AUTO,
  currentTheme: 'light',

  setTheme: async (theme: AppTheme) => {
    try {
      await AsyncStorage.setItem(SELECTED_THEME_KEY, theme);
      const currentTheme = resolveCurrentTheme(theme);
      set({ selectedTheme: theme, currentTheme });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  },

  initTheme: async () => {
    try {
      const storedTheme = await AsyncStorage.getItem(SELECTED_THEME_KEY);
      const selectedTheme =
        storedTheme && Object.values(AppTheme).includes(storedTheme as AppTheme)
          ? (storedTheme as AppTheme)
          : AppTheme.AUTO;

      const currentTheme = resolveCurrentTheme(selectedTheme);
      set({ selectedTheme, currentTheme });

      if (appearanceSubscription) {
        appearanceSubscription.remove();
      }

      appearanceSubscription = Appearance.addChangeListener(
        ({ colorScheme }) => {
          const { selectedTheme } = get();
          if (selectedTheme === AppTheme.AUTO) {
            set({ currentTheme: colorScheme === 'dark' ? 'dark' : 'light' });
          }
        }
      );
    } catch (error) {
      console.error('Failed to initialize theme:', error);
    }
  },
}));
