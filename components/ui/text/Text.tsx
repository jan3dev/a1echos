import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  TextStyle,
} from 'react-native';
import { TypographyKey, useTheme } from '../../../theme';

export type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'subtitle'
  | 'body1'
  | 'body2'
  | 'caption1'
  | 'caption2';

export type TextWeight = 'regular' | 'medium' | 'semibold';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  weight?: TextWeight;
  color?: string;
  align?: TextStyle['textAlign'];
  size?: number;
  height?: number;
}

export const Text = ({
  variant = 'body1',
  weight = 'regular',
  color,
  align,
  size,
  height,
  style,
  ...props
}: TextProps) => {
  const { theme } = useTheme();

  const getTypographyKey = (): TypographyKey => {
    let suffix = '';
    if (weight === 'medium') suffix = 'Medium';
    if (weight === 'semibold') suffix = 'SemiBold';

    return `${variant}${suffix}` as TypographyKey;
  };

  const typographyStyle = theme.typography[getTypographyKey()];

  const textStyles: TextStyle = {
    ...typographyStyle,
    color: color ?? theme.colors.textPrimary,
    textAlign: align,
  };

  if (size) textStyles.fontSize = size;
  if (height) textStyles.lineHeight = height;

  return <RNText style={[textStyles, style]} {...props} />;
};
