import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '../../../theme/useTheme';

export interface DividerProps extends ViewProps {
  height?: number;
  color?: string;
}

export const Divider = ({
  height = 1,
  color,
  style,
  ...props
}: DividerProps) => {
  const { theme } = useTheme();

  return (
    <View
      accessible={false}
      style={[
        {
          height,
          backgroundColor: color ?? theme.colors.surfaceBorderPrimary,
          width: '100%',
        },
        style,
      ]}
      {...props}
    />
  );
};
