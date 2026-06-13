export const recordingGradient = {
  colors: ["#A54CFF", "#4588D2", "#F7931A"],
  locations: [0, 0.5, 1],
};

// Per-line gradients for the three animated wave lines. The palette is split
// across the lines instead of along each line's width, so orange runs the full
// length of the middle (2nd) line while the outer lines carry purple and blue.
export const recordingWaveGradients = [
  { colors: ["#A54CFF", "#4588D2"], locations: [0, 1] },
  { colors: ["#FF8A3D", "#F7931A"], locations: [0, 1] },
  { colors: ["#4588D2", "#A54CFF"], locations: [0, 1] },
];
