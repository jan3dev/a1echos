const BASE_UNIT = 8;

export const spacing = {
  xs: BASE_UNIT * 0.5,
  sm: BASE_UNIT,
  md: BASE_UNIT * 2,
  lg: BASE_UNIT * 3,
  xl: BASE_UNIT * 4,
  xxl: BASE_UNIT * 5,
  xxxl: BASE_UNIT * 6,

  unit7: BASE_UNIT * 7,
  unit8: BASE_UNIT * 8,
} as const;

export type SpacingKey = keyof typeof spacing;
export type SpacingValue = (typeof spacing)[SpacingKey];
