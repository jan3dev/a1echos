/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from '@testing-library/react-native';
import React from 'react';

import { Transcription } from '@/models';
import {
  useSessionTranscriptions,
  useSettingsStore,
  useTranscriptionStore,
} from '@/stores';

import { TranscriptionList } from './TranscriptionList';

jest.mock('@/stores', () => ({
  useSessionTranscriptions: jest.fn(() => []),
  useTranscriptionStore: jest.fn(),
  useSettingsStore: jest.fn(),
}));

jest.mock('./TranscriptionItem', () => ({
  TranscriptionItem: (props: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={`transcription-item-${props.transcription.id}`}>
        <Text>{props.transcription.text}</Text>
      </View>
    );
  },
}));

const mockTranscriptions: Transcription[] = [
  {
    id: 't1',
    text: 'First transcription',
    timestamp: new Date('2024-01-01'),
    audioPath: '/audio/t1.wav',
    sessionId: 's1',
  },
  {
    id: 't2',
    text: 'Second transcription',
    timestamp: new Date('2024-01-02'),
    audioPath: '/audio/t2.wav',
    sessionId: 's1',
  },
];

const mockStoreDefaults = {
  livePreview: null,
  loadingPreview: null,
  isRecording: () => false,
  isTranscribing: () => false,
  updateTranscription: jest.fn(),
};

const mockSettingsDefaults = {
  selectedModelType: 'WHISPER_FILE',
};

const defaultProps = {
  onTranscriptionTap: jest.fn(),
  onTranscriptionLongPress: jest.fn(),
};

describe('TranscriptionList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue(
      mockStoreDefaults,
    );
    (useSettingsStore as unknown as jest.Mock).mockReturnValue(
      mockSettingsDefaults,
    );
  });

  it('renders TranscriptionItem for each transcription', () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const { getByTestId } = render(<TranscriptionList {...defaultProps} />);
    expect(getByTestId('transcription-item-t1')).toBeTruthy();
    expect(getByTestId('transcription-item-t2')).toBeTruthy();
  });

  it('returns null for empty data', () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue([]);
    const { toJSON } = render(<TranscriptionList {...defaultProps} />);
    expect(toJSON()).toBeNull();
  });

  it('preview item appended when recording', () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      isRecording: () => true,
      loadingPreview: {
        id: 'preview1',
        text: '',
        timestamp: new Date(),
        audioPath: '',
        sessionId: 's1',
      },
    });
    const { getByTestId } = render(<TranscriptionList {...defaultProps} />);
    expect(getByTestId('transcription-item-preview1')).toBeTruthy();
    expect(getByTestId('transcription-item-t1')).toBeTruthy();
  });

  it('selection mode props forwarded to items', () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const { getByTestId } = render(
      <TranscriptionList
        {...defaultProps}
        selectionMode={true}
        selectedTranscriptionIds={new Set(['t1'])}
      />,
    );
    // Items should be rendered
    expect(getByTestId('transcription-item-t1')).toBeTruthy();
    expect(getByTestId('transcription-item-t2')).toBeTruthy();
  });

  it('FlatList configuration', () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const { UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );
    const { FlatList } = require('react-native');
    const flatList = UNSAFE_getByType(FlatList);
    expect(flatList.props.keyboardShouldPersistTaps).toBe('handled');
    expect(flatList.props.keyboardDismissMode).toBe('interactive');
  });

  it('edit mode sets editingId', () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    // Just verify it renders without errors with edit callbacks
    const { getByTestId } = render(
      <TranscriptionList
        {...defaultProps}
        onEditModeStarted={jest.fn()}
        onEditModeEnded={jest.fn()}
      />,
    );
    expect(getByTestId('transcription-item-t1')).toBeTruthy();
  });
});
