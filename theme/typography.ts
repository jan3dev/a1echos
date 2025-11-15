const MANROPE = 'Manrope';
const MANROPE_MEDIUM = 'Manrope-Medium';
const MANROPE_SEMIBOLD = 'Manrope-SemiBold';
const PUBLIC_SANS = 'PublicSans';
const PUBLIC_SANS_MEDIUM = 'PublicSans-Medium';
const PUBLIC_SANS_SEMIBOLD = 'PublicSans-SemiBold';

const TYPOGRAPHY_SIZES = {
  h1: 50,
  h2: 40,
  h3: 30,
  h4: 24,
  h5: 20,
  subtitle: 18,
  body1: 16,
  body2: 14,
  caption1: 12,
  caption2: 10,
} as const;

type SizeKey = keyof typeof TYPOGRAPHY_SIZES;

const createTypographyVariant = (
  fontFamily: string,
  sizeKey: SizeKey,
  useLetterSpacing = true
) => {
  const fontSize = TYPOGRAPHY_SIZES[sizeKey];
  return {
    fontFamily,
    fontSize,
    letterSpacing: useLetterSpacing ? fontSize * -0.01 : 0.0,
  };
};

export const AquaTypography = {
  h1: createTypographyVariant(MANROPE, 'h1'),
  h2: createTypographyVariant(MANROPE, 'h2'),
  h3: createTypographyVariant(MANROPE, 'h3'),
  h4: createTypographyVariant(MANROPE, 'h4'),
  h5: createTypographyVariant(MANROPE, 'h5'),
  subtitle: createTypographyVariant(MANROPE, 'subtitle'),
  body1: createTypographyVariant(PUBLIC_SANS, 'body1'),
  body2: createTypographyVariant(PUBLIC_SANS, 'body2'),
  caption1: createTypographyVariant(PUBLIC_SANS, 'caption1', false),
  caption2: createTypographyVariant(PUBLIC_SANS, 'caption2', false),

  h1Medium: createTypographyVariant(MANROPE_MEDIUM, 'h1'),
  h2Medium: createTypographyVariant(MANROPE_MEDIUM, 'h2'),
  h3Medium: createTypographyVariant(MANROPE_MEDIUM, 'h3'),
  h4Medium: createTypographyVariant(MANROPE_MEDIUM, 'h4'),
  h5Medium: createTypographyVariant(MANROPE_MEDIUM, 'h5'),
  subtitleMedium: createTypographyVariant(MANROPE_MEDIUM, 'subtitle'),
  body1Medium: createTypographyVariant(PUBLIC_SANS_MEDIUM, 'body1'),
  body2Medium: createTypographyVariant(PUBLIC_SANS_MEDIUM, 'body2'),
  caption1Medium: createTypographyVariant(
    PUBLIC_SANS_MEDIUM,
    'caption1',
    false
  ),
  caption2Medium: createTypographyVariant(
    PUBLIC_SANS_MEDIUM,
    'caption2',
    false
  ),

  h1SemiBold: createTypographyVariant(MANROPE_SEMIBOLD, 'h1'),
  h2SemiBold: createTypographyVariant(MANROPE_SEMIBOLD, 'h2'),
  h3SemiBold: createTypographyVariant(MANROPE_SEMIBOLD, 'h3'),
  h4SemiBold: createTypographyVariant(MANROPE_SEMIBOLD, 'h4'),
  h5SemiBold: createTypographyVariant(MANROPE_SEMIBOLD, 'h5'),
  subtitleSemiBold: createTypographyVariant(MANROPE_SEMIBOLD, 'subtitle'),
  body1SemiBold: createTypographyVariant(PUBLIC_SANS_SEMIBOLD, 'body1'),
  body2SemiBold: createTypographyVariant(PUBLIC_SANS_SEMIBOLD, 'body2'),
  caption1SemiBold: createTypographyVariant(
    PUBLIC_SANS_SEMIBOLD,
    'caption1',
    false
  ),
  caption2SemiBold: createTypographyVariant(
    PUBLIC_SANS_SEMIBOLD,
    'caption2',
    false
  ),
} as const;

export type TypographyKey = keyof typeof AquaTypography;
export type TypographyStyle = (typeof AquaTypography)[TypographyKey];
