// Coordinates are in the spec's 96-unit space; the visible button is the
// circle of radius `maskRadius` around its center.
export interface RecordingButtonBlob {
  rgb: string;
  radius: number;
  // Lissajous path: x = c + r·sin(2π·kx·t + phase), y = c + r·sin(2π·ky·t + 1.3·phase)
  r: number;
  kx: number;
  ky: number;
  phase: number;
}

export interface RecordingButtonHighlight {
  x: number;
  y: number;
  orbit: number;
  revolutions: number;
  phaseDeg: number;
  radius: number;
  blur: number;
}

// Liquid gradient from the record-button animation spec. Integer kx/ky and
// revolutions keep the loop seamless.
export const recordingButtonGradient: {
  viewBox: number;
  maskRadius: number;
  loopMs: number;
  base: string;
  blobs: RecordingButtonBlob[];
  highlights: RecordingButtonHighlight[];
  highlightStrength: number;
} = {
  viewBox: 96,
  maskRadius: 34,
  loopMs: 7000,
  base: "#4588D2",
  blobs: [
    { rgb: "165,76,255", radius: 60, r: 18, kx: 2, ky: 2, phase: 0 },
    { rgb: "69,136,210", radius: 64, r: 20, kx: 3, ky: 4, phase: 2.1 },
    { rgb: "200,180,200", radius: 54, r: 16, kx: 2, ky: 3, phase: 4.2 },
  ],
  highlights: [
    {
      x: 30,
      y: 28,
      orbit: 5,
      revolutions: 2,
      phaseDeg: 0,
      radius: 17,
      blur: 9,
    },
    {
      x: 68,
      y: 70,
      orbit: 4,
      revolutions: -3,
      phaseDeg: 140,
      radius: 15,
      blur: 9,
    },
  ],
  highlightStrength: 0.85,
};

// Per-line gradients for the three animated wave lines. The palette is split
// across the lines instead of along each line's width, so orange runs the full
// length of the middle (2nd) line while the outer lines carry purple and blue.
export const recordingWaveGradients = [
  { colors: ["#A54CFF", "#4588D2"], locations: [0, 1] },
  { colors: ["#FF8A3D", "#F7931A"], locations: [0, 1] },
  { colors: ["#4588D2", "#A54CFF"], locations: [0, 1] },
];
