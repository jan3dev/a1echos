import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { View } from 'react-native';
import { TranscriptionState } from '../../models/TranscriptionState';
import { darkColors, lightColors } from '../../theme/themeColors';
import { RecordingButton } from './RecordingButton';

const RecordingButtonMeta: Meta<typeof RecordingButton> = {
  title: 'Recording Controls/RecordingButton',
  component: RecordingButton,
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
    size: {
      control: { type: 'range', min: 48, max: 120, step: 4 },
    },
  },
  decorators: [
    (Story) => (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F4F5F6',
        }}
      >
        <Story />
      </View>
    ),
  ],
};

export default RecordingButtonMeta;

type Story = StoryObj<typeof RecordingButton>;

export const Ready: Story = {
  args: {
    state: TranscriptionState.READY,
    enabled: true,
    colors: lightColors,
    onRecordingStart: () => console.log('Recording started'),
  },
};

export const Recording: Story = {
  args: {
    state: TranscriptionState.RECORDING,
    enabled: true,
    colors: lightColors,
    onRecordingStop: () => console.log('Recording stopped'),
  },
};

export const Transcribing: Story = {
  args: {
    state: TranscriptionState.TRANSCRIBING,
    enabled: false,
    colors: lightColors,
  },
};

export const Loading: Story = {
  args: {
    state: TranscriptionState.LOADING,
    enabled: false,
    colors: lightColors,
  },
};

export const DarkThemeReady: Story = {
  args: {
    state: TranscriptionState.READY,
    enabled: true,
    colors: darkColors,
  },
  decorators: [
    (Story) => (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#090A0B',
        }}
      >
        <Story />
      </View>
    ),
  ],
};

export const LargeSize: Story = {
  args: {
    state: TranscriptionState.READY,
    enabled: true,
    size: 96,
    colors: lightColors,
  },
};

export const SmallSize: Story = {
  args: {
    state: TranscriptionState.READY,
    enabled: true,
    size: 48,
    colors: lightColors,
  },
};
