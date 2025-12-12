import { AquaPrimitiveColors } from '@/theme';
import { Platform, ViewStyle } from 'react-native';

export interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

const createShadow = (
  color: string,
  offset: { width: number; height: number },
  opacity: number,
  radius: number,
  elevation: number
): ShadowStyle => ({
  shadowColor: color,
  shadowOffset: offset,
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation: Platform.OS === 'android' ? elevation : 0,
});

export const shadows = {
  default: createShadow(
    AquaPrimitiveColors.shadow,
    { width: 0, height: 0 },
    1,
    16,
    2
  ),

  small: createShadow(
    AquaPrimitiveColors.shadow,
    { width: 0, height: 2 },
    0.5,
    4,
    2
  ),

  medium: createShadow(
    AquaPrimitiveColors.shadow,
    { width: 0, height: 4 },
    0.8,
    8,
    4
  ),

  large: createShadow(
    AquaPrimitiveColors.shadow,
    { width: 0, height: 8 },
    1,
    16,
    8
  ),

  menu: createShadow(
    AquaPrimitiveColors.black,
    { width: 0, height: 4 },
    0.16,
    16,
    8
  ),

  toast: createShadow(
    AquaPrimitiveColors.black,
    { width: 0, height: 4 },
    0.04,
    16,
    4
  ),

  card: createShadow(
    AquaPrimitiveColors.shadow,
    { width: 0, height: 0 },
    0.04,
    16,
    2
  ),

  cardElevated: createShadow(
    AquaPrimitiveColors.shadow,
    { width: 0, height: 4 },
    0.04,
    16,
    4
  ),

  modal: createShadow(
    AquaPrimitiveColors.black,
    { width: 0, height: -2 },
    0.1,
    8,
    5
  ),

  input: createShadow(
    AquaPrimitiveColors.shadow,
    { width: 0, height: 0 },
    0.04,
    20,
    2
  ),

  button: createShadow(
    AquaPrimitiveColors.black,
    { width: 0, height: 8 },
    0.26,
    8,
    4
  ),

  recordingButton: createShadow(
    AquaPrimitiveColors.shadow,
    { width: 0, height: 0 },
    1,
    20,
    4
  ),
} as const;

export type ShadowKey = keyof typeof shadows;

export const getShadow = (key: ShadowKey): ViewStyle => shadows[key];
