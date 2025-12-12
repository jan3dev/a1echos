import type { Decorator } from '@storybook/react';
import { StyleSheet, View } from 'react-native';

import { ErrorView } from '@/components';
import { useTheme } from '@/theme';

const StoryContainer = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      {children}
    </View>
  );
};

export default {
  title: 'Shared Components/ErrorView',
  component: ErrorView,
  decorators: [
    ((Story) => (
      <StoryContainer>
        <Story />
      </StoryContainer>
    )) satisfies Decorator,
  ],
};

export const Default = () => <ErrorView errorMessage="Something went wrong" />;

export const WithRetry = () => (
  <ErrorView
    errorMessage="Failed to load data"
    onRetry={() => console.log('Retry pressed')}
  />
);

export const LongErrorMessage = () => (
  <ErrorView
    errorMessage="The transcription service is currently unavailable. Please check your internet connection and try again."
    onRetry={() => console.log('Retry pressed')}
  />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
