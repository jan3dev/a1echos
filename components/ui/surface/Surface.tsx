import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { Platform, Pressable, View, ViewStyle } from 'react-native';

import { shadows, useTheme } from '@/theme';

export interface SurfaceProps {
  children?: ReactNode;
  style?: ViewStyle;
  variant?: 'filled' | 'glass';
  elevation?: number;
  borderRadius?: number;
  padding?: number;
  margin?: number;
  color?: string;
  onPress?: () => void;
  width?: number | string;
  height?: number | string;
}

export const Surface = ({
  children,
  style,
  variant = 'filled',
  elevation = 0,
  borderRadius = 4,
  padding,
  margin,
  color,
  onPress,
  width,
  height,
}: SurfaceProps) => {
  const { theme } = useTheme();

  const getShadowStyle = (elev: number): ViewStyle => {
    if (elev === 0) return {};
    if (elev <= 2) return shadows.small;
    if (elev <= 4) return shadows.medium;
    return shadows.large;
  };

  const backgroundColor =
    color ?? (variant === 'glass' ? undefined : theme.colors.surfacePrimary);
  const shadowStyle = getShadowStyle(elevation);

  const shadowContainerStyle: ViewStyle = {
    borderRadius,
    margin,
    width: width as any,
    height: height as any,
    backgroundColor:
      Platform.OS === 'android' ? backgroundColor : 'transparent',
    ...shadowStyle,
  };

  const clipContainerStyle: ViewStyle = {
    flex: 1,
    borderRadius,
    overflow: 'hidden',
  };

  const contentStyle: ViewStyle = {
    padding,
    backgroundColor: variant === 'filled' ? backgroundColor : undefined,
    flex: 1,
  };

  const Content = <View style={[contentStyle]}>{children}</View>;

  const GlassContent = (
    <BlurView
      experimentalBlurMethod="dimezisBlurView"
      intensity={20}
      style={[
        {
          flex: 1,
          padding,
          backgroundColor: color ?? theme.colors.glassSurface,
        },
      ]}
    >
      {children}
    </BlurView>
  );

  const Inner = variant === 'glass' ? GlassContent : Content;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          shadowContainerStyle,
          style,
          { opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <View style={clipContainerStyle}>{Inner}</View>
      </Pressable>
    );
  }

  return (
    <View style={[shadowContainerStyle, style]}>
      <View style={clipContainerStyle}>{Inner}</View>
    </View>
  );
};
