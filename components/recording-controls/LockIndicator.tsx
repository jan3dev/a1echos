import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { AquaPrimitiveColors } from '../../theme/colors';
import { AquaColors } from '../../theme/themeColors';
import { useThemeStore } from '../../theme/useThemeStore';
import { Icon } from '../icon';

interface LockIndicatorProps {
  progress: SharedValue<number>;
  colors: AquaColors;
  width?: number;
  height?: number;
  showSettingsIcon?: boolean;
}

export const LockIndicator = ({
  progress,
  colors,
  width = 32.0,
  height = 72.0,
  showSettingsIcon = false,
}: LockIndicatorProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    const slideIn = (1 - progress.value) * 16.0;
    return {
      transform: [{ translateY: slideIn }],
      opacity: progress.value,
    };
  });

  const { currentTheme } = useThemeStore();
  const blurTint = currentTheme === 'dark' ? 'light' : 'dark';

  return (
    <Animated.View style={[styles.container, { width, height }, animatedStyle]}>
      <View
        style={[
          styles.background,
          {
            width,
            height,
            borderRadius: width / 2,
            backgroundColor: colors.surfacePrimary,
          },
        ]}
      >
        <BlurView
          intensity={80}
          tint={blurTint}
          style={[
            StyleSheet.absoluteFill,
            styles.blurContainer,
            { borderRadius: width / 2 },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              showSettingsIcon
                ? { paddingHorizontal: 8, paddingVertical: 8 }
                : { paddingHorizontal: 4, paddingVertical: 8 },
            ]}
          >
            {showSettingsIcon && (
              <>
                <Icon name="settings" size={24} color={colors.textPrimary} />
                <View style={styles.iconSpacer} />
              </>
            )}
            <Icon name="lock" size={24} color={colors.textPrimary} />
            <View style={styles.iconSpacer} />
            <Icon name="chevron_up" size={24} color={colors.textTertiary} />
          </View>
        </BlurView>
      </View>
    </Animated.View>
  );
};

export const LockIndicatorWithSettings = (
  props: Omit<LockIndicatorProps, 'showSettingsIcon' | 'width' | 'height'>
) => (
  <LockIndicator
    {...props}
    showSettingsIcon={true}
    width={40.0}
    height={104.0}
  />
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  background: {
    shadowColor: AquaPrimitiveColors.shadow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  blurContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconSpacer: {
    height: 8,
  },
});
