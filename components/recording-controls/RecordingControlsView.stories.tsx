import type { Meta, StoryObj } from '@storybook/react-native';
import React, { useState } from 'react';
import { View } from 'react-native';
import { TranscriptionState } from '../../models/TranscriptionState';
import { darkColors, lightColors } from '../../theme/themeColors';
import { RecordingControlsView } from './RecordingControlsView';

const RecordingControlsViewMeta: Meta<typeof RecordingControlsView> = {
  title: 'Recording Controls/RecordingControlsView',
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
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: '#F4F5F6',
        }}
      >
        <Story />
      </View>
    ),
  ],
};

export default RecordingControlsViewMeta;

type Story = StoryObj<typeof RecordingControlsView>;

export const Ready: Story = {
  args: {
    state: TranscriptionState.READY,
    audioLevel: 0,
    enabled: true,
    colors: lightColors,
    onRecordingStart: () => console.log('Recording started'),
  },
};

export const Recording: Story = {
  args: {
    state: TranscriptionState.RECORDING,
    audioLevel: 0.5,
    enabled: true,
    colors: lightColors,
    onRecordingStop: () => console.log('Recording stopped'),
  },
};

export const RecordingLowAudio: Story = {
  args: {
    state: TranscriptionState.RECORDING,
    audioLevel: 0.2,
    enabled: true,
    colors: lightColors,
  },
};

export const RecordingHighAudio: Story = {
  args: {
    state: TranscriptionState.RECORDING,
    audioLevel: 0.9,
    enabled: true,
    colors: lightColors,
  },
};

export const Transcribing: Story = {
  args: {
    state: TranscriptionState.TRANSCRIBING,
    audioLevel: 0,
    enabled: false,
    colors: lightColors,
  },
};

export const DarkTheme: Story = {
  args: {
    state: TranscriptionState.READY,
    audioLevel: 0,
    enabled: true,
    colors: darkColors,
  },
  decorators: [
    (Story) => (
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: '#090A0B',
        }}
      >
        <Story />
      </View>
    ),
  ],
};

export const Interactive = () => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [state, setState] = useState(TranscriptionState.READY);

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
    <View
      style={{
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: '#F4F5F6',
      }}
    >
      <RecordingControlsView
        state={state}
        audioLevel={audioLevel}
        enabled={state === TranscriptionState.READY || state === TranscriptionState.RECORDING}
        colors={lightColors}
        onRecordingStart={handleStart}
        onRecordingStop={() => {}}
      />
    </View>
  );
};

