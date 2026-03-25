/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import ThemeSettingsScreen from './theme';

// --- Mocks ---

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockSetTheme = jest.fn();
const mockSetSettingsTheme = jest.fn();

jest.mock('@/theme', () => ({
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        surfaceBackground: '#fff',
        surfacePrimary: '#fff',
        surfaceBorderPrimary: '#ccc',
      },
    },
    selectedTheme: 'auto',
    setTheme: mockSetTheme,
  })),
}));

 
const { mockMakeLoc } = require('../../../test-utils/mockLocalization');

jest.mock('@/hooks', () => ({
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
}));

jest.mock('@/stores', () => ({
  useSetTheme: jest.fn(() => mockSetSettingsTheme),
}));

jest.mock('@/utils', () => ({
  delay: jest.fn(() => Promise.resolve()),
  logError: jest.fn(),
  FeatureFlag: { settings: 'settings' },
}));

jest.mock('@/components', () => {
   
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    Card: ({ children }: any) => <View testID="card">{children}</View>,
    Divider: () => <View testID="divider" />,
    ListItem: ({ title, onPress, iconTrailing }: any) => (
      <TouchableOpacity testID={`list-item-${title}`} onPress={onPress}>
        <Text>{String(title)}</Text>
        {iconTrailing}
      </TouchableOpacity>
    ),
    Radio: ({ value, groupValue, onValueChange }: any) => (
      <TouchableOpacity
        testID={`radio-${value}`}
        onPress={() => onValueChange?.(value)}
      >
        <Text testID={`radio-selected-${value}`}>
          {value === groupValue ? 'selected' : 'unselected'}
        </Text>
      </TouchableOpacity>
    ),
    TopAppBar: ({ title }: any) => (
      <View testID="top-app-bar">
        <Text>{String(title)}</Text>
      </View>
    ),
  };
});

describe('ThemeSettingsScreen', () => {
  it('renders TopAppBar with theme title', () => {
    const { getByTestId, getByText } = render(<ThemeSettingsScreen />);
    expect(getByTestId('top-app-bar')).toBeTruthy();
    expect(getByText('themeTitle')).toBeTruthy();
  });

  it('renders three theme options (Auto, Light, Dark)', () => {
    const { getByTestId } = render(<ThemeSettingsScreen />);
    expect(getByTestId('list-item-auto')).toBeTruthy();
    expect(getByTestId('list-item-light')).toBeTruthy();
    expect(getByTestId('list-item-dark')).toBeTruthy();
  });

  it('current theme radio is selected', () => {
    const { getByTestId } = render(<ThemeSettingsScreen />);
    // selectedTheme is 'auto', so the auto radio should be selected
    expect(getByTestId('radio-selected-auto')).toHaveTextContent('selected');
    expect(getByTestId('radio-selected-light')).toHaveTextContent('unselected');
    expect(getByTestId('radio-selected-dark')).toHaveTextContent('unselected');
  });

  it('selecting same theme navigates back without calling setTheme', () => {
    const { getByTestId } = render(<ThemeSettingsScreen />);
    fireEvent.press(getByTestId('list-item-auto'));
    expect(mockBack).toHaveBeenCalled();
    expect(mockSetTheme).not.toHaveBeenCalled();
    expect(mockSetSettingsTheme).not.toHaveBeenCalled();
  });

  it('selecting different theme calls setTheme and navigates back', async () => {
    mockSetTheme.mockResolvedValue(undefined);
    mockSetSettingsTheme.mockResolvedValue(undefined);

    const { getByTestId } = render(<ThemeSettingsScreen />);
    fireEvent.press(getByTestId('list-item-dark'));

    await waitFor(() => {
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
      expect(mockSetSettingsTheme).toHaveBeenCalledWith('dark');
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it('selecting light theme calls setTheme with light', async () => {
    mockSetTheme.mockResolvedValue(undefined);
    mockSetSettingsTheme.mockResolvedValue(undefined);

    const { getByTestId } = render(<ThemeSettingsScreen />);
    fireEvent.press(getByTestId('list-item-light'));

    await waitFor(() => {
      expect(mockSetTheme).toHaveBeenCalledWith('light');
      expect(mockSetSettingsTheme).toHaveBeenCalledWith('light');
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it('handles error when setTheme fails', async () => {
    const { logError } = require('@/utils');
    mockSetTheme.mockRejectedValue(new Error('theme error'));

    const { getByTestId } = render(<ThemeSettingsScreen />);
    fireEvent.press(getByTestId('list-item-dark'));

    await waitFor(() => {
      expect(logError).toHaveBeenCalled();
    });
  });

  it('does not call handleSelect when isSaving is true', async () => {
    // Simulate a slow save to keep isSaving=true
    mockSetTheme.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000)),
    );
    mockSetSettingsTheme.mockResolvedValue(undefined);

    const { getByTestId } = render(<ThemeSettingsScreen />);

    // First press starts saving
    fireEvent.press(getByTestId('list-item-dark'));

    // Second press while saving should be ignored
    fireEvent.press(getByTestId('list-item-light'));

    await waitFor(() => {
      expect(mockSetTheme).toHaveBeenCalledTimes(1);
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });
  });

  it('shows pending theme as selected in radio while saving', async () => {
    let resolveSetTheme: () => void;
    mockSetTheme.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSetTheme = resolve;
        }),
    );
    mockSetSettingsTheme.mockResolvedValue(undefined);

    const { getByTestId } = render(<ThemeSettingsScreen />);

    fireEvent.press(getByTestId('list-item-dark'));

    // While saving, dark should appear selected (pendingTheme)
    await waitFor(() => {
      expect(getByTestId('radio-selected-dark')).toHaveTextContent('selected');
    });

    // Resolve to clean up
    resolveSetTheme!();
    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it('Radio onValueChange triggers handleSelect for dark theme', async () => {
    mockSetTheme.mockResolvedValue(undefined);
    mockSetSettingsTheme.mockResolvedValue(undefined);

    const { getByTestId } = render(<ThemeSettingsScreen />);
    fireEvent.press(getByTestId('radio-dark'));

    await waitFor(() => {
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });
  });

  it('Radio onValueChange triggers handleSelect for light theme', async () => {
    mockSetTheme.mockResolvedValue(undefined);
    mockSetSettingsTheme.mockResolvedValue(undefined);

    const { getByTestId } = render(<ThemeSettingsScreen />);
    fireEvent.press(getByTestId('radio-light'));

    await waitFor(() => {
      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });
  });

  it('Radio onValueChange triggers handleSelect for auto theme', () => {
    const { getByTestId } = render(<ThemeSettingsScreen />);
    fireEvent.press(getByTestId('radio-auto'));
    // Auto is the current theme, so it should just navigate back
    expect(mockBack).toHaveBeenCalled();
  });
});
