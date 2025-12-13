import type { Meta, StoryObj } from '@storybook/react';
import { ComponentType, ReactNode, useEffect } from 'react';
import { View } from 'react-native';

import {
  Toast,
  ToastVariant,
  TranscriptionItem,
  TranscriptionList,
} from '@/components';
import { ModelType, Transcription, TranscriptionState } from '@/models';
import {
  useSessionStore,
  useSettingsStore,
  useTranscriptionStore,
  useUIStore,
} from '@/stores';
import { useTheme } from '@/theme';

const dummyTranscriptions: Transcription[] = [
  {
    id: 't1',
    sessionId: 'session-1',
    text: 'First transcription item.',
    timestamp: new Date('2023-11-20T09:30:00'),
    audioPath: '',
  },
  {
    id: 't2',
    sessionId: 'session-1',
    text: 'Second transcription item with a bit more text to show variety. It can handle multiple lines of text properly when rendered.',
    timestamp: new Date('2023-11-20T09:30:30'),
    audioPath: '',
  },
  {
    id: 't3',
    sessionId: 'session-1',
    text: 'Third transcription item.',
    timestamp: new Date('2023-11-20T09:31:00'),
    audioPath: '',
  },
];

const livePreviewTranscription: Transcription = {
  id: 'live_preview',
  sessionId: 'session-1',
  text: 'This is a single live preview item...',
  timestamp: new Date(),
  audioPath: '',
};

const skeletonTranscription: Transcription = {
  id: 'loading_preview',
  sessionId: 'session-1',
  text: '',
  timestamp: new Date(),
  audioPath: '',
};

const ToastDecorator = (Story: ComponentType) => {
  const toasts = useUIStore((s) => s.toasts);
  const hideToast = useUIStore((s) => s.hideToast);

  return (
    <View style={{ flex: 1 }}>
      <Story />
      <View
        style={{
          position: 'absolute',
          top: 50,
          left: 0,
          right: 0,
          padding: 16,
        }}
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            visible={true}
            title={toast.message}
            message={toast.message}
            variant={toast.variant as ToastVariant}
            onDismiss={() => hideToast(toast.id)}
          />
        ))}
      </View>
    </View>
  );
};

const StoryContainer = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaceBackground }}>
      {children}
    </View>
  );
};

// Store Decorator with default state
const StoreDecorator = (Story: ComponentType) => {
  useEffect(() => {
    // Setup initial store state
    useSessionStore.setState({
      activeSessionId: 'session-1',
    });

    useTranscriptionStore.setState({
      transcriptions: dummyTranscriptions,
      state: TranscriptionState.READY,
    });

    useSettingsStore.setState({
      selectedModelType: ModelType.WHISPER_REALTIME,
    });
  }, []);

  return (
    <StoryContainer>
      <Story />
    </StoryContainer>
  );
};

const meta = {
  title: 'Domain Components/Transcription',
  component: TranscriptionList,
  decorators: [StoreDecorator, ToastDecorator],
} satisfies Meta<typeof TranscriptionList>;

export default meta;

type Story = StoryObj<typeof TranscriptionList>;

export const Default: Story = {
  args: {
    onTranscriptionTap: (id) => console.log('Tap', id),
    onTranscriptionLongPress: (id) => console.log('Long Press', id),
    selectionMode: false,
    selectedTranscriptionIds: new Set(),
  },
};

export const SelectionMode: Story = {
  args: {
    onTranscriptionTap: (id) => console.log('Tap', id),
    onTranscriptionLongPress: (id) => console.log('Long Press', id),
    selectionMode: true,
    selectedTranscriptionIds: new Set(['t1', 't3']),
  },
};

const LivePreviewSingleItemContent = () => {
  return (
    <View
      style={{
        padding: 16,
      }}
    >
      <TranscriptionItem
        transcription={livePreviewTranscription}
        isLivePreviewItem={true}
        onTap={() => console.log('Tap')}
        onLongPress={() => console.log('Long Press')}
      />
    </View>
  );
};

export const LivePreviewSingleItem: Story = {
  render: () => <LivePreviewSingleItemContent />,
};

const WithSkeletonLoadingContent = () => {
  return (
    <View
      style={{
        padding: 16,
      }}
    >
      <TranscriptionItem
        transcription={skeletonTranscription}
        isLoadingWhisperResult={true}
        onTap={() => console.log('Tap')}
        onLongPress={() => console.log('Long Press')}
      />
    </View>
  );
};

export const WithSkeletonLoading: Story = {
  render: () => <WithSkeletonLoadingContent />,
};
