import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ErrorView } from './ErrorView';

export default {
  title: 'Shared Components/ErrorView',
  component: ErrorView,
};

export const Default = () => (
  <View style={styles.container}>
    <ErrorView errorMessage="Something went wrong" />
  </View>
);

export const WithRetry = () => (
  <View style={styles.container}>
    <ErrorView
      errorMessage="Failed to load data"
      onRetry={() => console.log('Retry pressed')}
    />
  </View>
);

export const LongErrorMessage = () => (
  <View style={styles.container}>
    <ErrorView
      errorMessage="The transcription service is currently unavailable. Please check your internet connection and try again."
      onRetry={() => console.log('Retry pressed')}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
