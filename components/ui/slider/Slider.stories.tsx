import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AquaTypography } from '../../../theme/typography';
import { Slider, SliderState } from './Slider';

const meta = {
  title: 'UI Components/Slider',
  component: Slider,
  decorators: [
    (Story) => (
      <View style={styles.container}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initial: Story = {
  args: {
    width: 300,
    text: 'Slide to confirm',
    onConfirm: () => Alert.alert('Confirmed!'),
    sliderState: 'initial',
  },
  render: () => (
    <Slider
      width={300}
      text="Slide to confirm"
      onConfirm={() => Alert.alert('Confirmed!')}
      sliderState="initial"
    />
  ),
};

export const InProgress: Story = {
  args: {
    width: 300,
    text: 'Loading...',
    onConfirm: () => {},
    sliderState: 'inProgress',
  },
  render: () => (
    <Slider
      width={300}
      text="Loading..."
      onConfirm={() => {}}
      sliderState="inProgress"
    />
  ),
};

export const Completed: Story = {
  args: {
    width: 300,
    text: 'Completed',
    onConfirm: () => {},
    sliderState: 'completed',
  },
  render: () => (
    <Slider
      width={300}
      text="Completed"
      onConfirm={() => {}}
      sliderState="completed"
    />
  ),
};

export const Error: Story = {
  args: {
    width: 300,
    text: 'Error occurred',
    onConfirm: () => {},
    sliderState: 'error',
  },
  render: () => (
    <Slider
      width={300}
      text="Error occurred"
      onConfirm={() => {}}
      sliderState="error"
    />
  ),
};

export const Disabled: Story = {
  args: {
    width: 300,
    text: 'Disabled slider',
    onConfirm: () => {},
    enabled: false,
    sliderState: 'initial',
  },
  render: () => (
    <Slider
      width={300}
      text="Disabled slider"
      onConfirm={() => {}}
      enabled={false}
      sliderState="initial"
    />
  ),
};

const SliderWithStateChange = () => {
  const [state, setState] = useState<SliderState>('initial');

  const handleConfirm = () => {
    setState('inProgress');
    setTimeout(() => {
      setState('completed');
      setTimeout(() => {
        setState('initial');
      }, 2000);
    }, 1500);
  };

  return (
    <View style={styles.column}>
      <Text style={styles.description}>
        Try sliding past 75% to see the state change
      </Text>
      <Slider
        width={300}
        text="Slide to confirm"
        onConfirm={handleConfirm}
        sliderState={state}
      />
    </View>
  );
};

export const WithStateChange: Story = {
  args: {
    width: 300,
    text: 'Slide to confirm',
    onConfirm: () => Alert.alert('Confirmed!'),
    sliderState: 'initial',
  },
  render: () => <SliderWithStateChange />,
};

export const AllStates: Story = {
  args: {
    width: 300,
    text: 'Slide to confirm',
    onConfirm: () => Alert.alert('Confirmed!'),
    sliderState: 'initial',
  },
  render: () => (
    <View style={styles.column}>
      <View style={styles.section}>
        <Text style={styles.heading}>Initial</Text>
        <Slider
          width={280}
          text="Slide to confirm"
          onConfirm={() => console.log('Confirmed')}
          sliderState="initial"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>In Progress</Text>
        <Slider
          width={280}
          text="Processing..."
          onConfirm={() => {}}
          sliderState="inProgress"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Completed</Text>
        <Slider
          width={280}
          text="Success!"
          onConfirm={() => {}}
          sliderState="completed"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Error</Text>
        <Slider
          width={280}
          text="Failed"
          onConfirm={() => {}}
          sliderState="error"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Disabled</Text>
        <Slider
          width={280}
          text="Disabled"
          onConfirm={() => {}}
          enabled={false}
          sliderState="initial"
        />
      </View>
    </View>
  ),
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#F4F5F6',
  },
  column: {
    gap: 24,
  },
  section: {
    gap: 12,
  },
  heading: {
    ...AquaTypography.h5SemiBold,
    color: '#090A0B',
  },
  description: {
    ...AquaTypography.body1,
    color: '#4C5357',
  },
});
