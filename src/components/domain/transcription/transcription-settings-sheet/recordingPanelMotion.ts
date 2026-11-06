import * as Haptics from "expo-haptics";
import { useMemo } from "react";
import { usePanGesture } from "react-native-gesture-handler";
import {
  Easing,
  SharedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/**
 * Every panel effect is a pure function of q, so opening and closing mirror:
 * q = 1 open, q = 0 panel top at the grabber's home above the record button,
 * q = Q_REST closed (30% of travel below home, invisible).
 */
export const Q_OPEN = 1;
export const Q_REST = -0.3;
const DEFAULT_TRAVEL = 232;

const BAR_ZONE = [0, 0.35] as const;
const BLUR_ZONE = [0, 0.3] as const;
const FADE_ZONE = [0.05, 0.3] as const;
const PANEL_ZONE = [Q_REST, 0] as const;
export const BLUR_MAX = 8;

const POSITION_THRESHOLD = 0.5;
const FLICK_VELOCITY = 500;
const RUBBER_BAND = 0.3;
export const DRAG_ACTIVATION = 8;
const MAX_DRIFT_X = 30;

const OPEN_SPRING = { mass: 1, stiffness: 224, damping: 24.5 };
const FLICK_OPEN_SPRING = { mass: 1, stiffness: 224, damping: 23.3 };
export const EXPAND_SPRING = { mass: 1, stiffness: 204, damping: 24.6 };
const CLOSE_EASING = Easing.bezier(0.32, 0.72, 0, 1);
const CLOSE_MS_FULL = 480;

export const LANGUAGE_MOTION = {
  open: {
    mainFadeOut: 120,
    expandDelay: 80,
    listFadeDelay: 290,
    listFade: 200,
  },
  back: {
    listFadeOut: 120,
    collapseDelay: 80,
    mainFadeDelay: 370,
    mainFade: 200,
  },
  listSlide: 8,
};

export const GRABBER_ARC_SVG =
  "M0 7.27114C0 6.48575 0.42078 5.76446 1.12582 5.4184C4.19483 3.91202 13.2042 0 24 0C34.7958 0 43.8052 3.91202 46.8742 5.4184C47.5792 5.76446 48 6.48575 48 7.27114C48 8.93769 46.1709 10.051 44.6381 9.39701C40.4725 7.61964 32.8344 5 24 5C15.1656 5 7.52751 7.61964 3.36194 9.397C1.82909 10.051 0 8.93769 0 7.27114Z";
// The 48×5 sheet grabber drawn with the arc's 8 cubics so the two interpolate.
const k = 0.5523 * 2.5;
export const GRABBER_PILL_SVG = `M0 2.5C0 ${2.5 - k} ${2.5 - k} 0 2.5 0C9.67 0 16.83 0 24 0C31.17 0 38.33 0 45.5 0C${45.5 + k} 0 48 ${2.5 - k} 48 2.5C48 ${2.5 + k} ${45.5 + k} 5 45.5 5C38.33 5 31.17 5 24 5C16.83 5 9.67 5 2.5 5C${2.5 - k} 5 0 ${2.5 + k} 0 2.5Z`;
export const BAR_SIZE = { width: 48, height: 9.587 };

const smoothstep = (e0: number, e1: number, x: number) => {
  "worklet";
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export const panelVisuals = (q: number, travel: number) => {
  "worklet";
  return {
    panelTranslateY: (1 - q) * travel,
    barTranslateY: -travel * Math.max(0, q),
    barStraightness: smoothstep(BAR_ZONE[0], BAR_ZONE[1], q),
    contentBlur: BLUR_MAX * (1 - smoothstep(BLUR_ZONE[0], BLUR_ZONE[1], q)),
    contentOpacity: smoothstep(FADE_ZONE[0], FADE_ZONE[1], q),
    panelOpacity: smoothstep(PANEL_ZONE[0], PANEL_ZONE[1], q),
  };
};

/**
 * Shared between the drag that starts on the recording controls and the
 * panel itself. `travel` is home → open grabber on the main page, `extra`
 * the Spoken Language page's added height, `expand` 0 main → 1 language.
 */
export interface PanelMotion {
  q: SharedValue<number>;
  target: SharedValue<number>;
  dragStart: SharedValue<number>;
  travel: SharedValue<number>;
  extra: SharedValue<number>;
  expand: SharedValue<number>;
}

export const usePanelMotion = (): PanelMotion => {
  const q = useSharedValue(Q_REST);
  const target = useSharedValue(Q_REST);
  const dragStart = useSharedValue(Q_REST);
  const travel = useSharedValue(DEFAULT_TRAVEL);
  const extra = useSharedValue(0);
  const expand = useSharedValue(0);
  return useMemo(
    () => ({ q, target, dragStart, travel, extra, expand }),
    [q, target, dragStart, travel, extra, expand],
  );
};

export const panelTravel = (m: PanelMotion) => {
  "worklet";
  return m.travel.value + m.extra.value * m.expand.value;
};

export const closeDuration = (fromQ: number) => {
  "worklet";
  return Math.max(
    150,
    Math.min(CLOSE_MS_FULL, (CLOSE_MS_FULL * (fromQ - Q_REST)) / 1.05),
  );
};

export const animatePanel = (
  m: PanelMotion,
  open: boolean,
  velocity = 0,
  flick = false,
) => {
  "worklet";
  m.target.value = open ? Q_OPEN : Q_REST;
  m.q.value = open
    ? withSpring(Q_OPEN, {
        ...(flick ? FLICK_OPEN_SPRING : OPEN_SPRING),
        velocity,
      })
    : withTiming(Q_REST, {
        duration: closeDuration(m.q.value),
        easing: CLOSE_EASING,
      });
};

/** Animates only when not already headed there, e.g. by a drag release. */
export const settlePanel = (m: PanelMotion, open: boolean) => {
  "worklet";
  if (m.target.value !== (open ? Q_OPEN : Q_REST)) animatePanel(m, open);
};

const thresholdTick = () => void Haptics.selectionAsync();

// Drag steps, shared by the gesture-handler pan and a JS PanResponder.
export const beginDrag = (m: PanelMotion, translationY: number) => {
  "worklet";
  m.target.value = Q_OPEN;
  m.dragStart.value = m.q.value + translationY / panelTravel(m);
};

export const updateDrag = (m: PanelMotion, translationY: number) => {
  "worklet";
  let next = m.dragStart.value - translationY / panelTravel(m);
  if (next > Q_OPEN) next = Q_OPEN + (next - Q_OPEN) * RUBBER_BAND;
  next = Math.max(Q_REST, next);
  // Tick where releasing flips between opening and closing.
  if (m.q.value >= POSITION_THRESHOLD !== next >= POSITION_THRESHOLD) {
    scheduleOnRN(thresholdTick);
  }
  m.q.value = next;
};

/** Settles the panel by the release rules and passes whether it opens to `onDrag`. */
export const releaseDrag = (
  m: PanelMotion,
  velocityY: number,
  onDrag: (open: boolean) => void,
) => {
  "worklet";
  const flick = Math.abs(velocityY) > FLICK_VELOCITY;
  const open = flick ? velocityY < 0 : m.q.value >= POSITION_THRESHOLD;
  animatePanel(m, open, -velocityY / panelTravel(m), flick);
  scheduleOnRN(onDrag, open);
};

export const isUpwardDrag = (dx: number, dy: number) =>
  dy < -DRAG_ACTIVATION && Math.abs(dx) < MAX_DRIFT_X;

/**
 * Finger-following drag. `onDrag(true)` fires when a drag starts (the panel
 * is held open from then on) and `onDrag(open)` again on release.
 */
export const usePanelPan = (
  m: PanelMotion,
  onDrag: (open: boolean) => void,
  enabled: boolean,
  activeOffsetY: number | [number, number] = [
    -DRAG_ACTIVATION,
    DRAG_ACTIVATION,
  ],
) =>
  usePanGesture({
    enabled,
    activeOffsetY,
    failOffsetX: [-MAX_DRIFT_X, MAX_DRIFT_X],
    onActivate: (e) => {
      "worklet";
      beginDrag(m, e.translationY);
      scheduleOnRN(onDrag, true);
    },
    onUpdate: (e) => {
      "worklet";
      updateDrag(m, e.translationY);
    },
    onDeactivate: (e) => {
      "worklet";
      if (!e.canceled) {
        releaseDrag(m, e.velocityY, onDrag);
        return;
      }
      // Cancelled, e.g. disabled mid-drag: close rather than spring back open.
      animatePanel(m, false);
      scheduleOnRN(onDrag, false);
    },
  });
