import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { Pressable, View, ViewStyle } from 'react-native';

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
    // Map elevation to nearest shadow preset or custom
    // Simple mapping for now
    if (elev <= 2) return shadows.small;
    if (elev <= 4) return shadows.medium;
    return shadows.large;
  };

  const backgroundColor =
    color ?? (variant === 'glass' ? undefined : theme.colors.surfacePrimary);
  const shadowStyle = getShadowStyle(elevation);

  const containerStyle: ViewStyle = {
    borderRadius,
    margin,
    width: width as any,
    height: height as any,
    overflow: borderRadius > 0 ? 'hidden' : undefined,
    ...shadowStyle,
  };

  // For glass, we use BlurView
  // For filled, just backgroundColor

  const contentStyle: ViewStyle = {
    padding,
    backgroundColor: variant === 'filled' ? backgroundColor : undefined,
    borderRadius: variant === 'filled' ? borderRadius : 0, // Inner radius if needed
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
          containerStyle,
          style,
          { opacity: pressed ? 0.8 : 1 },
        ]}
      >
        {Inner}
      </Pressable>
    );
  }

  return <View style={[containerStyle, style]}>{Inner}</View>;
};
