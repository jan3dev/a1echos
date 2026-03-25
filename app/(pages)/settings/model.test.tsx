/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import ModelSettingsScreen from './model';

// --- Mocks ---

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockSetModelType = jest.fn();

jest.mock('@/theme', () => ({
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        surfaceBackground: '#fff',
        surfacePrimary: '#fff',
        surfaceBorderPrimary: '#ccc',
        textPrimary: '#000',
        textSecondary: '#666',
      },
    },
  })),
}));

 
const { mockMakeLoc } = require('../../../test-utils/mockLocalization');

jest.mock('@/hooks', () => ({
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
}));

jest.mock('@/stores', () => ({
  useSelectedModelType: jest.fn(() => 'whisper_file'),
  useSetModelType: jest.fn(() => mockSetModelType),
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
    Text: ({ children }: any) => <Text>{String(children)}</Text>,
    TopAppBar: ({ title }: any) => (
      <View testID="top-app-bar">
        <Text>{String(title)}</Text>
      </View>
    ),
  };
});

describe('ModelSettingsScreen', () => {
  it('renders TopAppBar with model title', () => {
    const { getByTestId, getByText } = render(<ModelSettingsScreen />);
    expect(getByTestId('top-app-bar')).toBeTruthy();
    expect(getByText('modelTitle')).toBeTruthy();
  });

  it('renders two model options (File, Realtime)', () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    expect(getByTestId('list-item-whisperModelFileTitle')).toBeTruthy();
    expect(getByTestId('list-item-whisperModelRealtimeTitle')).toBeTruthy();
  });

  it('current model radio is selected', () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    expect(getByTestId('radio-selected-whisper_file')).toHaveTextContent(
      'selected',
    );
    expect(getByTestId('radio-selected-whisper_realtime')).toHaveTextContent(
      'unselected',
    );
  });

  it('selecting same model navigates back without calling setModelType', () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId('list-item-whisperModelFileTitle'));
    expect(mockBack).toHaveBeenCalled();
    expect(mockSetModelType).not.toHaveBeenCalled();
  });

  it('selecting different model calls setModelType and navigates back', async () => {
    mockSetModelType.mockResolvedValue(undefined);

    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId('list-item-whisperModelRealtimeTitle'));

    await waitFor(() => {
      expect(mockSetModelType).toHaveBeenCalledWith('whisper_realtime');
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it('handles error when setModelType fails', async () => {
    const { logError } = require('@/utils');
    mockSetModelType.mockRejectedValue(new Error('model error'));

    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId('list-item-whisperModelRealtimeTitle'));

    await waitFor(() => {
      expect(logError).toHaveBeenCalled();
    });
  });

  it('selecting realtime model when file is selected changes radio selection', async () => {
    let resolveSetModelType: () => void;
    mockSetModelType.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSetModelType = resolve;
        }),
    );

    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId('list-item-whisperModelRealtimeTitle'));

    // While saving, realtime should appear selected (pendingModelType)
    await waitFor(() => {
      expect(getByTestId('radio-selected-whisper_realtime')).toHaveTextContent(
        'selected',
      );
    });

    resolveSetModelType!();
    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it('does not call handleSelect when isSaving is true', async () => {
    mockSetModelType.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000)),
    );

    const { getByTestId } = render(<ModelSettingsScreen />);

    // First press starts saving
    fireEvent.press(getByTestId('list-item-whisperModelRealtimeTitle'));

    // Second press while saving should be ignored (onPress is undefined when isSaving)
    fireEvent.press(getByTestId('list-item-whisperModelFileTitle'));

    await waitFor(() => {
      expect(mockSetModelType).toHaveBeenCalledTimes(1);
      expect(mockSetModelType).toHaveBeenCalledWith('whisper_realtime');
    });
  });

  it('Radio onValueChange triggers handleSelect for realtime model', async () => {
    mockSetModelType.mockResolvedValue(undefined);

    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId('radio-whisper_realtime'));

    await waitFor(() => {
      expect(mockSetModelType).toHaveBeenCalledWith('whisper_realtime');
    });
  });

  it('Radio onValueChange triggers handleSelect for file model (same as current)', () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId('radio-whisper_file'));
    // File is the current model, so it should just navigate back
    expect(mockBack).toHaveBeenCalled();
  });
});
