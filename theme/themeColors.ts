import { AquaPrimitiveColors } from '@/theme';

export interface AquaColors {
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  surfacePrimary: string;
  surfaceBorderPrimary: string;
  surfaceSecondary: string;
  surfaceBorderSecondary: string;
  surfaceTertiary: string;
  surfaceInverse: string;
  surfaceBackground: string;
  surfaceSelected: string;
  surfaceBorderSelected: string;

  glassSurface: string;
  glassInverse: string;
  glassBackground: string;

  accentBrand: string;
  accentBrandTransparent: string;
  accentSuccess: string;
  accentSuccessTransparent: string;
  accentWarning: string;
  accentWarningTransparent: string;
  accentDanger: string;
  accentDangerTransparent: string;

  chipSuccessBackgroundColor: string;
  chipErrorBackgroundColor: string;
  chipSuccessForegroundColor: string;
  chipErrorForegroundColor: string;

  systemBackgroundColor: string;
}

export const lightColors: AquaColors = {
  textPrimary: AquaPrimitiveColors.gray1000,
  textSecondary: AquaPrimitiveColors.gray750,
  textTertiary: AquaPrimitiveColors.gray500,
  textInverse: AquaPrimitiveColors.white,

  surfacePrimary: AquaPrimitiveColors.white,
  surfaceBorderPrimary: AquaPrimitiveColors.gray50,
  surfaceSecondary: AquaPrimitiveColors.gray50,
  surfaceBorderSecondary: AquaPrimitiveColors.gray100,
  surfaceTertiary: AquaPrimitiveColors.gray100,
  surfaceInverse: AquaPrimitiveColors.gray50,
  surfaceBackground: AquaPrimitiveColors.gray50,
  surfaceSelected: AquaPrimitiveColors.gray100,
  surfaceBorderSelected: AquaPrimitiveColors.neonBlue400,

  glassSurface: AquaPrimitiveColors.glassSurfaceLight,
  glassInverse: AquaPrimitiveColors.glassInverseLight,
  glassBackground: AquaPrimitiveColors.glassBackgroundLight,

  accentBrand: AquaPrimitiveColors.neonBlue500,
  accentBrandTransparent: AquaPrimitiveColors.neonBlue16,
  accentSuccess: AquaPrimitiveColors.green500,
  accentSuccessTransparent: AquaPrimitiveColors.green16,
  accentWarning: AquaPrimitiveColors.amber500,
  accentWarningTransparent: AquaPrimitiveColors.amber16,
  accentDanger: AquaPrimitiveColors.scarlet500,
  accentDangerTransparent: AquaPrimitiveColors.scarlet16,

  chipSuccessBackgroundColor: AquaPrimitiveColors.green16,
  chipErrorBackgroundColor: AquaPrimitiveColors.scarlet16,
  chipSuccessForegroundColor: AquaPrimitiveColors.green500,
  chipErrorForegroundColor: AquaPrimitiveColors.scarlet500,

  systemBackgroundColor: AquaPrimitiveColors.systemBackgroundColor,
};

export const darkColors: AquaColors = {
  textPrimary: AquaPrimitiveColors.gray50,
  textSecondary: AquaPrimitiveColors.gray500,
  textTertiary: AquaPrimitiveColors.gray750,
  textInverse: AquaPrimitiveColors.gray950,

  surfacePrimary: AquaPrimitiveColors.gray950,
  surfaceBorderPrimary: AquaPrimitiveColors.gray900,
  surfaceSecondary: AquaPrimitiveColors.gray900,
  surfaceBorderSecondary: AquaPrimitiveColors.gray850,
  surfaceTertiary: AquaPrimitiveColors.gray850,
  surfaceInverse: AquaPrimitiveColors.gray50,
  surfaceBackground: AquaPrimitiveColors.gray1000,
  surfaceSelected: AquaPrimitiveColors.gray850,
  surfaceBorderSelected: AquaPrimitiveColors.neonBlue800,

  glassSurface: AquaPrimitiveColors.glassSurfaceDark,
  glassInverse: AquaPrimitiveColors.glassInverseDark,
  glassBackground: AquaPrimitiveColors.glassBackgroundDark,

  accentBrand: AquaPrimitiveColors.neonBlue500,
  accentBrandTransparent: AquaPrimitiveColors.neonBlue16,
  accentSuccess: AquaPrimitiveColors.green500,
  accentSuccessTransparent: AquaPrimitiveColors.green16,
  accentWarning: AquaPrimitiveColors.amber500,
  accentWarningTransparent: AquaPrimitiveColors.amber16,
  accentDanger: AquaPrimitiveColors.scarlet500,
  accentDangerTransparent: AquaPrimitiveColors.scarlet16,

  chipSuccessBackgroundColor: AquaPrimitiveColors.green16,
  chipErrorBackgroundColor: AquaPrimitiveColors.scarlet16,
  chipSuccessForegroundColor: AquaPrimitiveColors.green500,
  chipErrorForegroundColor: AquaPrimitiveColors.scarlet500,

  systemBackgroundColor: AquaPrimitiveColors.systemBackgroundColor,
};

export const gradient = {
  colors: [AquaPrimitiveColors.neonBlue500, AquaPrimitiveColors.neonBlue400],
  start: { x: 1, y: 0 },
  end: { x: 0, y: 1 },
};
