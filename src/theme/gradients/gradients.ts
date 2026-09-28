export interface RecordingButtonBlob {
  color: string;
  // Rest position and radius as fractions of the button size.
  x: number;
  y: number;
  r: number;
  drift: number;
  periodX: number;
  periodY: number;
  phase: number;
}

// Soft blurred blobs drifting over a periwinkle base, sampled from the
// record-button reference animation.
export const recordingButtonGradient: {
  base: string;
  blobs: RecordingButtonBlob[];
} = {
  base: "#9CA0D8",
  blobs: [
    {
      color: "#6F6BE0",
      x: 0.25,
      y: 0.8,
      r: 0.34,
      drift: 0.14,
      periodX: 7100,
      periodY: 5300,
      phase: 0,
    },
    {
      color: "#6386DA",
      x: 0.82,
      y: 0.4,
      r: 0.32,
      drift: 0.14,
      periodX: 6100,
      periodY: 7900,
      phase: 2.1,
    },
    {
      color: "#D9BCD6",
      x: 0.55,
      y: 0.58,
      r: 0.2,
      drift: 0.18,
      periodX: 5600,
      periodY: 6700,
      phase: 4.2,
    },
    {
      color: "#E8E6F5",
      x: 0.3,
      y: 0.26,
      r: 0.3,
      drift: 0.13,
      periodX: 8300,
      periodY: 6300,
      phase: 1.3,
    },
    {
      color: "#D3DBF3",
      x: 0.74,
      y: 0.84,
      r: 0.22,
      drift: 0.12,
      periodX: 6900,
      periodY: 5900,
      phase: 3.4,
    },
  ],
};

// Per-line gradients for the three animated wave lines. The palette is split
// across the lines instead of along each line's width, so orange runs the full
// length of the middle (2nd) line while the outer lines carry purple and blue.
export const recordingWaveGradients = [
  { colors: ["#A54CFF", "#4588D2"], locations: [0, 1] },
  { colors: ["#FF8A3D", "#F7931A"], locations: [0, 1] },
  { colors: ["#4588D2", "#A54CFF"], locations: [0, 1] },
];
