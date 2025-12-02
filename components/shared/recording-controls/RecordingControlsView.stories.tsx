import type { Meta, StoryObj } from '@storybook/react-native';
import React, { useState } from 'react';
import { View } from 'react-native';
import { TranscriptionState } from '../../../models/TranscriptionState';
import { useTheme } from '../../../theme/useTheme';
import { RecordingControlsView } from './RecordingControlsView';

const StoryContainer = ({ children }: { children: React.ReactNode }) => {
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
    audioLevel: {
      control: { type: 'range', min: 0, max: 1, step: 0.1 },
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
  props: Omit<React.ComponentProps<typeof RecordingControlsView>, 'colors'>
) => {
  const { theme } = useTheme();
  return <RecordingControlsView {...props} colors={theme.colors} />;
};

export const Ready: Story = {
  render: () => (
    <DynamicRecordingControlsView
      state={TranscriptionState.READY}
      audioLevel={0}
      enabled={true}
      onRecordingStart={() => console.log('Recording started')}
    />
  ),
};

export const Recording: Story = {
  render: () => (
    <DynamicRecordingControlsView
      state={TranscriptionState.RECORDING}
      audioLevel={0.5}
      enabled={true}
      onRecordingStop={() => console.log('Recording stopped')}
    />
  ),
};

export const RecordingLowAudio: Story = {
  render: () => (
    <DynamicRecordingControlsView
      state={TranscriptionState.RECORDING}
      audioLevel={0.2}
      enabled={true}
    />
  ),
};

export const RecordingHighAudio: Story = {
  render: () => (
    <DynamicRecordingControlsView
      state={TranscriptionState.RECORDING}
      audioLevel={0.9}
      enabled={true}
    />
  ),
};

export const Transcribing: Story = {
  render: () => (
    <DynamicRecordingControlsView
      state={TranscriptionState.TRANSCRIBING}
      audioLevel={0}
      enabled={false}
    />
  ),
};

export const Interactive = () => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [state, setState] = useState(TranscriptionState.READY);
  const { theme } = useTheme();

  const handleStart = () => {
    setState(TranscriptionState.RECORDING);
    let level = 0;
    const interval = setInterval(() => {
      level = Math.random();
      setAudioLevel(level);
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      setState(TranscriptionState.TRANSCRIBING);
      setAudioLevel(0);
      setTimeout(() => {
        setState(TranscriptionState.READY);
      }, 2000);
    }, 5000);
  };

  return (
    <StoryContainer>
      <RecordingControlsView
        state={state}
        audioLevel={audioLevel}
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
