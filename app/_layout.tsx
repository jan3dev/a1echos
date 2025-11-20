import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

const StorybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true';

export const unstable_settings = {
  initialRouteName: StorybookEnabled ? '(storybook)/index' : '(pages)/index',
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope: require('../assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium': require('../assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('../assets/fonts/Manrope-SemiBold.ttf'),
    PublicSans: require('../assets/fonts/PublicSans-Regular.ttf'),
    'PublicSans-Medium': require('../assets/fonts/PublicSans-Medium.ttf'),
    'PublicSans-SemiBold': require('../assets/fonts/PublicSans-SemiBold.ttf'),
  });

  if (fontError) {
    console.error('Error loading fonts:', fontError);
  }

  if (!fontsLoaded && !fontError) {
    return null; // or a splash screen/loader
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={StorybookEnabled}>
        <Stack.Screen name="(storybook)/index" />
      </Stack.Protected>

      <Stack.Screen name="(pages)/index" />
    </Stack>
  );
}
