import { Text, View } from 'react-native';

const StorybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true';

let StorybookUI: React.ComponentType | null = null;

if (StorybookEnabled) {
  // Only import storybook when enabled to avoid loading it unnecessarily
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    StorybookUI = require('@/.rnstorybook').default;
  } catch (error) {
    console.error('Failed to load Storybook:', error);
    // StorybookUI remains null, fallback UI will be shown
  }
}

export default function StorybookScreen() {
  if (!StorybookEnabled || !StorybookUI) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Storybook is disabled</Text>
      </View>
    );
  }

  return <StorybookUI />;
}
