export const AquaPrimitiveColors = {
  white: "#FFFFFF",
  black: "#000000",

  metal50: "#F5F5F8",
  metal100: "#F0F0F4",
  metal200: "#E4E4E8",
  metal300: "#C8C8CE",
  metal400: "#ABABB2",
  metal500: "#8A8A92",
  metal750: "#2C3136",
  metal850: "#1E2226",
  metal900: "#15181B",
  metal950: "#0F1214",
  metal1000: "#070708",

  neonBlue300: "#7A92F3",
  neonBlue400: "#5773EF",
  neonBlue500: "#4361EE",
  neonBlue800: "#0E2795",
  neonBlue: "#4361EE",
  neonBlue16: "rgba(67, 97, 238, 0.16)",
  neonBlue8: "rgba(67, 97, 238, 0.08)",
  neonBlue400Transparent8: "rgba(87, 115, 239, 0.08)",

  forestGreen500: "#18A23B",
  forestGreen: "#18A23B",
  forestGreen24: "rgba(24, 162, 59, 0.24)",

  harvestGold500: "#FFAB1B",
  harvestGold: "#FFAB1B",
  harvestGold16: "rgba(255, 171, 27, 0.16)",

  scarlet500: "#FF3B13",
  scarlet: "#FF3B13",
  scarlet16: "rgba(255, 59, 19, 0.16)",

  glassSurfaceLight: "rgba(255, 255, 255, 0.90)",
  glassInverseLight: "rgba(0, 0, 0, 0.85)",
  glassBackgroundLight: "rgba(245, 245, 248, 0.5)",
  glassSurfaceSecondaryLight: "rgba(0, 0, 0, 0.08)",
  glassSurfaceBorderLight: "rgba(0, 0, 0, 0.04)",

  glassSurfaceDark: "rgba(15, 18, 20, 0.90)",
  glassInverseDark: "rgba(255, 255, 255, 0.85)",
  glassBackgroundDark: "rgba(7, 7, 8, 0.5)",
  glassSurfaceSecondaryDark: "rgba(255, 255, 255, 0.16)",
  glassSurfaceBorderDark: "rgba(255, 255, 255, 0.04)",

  rippleLight: "rgba(9, 10, 11, 0.10)",
  rippleDark: "rgba(244, 245, 246, 0.10)",
  rippleOnPrimary: "rgba(255, 255, 255, 0.20)",

  waveOrange: "#F7931A",
  waveCyan: "#16BAC5",

  systemBackgroundColor: "#D0D5DC",
} as const;

export type AquaPrimitiveColor =
  (typeof AquaPrimitiveColors)[keyof typeof AquaPrimitiveColors];
