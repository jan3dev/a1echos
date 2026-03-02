import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { getShadow, ShadowKey, useTheme } from '@/theme';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  shadow?: ShadowKey;
  borderRadius?: number;
  backgroundColor?: string;
}

export const Card = ({
  children,
  style,
  shadow = 'card',
  borderRadius = 8,
  backgroundColor,
}: CardProps) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        getShadow(shadow),
        {
          borderRadius,
          backgroundColor: backgroundColor ?? theme.colors.surfacePrimary,
        },
        style,
      ]}
    >
      <View style={[styles.clipContainer, { borderRadius }]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  clipContainer: {
    overflow: 'hidden',
  },
});
