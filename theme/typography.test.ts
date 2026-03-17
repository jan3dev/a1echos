import { AquaTypography } from './typography';

describe('AquaTypography', () => {
  const keys = Object.keys(AquaTypography);

  it('has exactly 30 variants', () => {
    expect(keys).toHaveLength(30);
  });

  it('has all base, Medium, and SemiBold variants', () => {
    const baseKeys = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'subtitle',
      'body1',
      'body2',
      'caption1',
      'caption2',
    ];
    const mediumKeys = baseKeys.map((k) => `${k}Medium`);
    const semiBoldKeys = baseKeys.map((k) => `${k}SemiBold`);

    for (const key of [...baseKeys, ...mediumKeys, ...semiBoldKeys]) {
      expect(AquaTypography).toHaveProperty(key);
    }
  });

  it('every variant has exactly fontFamily, fontSize, letterSpacing', () => {
    for (const key of keys) {
      const variant = AquaTypography[key as keyof typeof AquaTypography];
      expect(Object.keys(variant)).toHaveLength(3);
      expect(variant).toHaveProperty('fontFamily');
      expect(variant).toHaveProperty('fontSize');
      expect(variant).toHaveProperty('letterSpacing');
    }
  });

  it.each([
    ['h1', 50],
    ['h2', 40],
    ['h3', 30],
    ['h4', 24],
    ['h5', 20],
    ['subtitle', 18],
    ['body1', 16],
    ['body2', 14],
    ['caption1', 12],
    ['caption2', 10],
  ] as const)('base %s has fontSize %d', (key, expectedSize) => {
    expect(AquaTypography[key].fontSize).toBe(expectedSize);
  });

  it('Medium and SemiBold variants share base font sizes', () => {
    const baseKeys = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'subtitle',
      'body1',
      'body2',
      'caption1',
      'caption2',
    ] as const;

    for (const base of baseKeys) {
      const mediumKey = `${base}Medium` as keyof typeof AquaTypography;
      const semiBoldKey = `${base}SemiBold` as keyof typeof AquaTypography;
      expect(AquaTypography[mediumKey].fontSize).toBe(
        AquaTypography[base].fontSize,
      );
      expect(AquaTypography[semiBoldKey].fontSize).toBe(
        AquaTypography[base].fontSize,
      );
    }
  });

  it('h1-subtitle use Manrope, body1-caption2 use PublicSans', () => {
    const manropeKeys = ['h1', 'h2', 'h3', 'h4', 'h5', 'subtitle'] as const;
    const publicSansKeys = ['body1', 'body2', 'caption1', 'caption2'] as const;

    for (const key of manropeKeys) {
      expect(AquaTypography[key].fontFamily).toBe('Manrope');
      expect(
        AquaTypography[`${key}Medium` as keyof typeof AquaTypography]
          .fontFamily,
      ).toBe('Manrope-Medium');
      expect(
        AquaTypography[`${key}SemiBold` as keyof typeof AquaTypography]
          .fontFamily,
      ).toBe('Manrope-SemiBold');
    }

    for (const key of publicSansKeys) {
      expect(AquaTypography[key].fontFamily).toBe('PublicSans');
      expect(
        AquaTypography[`${key}Medium` as keyof typeof AquaTypography]
          .fontFamily,
      ).toBe('PublicSans-Medium');
      expect(
        AquaTypography[`${key}SemiBold` as keyof typeof AquaTypography]
          .fontFamily,
      ).toBe('PublicSans-SemiBold');
    }
  });

  it('letter spacing is fontSize * -0.01 for most, 0 for captions', () => {
    const withSpacing = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'subtitle',
      'body1',
      'body2',
    ] as const;
    const withoutSpacing = ['caption1', 'caption2'] as const;

    for (const key of withSpacing) {
      const variant = AquaTypography[key];
      expect(variant.letterSpacing).toBeCloseTo(variant.fontSize * -0.01);
    }

    for (const key of withoutSpacing) {
      expect(AquaTypography[key].letterSpacing).toBe(0);
      expect(
        AquaTypography[`${key}Medium` as keyof typeof AquaTypography]
          .letterSpacing,
      ).toBe(0);
      expect(
        AquaTypography[`${key}SemiBold` as keyof typeof AquaTypography]
          .letterSpacing,
      ).toBe(0);
    }
  });
});
