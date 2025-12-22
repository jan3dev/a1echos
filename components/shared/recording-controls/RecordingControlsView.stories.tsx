import type { Meta, StoryObj } from '@storybook/react-native';
import { ComponentProps, ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';

import { RecordingControlsView } from '@/components';
import { TranscriptionState } from '@/models';
import { useTranscriptionStore } from '@/stores';
import { useTheme } from '@/theme';

const StoryContainer = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: theme.colors.surfaceBackground,
      }}
    >
      {children}
    </View>
  );
};

const RecordingControlsViewMeta: Meta<typeof RecordingControlsView> = {
  title: 'Shared Components/RecordingControlsView',
  component: RecordingControlsView,
  argTypes: {
    state: {
      control: 'select',
      options: [
        TranscriptionState.READY,
        TranscriptionState.RECORDING,
        TranscriptionState.TRANSCRIBING,
        TranscriptionState.LOADING,
      ],
    },
    enabled: {
      control: 'boolean',
    },
  },
  decorators: [
    (Story) => (
      <StoryContainer>
        <Story />
      </StoryContainer>
    ),
  ],
};

export default RecordingControlsViewMeta;

type Story = StoryObj<typeof RecordingControlsView>;

const DynamicRecordingControlsView = (
  props: Omit<ComponentProps<typeof RecordingControlsView>, 'colors'>
) => {
  const { theme } = useTheme();
  return <RecordingControlsView {...props} colors={theme.colors} />;
};

export const Ready: Story = {
  render: () => (
    <DynamicRecordingControlsView
      state={TranscriptionState.READY}
      enabled={true}
      onRecordingStart={() => console.log('Recording started')}
    />
  ),
};

export const Recording: Story = {
  render: () => (
    <DynamicRecordingControlsView
      state={TranscriptionState.RECORDING}
      enabled={true}
      onRecordingStop={() => console.log('Recording stopped')}
    />
  ),
};

export const RecordingLowAudio: Story = {
  render: () => (
    <DynamicRecordingControlsView
      state={TranscriptionState.RECORDING}
      enabled={true}
    />
  ),
};

export const RecordingHighAudio: Story = {
  render: () => (
    <DynamicRecordingControlsView
      state={TranscriptionState.RECORDING}
      enabled={true}
    />
  ),
};

export const Transcribing: Story = {
  render: () => (
    <DynamicRecordingControlsView
      state={TranscriptionState.TRANSCRIBING}
      enabled={false}
    />
  ),
};

export const Interactive = () => {
  const [state, setState] = useState(TranscriptionState.READY);
  const { theme } = useTheme();
  const updateAudioLevel = useTranscriptionStore((s) => s.updateAudioLevel);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (state === TranscriptionState.RECORDING) {
      interval = setInterval(() => {
        updateAudioLevel(Math.random());
      }, 100);
    } else {
      updateAudioLevel(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state, updateAudioLevel]);

  const handleStart = () => {
    setState(TranscriptionState.RECORDING);
    setTimeout(() => {
      setState(TranscriptionState.TRANSCRIBING);
      setTimeout(() => {
        setState(TranscriptionState.READY);
      }, 2000);
    }, 5000);
  };

  return (
    <StoryContainer>
      <RecordingControlsView
        state={state}
        enabled={
          state === TranscriptionState.READY ||
          state === TranscriptionState.RECORDING
        }
        colors={theme.colors}
        onRecordingStart={handleStart}
        onRecordingStop={() => {}}
      />
    </StoryContainer>
  );
};
