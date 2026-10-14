import type { ReactNode } from "react";
import type { SharedValue } from "react-native-reanimated";

export const LIST_MAX_WIDTH = 343;
export const PRESS_MS = 220;

export interface DemoProps {
  t: SharedValue<number>;
  tooltip: ReactNode;
  testID?: string;
}

// Hand-rolled rather than reanimated's Easing, which the jest mock stubs out.
const easeOutCubic = (x: number) => {
  "worklet";
  return 1 - (1 - x) ** 3;
};

export const easeInOutCubic = (x: number) => {
  "worklet";
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
};

/** Eased 0→1 progress of the segment [start, start + duration] at time t (ms). */
export const segment = (
  t: number,
  start: number,
  duration: number,
  ease: (x: number) => number = easeOutCubic,
) => {
  "worklet";
  return ease(Math.min(Math.max((t - start) / duration, 0), 1));
};

export const mix = (p: number, from: number, to: number) => {
  "worklet";
  return from + (to - from) * p;
};

/** 0→1 while the finger is down, for pressed-state visuals of the tap target. */
export const pressAmount = (t: number, at: number) => {
  "worklet";
  return segment(t, at, 100) * (1 - segment(t, at + PRESS_MS, 160));
};
