import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { View } from 'react-native';
import { TranscriptionState } from '../../../models/TranscriptionState';
import { useTheme } from '../../../theme/useTheme';
import { RecordingButton } from './RecordingButton';

const StoryContainer = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surfaceBackground,
      }}
    >
      {children}
    </View>
  );
};

const RecordingButtonMeta: Meta<typeof RecordingButton> = {
  title: 'Shared Components/RecordingButton',
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
      <StoryContainer>
        <Story />
      </StoryContainer>
    ),
  ],
};

export default RecordingButtonMeta;

type Story = StoryObj<typeof RecordingButton>;

const DynamicRecordingButton = (
  props: Omit<React.ComponentProps<typeof RecordingButton>, 'colors'>
) => {
  const { theme } = useTheme();
  return <RecordingButton {...props} colors={theme.colors} />;
};

export const Ready: Story = {
  render: () => (
    <DynamicRecordingButton
      state={TranscriptionState.READY}
      enabled={true}
      onRecordingStart={() => console.log('Recording started')}
    />
  ),
};

export const Recording: Story = {
  render: () => (
    <DynamicRecordingButton
      state={TranscriptionState.RECORDING}
      enabled={true}
      onRecordingStop={() => console.log('Recording stopped')}
    />
  ),
};

export const Transcribing: Story = {
  render: () => (
    <DynamicRecordingButton
      state={TranscriptionState.TRANSCRIBING}
      enabled={false}
    />
  ),
};

export const Loading: Story = {
  render: () => (
    <DynamicRecordingButton
      state={TranscriptionState.LOADING}
      enabled={false}
    />
  ),
};

export const LargeSize: Story = {
  render: () => (
    <DynamicRecordingButton
      state={TranscriptionState.READY}
      enabled={true}
      size={96}
    />
  ),
};

export const SmallSize: Story = {
  render: () => (
    <DynamicRecordingButton
      state={TranscriptionState.READY}
      enabled={true}
      size={48}
    />
  ),
};
