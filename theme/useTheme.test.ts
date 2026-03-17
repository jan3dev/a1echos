import { act, renderHook } from '@testing-library/react-native';

import { AppTheme } from '@/models';

import { darkColors, lightColors } from './themeColors';
import { useTheme } from './useTheme';
import { useThemeStore } from './useThemeStore';

describe('useTheme', () => {
  beforeEach(() => {
    useThemeStore.setState({
      selectedTheme: AppTheme.AUTO,
      currentTheme: 'light',
    });
  });

  it('returns theme object with colors, typography, spacing, shadows', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toHaveProperty('colors');
    expect(result.current.theme).toHaveProperty('typography');
    expect(result.current.theme).toHaveProperty('spacing');
    expect(result.current.theme).toHaveProperty('shadows');
  });

  it('light mode returns lightColors and isDark false', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme.colors).toBe(lightColors);
    expect(result.current.isDark).toBe(false);
  });

  it('dark mode returns darkColors and isDark true', () => {
    useThemeStore.setState({ currentTheme: 'dark' });
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme.colors).toBe(darkColors);
    expect(result.current.isDark).toBe(true);
  });

  it('selectedTheme reflects store value', () => {
    useThemeStore.setState({ selectedTheme: AppTheme.DARK });
    const { result } = renderHook(() => useTheme());
    expect(result.current.selectedTheme).toBe(AppTheme.DARK);
  });

  it('setTheme is a function', () => {
    const { result } = renderHook(() => useTheme());
    expect(typeof result.current.setTheme).toBe('function');
  });

  it('theme updates when currentTheme changes from light to dark', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme.colors).toBe(lightColors);
    expect(result.current.isDark).toBe(false);

    act(() => {
      useThemeStore.setState({ currentTheme: 'dark' });
    });

    expect(result.current.theme.colors).toBe(darkColors);
    expect(result.current.isDark).toBe(true);
  });

  it('returns same theme reference when currentTheme unchanged between rerenders', () => {
    const { result, rerender } = renderHook(() => useTheme());
    const firstTheme = result.current.theme;
    rerender({});
    expect(result.current.theme).toBe(firstTheme);
  });
});
