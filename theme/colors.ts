export const AquaPrimitiveColors = {
  white: '#FFFFFF',
  black: '#000000',

  gray50: '#F4F5F6',
  gray100: '#E9EBEC',
  gray500: '#929BA0',
  gray750: '#4C5357',
  gray850: '#27292C',
  gray900: '#1D1F21',
  gray950: '#131516',
  gray1000: '#090A0B',
  gray: '#929BA0',

  neonBlue400: '#5773EF',
  neonBlue500: '#4361EE',
  neonBlue800: '#0E2795',
  neonBlue: '#4361EE',
  neonBlue16: 'rgba(67, 97, 238, 0.16)',
  neonBlue8: 'rgba(67, 97, 238, 0.08)',

  green500: '#18A23B',
  green: '#18A23B',
  green16: 'rgba(24, 162, 59, 0.16)',

  amber500: '#FFAB1B',
  amber: '#FFAB1B',
  amber16: 'rgba(255, 171, 27, 0.16)',

  scarlet500: '#FF3B13',
  scarlet: '#FF3B13',
  scarlet16: 'rgba(255, 59, 19, 0.16)',

  glassSurfaceLight: 'rgba(255, 255, 255, 0.5)',
  glassInverseLight: 'rgba(0, 0, 0, 0.85)',
  glassBackgroundLight: 'rgba(244, 245, 246, 0.3)',

  glassSurfaceDark: 'rgba(39, 41, 44, 0.5)',
  glassInverseDark: 'rgba(255, 255, 255, 0.85)',
  glassBackgroundDark: 'rgba(19, 21, 22, 0.4)',

  waveOrange: '#F7931A',
  waveCyan: '#16BAC5',

  systemBackgroundColor: '#D0D5DC',
} as const;

export type AquaPrimitiveColor =
  (typeof AquaPrimitiveColors)[keyof typeof AquaPrimitiveColors];
