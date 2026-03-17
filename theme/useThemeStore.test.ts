import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

import { AppTheme } from '@/models';

import { useThemeStore } from './useThemeStore';

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({
      selectedTheme: AppTheme.AUTO,
      currentTheme: 'light',
    });
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
    jest
      .spyOn(Appearance, 'addChangeListener')
      .mockReturnValue({ remove: jest.fn() });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('has correct initial state', () => {
    const state = useThemeStore.getState();
    expect(state.selectedTheme).toBe(AppTheme.AUTO);
    expect(state.currentTheme).toBe('light');
  });

  it('setTheme(LIGHT) updates selectedTheme and currentTheme', async () => {
    await useThemeStore.getState().setTheme(AppTheme.LIGHT);
    const state = useThemeStore.getState();
    expect(state.selectedTheme).toBe(AppTheme.LIGHT);
    expect(state.currentTheme).toBe('light');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'selectedTheme',
      AppTheme.LIGHT,
    );
  });

  it('setTheme(DARK) updates selectedTheme and currentTheme', async () => {
    await useThemeStore.getState().setTheme(AppTheme.DARK);
    const state = useThemeStore.getState();
    expect(state.selectedTheme).toBe(AppTheme.DARK);
    expect(state.currentTheme).toBe('dark');
  });

  it('setTheme(AUTO) resolves to system light preference', async () => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
    await useThemeStore.getState().setTheme(AppTheme.AUTO);
    expect(useThemeStore.getState().currentTheme).toBe('light');
  });

  it('setTheme(AUTO) resolves to system dark preference', async () => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark');
    await useThemeStore.getState().setTheme(AppTheme.AUTO);
    expect(useThemeStore.getState().currentTheme).toBe('dark');
  });

  it('initTheme loads persisted theme from AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(AppTheme.DARK);
    await useThemeStore.getState().initTheme();
    const state = useThemeStore.getState();
    expect(state.selectedTheme).toBe(AppTheme.DARK);
    expect(state.currentTheme).toBe('dark');
  });

  it('initTheme falls back to AUTO when storage is empty', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await useThemeStore.getState().initTheme();
    expect(useThemeStore.getState().selectedTheme).toBe(AppTheme.AUTO);
  });

  it('initTheme falls back to AUTO when storage has invalid value', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('invalid-theme');
    await useThemeStore.getState().initTheme();
    expect(useThemeStore.getState().selectedTheme).toBe(AppTheme.AUTO);
  });

  it('initTheme sets up Appearance change listener', async () => {
    await useThemeStore.getState().initTheme();
    expect(Appearance.addChangeListener).toHaveBeenCalled();
  });

  it('Appearance listener updates currentTheme in AUTO mode', async () => {
    await useThemeStore.getState().initTheme();
    const callback = (Appearance.addChangeListener as jest.Mock).mock
      .calls[0][0];

    callback({ colorScheme: 'dark' });
    expect(useThemeStore.getState().currentTheme).toBe('dark');

    callback({ colorScheme: 'light' });
    expect(useThemeStore.getState().currentTheme).toBe('light');
  });

  it('Appearance listener does NOT update when explicit theme is selected', async () => {
    await useThemeStore.getState().initTheme();
    const callback = (Appearance.addChangeListener as jest.Mock).mock
      .calls[0][0];

    await useThemeStore.getState().setTheme(AppTheme.LIGHT);
    callback({ colorScheme: 'dark' });
    expect(useThemeStore.getState().currentTheme).toBe('light');

    await useThemeStore.getState().setTheme(AppTheme.DARK);
    callback({ colorScheme: 'light' });
    expect(useThemeStore.getState().currentTheme).toBe('dark');
  });

  it('setTheme gracefully handles AsyncStorage.setItem failure', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('storage error'),
    );
    await expect(
      useThemeStore.getState().setTheme(AppTheme.DARK),
    ).resolves.toBeUndefined();
  });

  it('initTheme gracefully handles AsyncStorage.getItem failure', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error('storage error'),
    );
    await expect(useThemeStore.getState().initTheme()).resolves.toBeUndefined();
  });
});
