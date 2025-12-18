import * as Linking from 'expo-linking';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { getShadow, useTheme } from '@/theme';
import { FeatureFlag, logWarn } from '@/utils';

const AQUA_APP_URLS = {
  android:
    'https://play.google.com/store/apps/details?id=io.aquawallet.android',
  ios: 'https://apps.apple.com/us/app/aqua-wallet/id6468594241',
};

// Banner image aspect ratio (width / height)
const BANNER_ASPECT_RATIO = 1029 / 633;
const MAX_BANNER_WIDTH = 633;

export const InAppBanner = () => {
  const { width: screenWidth } = useWindowDimensions();
  const { theme } = useTheme();

  const handlePress = async () => {
    try {
      const url =
        Platform.OS === 'android' ? AQUA_APP_URLS.android : AQUA_APP_URLS.ios;

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback: try to open anyway
        await Linking.openURL(url);
      }
    } catch (error) {
      logWarn(`Error launching AQUA app URL: ${error}`, {
        flag: FeatureFlag.ui,
      });
    }
  };

  // Constrain banner width on larger screens
  const bannerWidth = Math.min(screenWidth - 32, MAX_BANNER_WIDTH);
  const bannerHeight = bannerWidth / BANNER_ASPECT_RATIO;

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.container,
          getShadow('card'),
          {
            width: bannerWidth,
            height: bannerHeight,
            opacity: pressed ? 0.9 : 1,
            backgroundColor: theme.colors.surfacePrimary,
          },
        ]}
        accessibilityLabel="Download AQUA Wallet"
        accessibilityRole="link"
      >
        <View style={styles.imageContainer}>
          <Image
            source={require('@/assets/images/in-app-banner.png')}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
  },
  container: {
    borderRadius: 8,
  },
  imageContainer: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
