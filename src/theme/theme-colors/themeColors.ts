import { AquaPrimitiveColors } from "../colors/colors";

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
  glassSurfaceSecondary: string;
  glassSurfaceBorder: string;
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

  ripple: string;
  rippleOnPrimary: string;

  buttonPrimaryBackgroundFlat: string;
  buttonUtilityBackground: string;
  buttonFocusRing: string;

  systemBackgroundColor: string;
}

export const lightColors: AquaColors = {
  textPrimary: AquaPrimitiveColors.metal950,
  textSecondary: AquaPrimitiveColors.metal750,
  textTertiary: AquaPrimitiveColors.metal500,
  textInverse: AquaPrimitiveColors.white,

  surfacePrimary: AquaPrimitiveColors.white,
  surfaceBorderPrimary: AquaPrimitiveColors.metal100,
  surfaceSecondary: AquaPrimitiveColors.metal200,
  surfaceBorderSecondary: AquaPrimitiveColors.metal300,
  surfaceTertiary: AquaPrimitiveColors.metal300,
  surfaceInverse: AquaPrimitiveColors.metal950,
  surfaceBackground: AquaPrimitiveColors.metal50,
  surfaceSelected: AquaPrimitiveColors.neonBlue400Transparent8,
  surfaceBorderSelected: AquaPrimitiveColors.neonBlue500,

  glassSurface: AquaPrimitiveColors.glassSurfaceLight,
  glassSurfaceSecondary: AquaPrimitiveColors.glassSurfaceSecondaryLight,
  glassSurfaceBorder: AquaPrimitiveColors.glassSurfaceBorderLight,
  glassInverse: AquaPrimitiveColors.glassInverseLight,
  glassBackground: AquaPrimitiveColors.glassBackgroundLight,

  accentBrand: AquaPrimitiveColors.neonBlue500,
  accentBrandTransparent: AquaPrimitiveColors.neonBlue16,
  accentSuccess: AquaPrimitiveColors.forestGreen500,
  accentSuccessTransparent: AquaPrimitiveColors.forestGreen24,
  accentWarning: AquaPrimitiveColors.harvestGold500,
  accentWarningTransparent: AquaPrimitiveColors.harvestGold16,
  accentDanger: AquaPrimitiveColors.scarlet500,
  accentDangerTransparent: AquaPrimitiveColors.scarlet16,

  chipSuccessBackgroundColor: AquaPrimitiveColors.forestGreen24,
  chipErrorBackgroundColor: AquaPrimitiveColors.scarlet16,
  chipSuccessForegroundColor: AquaPrimitiveColors.forestGreen500,
  chipErrorForegroundColor: AquaPrimitiveColors.scarlet500,

  ripple: AquaPrimitiveColors.rippleLight,
  rippleOnPrimary: AquaPrimitiveColors.rippleOnPrimary,

  buttonPrimaryBackgroundFlat: AquaPrimitiveColors.neonBlue400,
  buttonUtilityBackground: AquaPrimitiveColors.metal950,
  buttonFocusRing: AquaPrimitiveColors.neonBlue400,

  systemBackgroundColor: AquaPrimitiveColors.systemBackgroundColor,
};

// In dark mode, buttonUtilityBackground uses metal850 instead of metal950 so
// the utility button stays visible against surfacePrimary (also metal950).
export const darkColors: AquaColors = {
  textPrimary: AquaPrimitiveColors.metal50,
  textSecondary: AquaPrimitiveColors.metal400,
  textTertiary: AquaPrimitiveColors.metal500,
  textInverse: AquaPrimitiveColors.metal950,

  surfacePrimary: AquaPrimitiveColors.metal950,
  surfaceBorderPrimary: AquaPrimitiveColors.metal900,
  surfaceSecondary: AquaPrimitiveColors.metal900,
  surfaceBorderSecondary: AquaPrimitiveColors.metal850,
  surfaceTertiary: AquaPrimitiveColors.metal850,
  surfaceInverse: AquaPrimitiveColors.white,
  surfaceBackground: AquaPrimitiveColors.metal1000,
  surfaceSelected: AquaPrimitiveColors.neonBlue8,
  surfaceBorderSelected: AquaPrimitiveColors.neonBlue800,

  glassSurface: AquaPrimitiveColors.glassSurfaceDark,
  glassSurfaceSecondary: AquaPrimitiveColors.glassSurfaceSecondaryDark,
  glassSurfaceBorder: AquaPrimitiveColors.glassSurfaceBorderDark,
  glassInverse: AquaPrimitiveColors.glassInverseDark,
  glassBackground: AquaPrimitiveColors.glassBackgroundDark,

  accentBrand: AquaPrimitiveColors.neonBlue400,
  accentBrandTransparent: AquaPrimitiveColors.neonBlue16,
  accentSuccess: AquaPrimitiveColors.forestGreen500,
  accentSuccessTransparent: AquaPrimitiveColors.forestGreen24,
  accentWarning: AquaPrimitiveColors.harvestGold500,
  accentWarningTransparent: AquaPrimitiveColors.harvestGold16,
  accentDanger: AquaPrimitiveColors.scarlet500,
  accentDangerTransparent: AquaPrimitiveColors.scarlet16,

  chipSuccessBackgroundColor: AquaPrimitiveColors.forestGreen24,
  chipErrorBackgroundColor: AquaPrimitiveColors.scarlet16,
  chipSuccessForegroundColor: AquaPrimitiveColors.forestGreen500,
  chipErrorForegroundColor: AquaPrimitiveColors.scarlet500,

  ripple: AquaPrimitiveColors.rippleDark,
  rippleOnPrimary: AquaPrimitiveColors.rippleOnPrimary,

  buttonPrimaryBackgroundFlat: AquaPrimitiveColors.neonBlue400,
  buttonUtilityBackground: AquaPrimitiveColors.metal850,
  buttonFocusRing: AquaPrimitiveColors.neonBlue400,

  systemBackgroundColor: AquaPrimitiveColors.systemBackgroundColor,
};
