import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLocalization } from '@/hooks';
import { useTheme } from '@/theme';

import { Divider } from '../../ui/divider/Divider';
import { Icon } from '../../ui/icon/Icon';
import { Text } from '../../ui/text/Text';
import { Tooltip } from '../../ui/tooltip/Tooltip';
import { useTooltip } from '../../ui/tooltip/useTooltip';

interface SocialTag {
  tag: string;
  handle: string;
}

const SOCIAL_TAGS: SocialTag[] = [
  { tag: 'Echos', handle: 'a1echos' },
  { tag: 'A1 Lab', handle: 'a1laboratory' },
  { tag: 'JAN3', handle: 'jan3com' },
];

export const SettingsFooter = () => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { show: showTooltip, tooltipState } = useTooltip();
  const [version, setVersion] = useState('');

  useEffect(() => {
    const appVersion = Constants.expoConfig?.version ?? '1.0.0';
    const buildNumber =
      Constants.expoConfig?.ios?.buildNumber ??
      Constants.expoConfig?.android?.versionCode?.toString() ??
      '1';
    setVersion(`App Version ${appVersion} (${buildNumber})`);
  }, []);

  const handleLaunchX = async (handle: string) => {
    const sanitizedHandle = handle.replace(/^@/, '');
    const url = `https://x.com/${sanitizedHandle}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        showTooltip({
          message: loc.couldNotOpenLink,
          variant: 'error',
        });
      }
    } catch {
      showTooltip({
        message: loc.couldNotOpenLink,
        variant: 'error',
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Footer Logo */}
      <View style={styles.logoContainer}>
        <Icon
          name="footer_logo"
          size={108}
          style={{ width: 108, height: 24 }}
          color={theme.colors.textPrimary}
        />
      </View>

      {/* First Divider */}
      <View style={styles.dividerContainer}>
        <Divider color={theme.colors.surfaceBorderSecondary} />
      </View>

      {/* Follow Us Text */}
      <Text
        variant="body2"
        weight="medium"
        color={theme.colors.textTertiary}
        align="center"
      >
        {loc.followUsOnX}
      </Text>

      {/* Social Links */}
      <View style={styles.socialContainer}>
        {SOCIAL_TAGS.map((tagData) => (
          <Pressable
            key={tagData.handle}
            onPress={() => handleLaunchX(tagData.handle)}
            style={({ pressed }) => [
              styles.socialLink,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityLabel={`Open ${tagData.tag} on X`}
            accessibilityRole="link"
          >
            <Text
              variant="body2"
              weight="medium"
              color={theme.colors.textPrimary}
            >
              {tagData.tag}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Second Divider */}
      <View style={styles.dividerContainer}>
        <Divider color={theme.colors.surfaceBorderSecondary} />
      </View>

      {/* App Version */}
      <Text
        variant="caption1"
        weight="regular"
        color={theme.colors.textTertiary}
        align="center"
      >
        {version}
      </Text>

      {/* Tooltip for errors */}
      <Tooltip {...tooltipState} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerContainer: {
    width: '100%',
    marginBottom: 16,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  socialLink: {
    paddingHorizontal: 12,
  },
});
