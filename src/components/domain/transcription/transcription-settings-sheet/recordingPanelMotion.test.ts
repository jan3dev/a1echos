import { renderHook } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";

import {
  BLUR_MAX,
  closeDuration,
  PanelMotion,
  panelVisuals,
  Q_OPEN,
  Q_REST,
  usePanelPan,
} from "./recordingPanelMotion";

const TRAVEL = 200;

const makeMotion = (q = Q_REST): PanelMotion =>
  ({
    q: { value: q },
    target: { value: Q_REST },
    dragStart: { value: 0 },
    travel: { value: TRAVEL },
    extra: { value: 0 },
    expand: { value: 0 },
  }) as unknown as PanelMotion;

const drag = (m: PanelMotion, dy: number, velocityY = 0, success = true) => {
  const onDrag = jest.fn();
  const pan = renderHook(() => usePanelPan(m, onDrag, true)).result
    .current as unknown as Record<
    "onActivate" | "onUpdate" | "onDeactivate",
    (e: object) => void
  >;
  pan.onActivate({ translationY: 0 });
  pan.onUpdate({ translationY: dy });
  const draggedTo = m.q.value;
  pan.onDeactivate({ velocityY, canceled: !success });
  return { onDrag, draggedTo };
};

describe("panelVisuals", () => {
  it("content is sharp and visible from 30% open, gone by 5%", () => {
    expect(panelVisuals(0.3, TRAVEL)).toMatchObject({
      contentBlur: 0,
      contentOpacity: 1,
    });
    expect(panelVisuals(0.05, TRAVEL).contentOpacity).toBe(0);
    expect(panelVisuals(0, TRAVEL).contentBlur).toBe(BLUR_MAX);
    const mid = panelVisuals(0.15, TRAVEL);
    expect(mid.contentBlur).toBeGreaterThan(0);
    expect(mid.contentOpacity).toBeGreaterThan(0);
  });

  it("grabber morphs in the first 35% and stays home below it", () => {
    expect(panelVisuals(0, TRAVEL).barStraightness).toBe(0);
    expect(panelVisuals(0.35, TRAVEL).barStraightness).toBe(1);
    expect(panelVisuals(-0.2, TRAVEL).barTranslateY).toBe(-0);
    expect(panelVisuals(1, TRAVEL).barTranslateY).toBe(-TRAVEL);
  });

  it("panel fades out over the last 30% of travel past home", () => {
    expect(panelVisuals(Q_REST, TRAVEL).panelOpacity).toBe(0);
    expect(panelVisuals(0, TRAVEL).panelOpacity).toBe(1);
    expect(panelVisuals(Q_REST, TRAVEL).panelTranslateY).toBe(1.3 * TRAVEL);
  });

  it("close takes longer from further up", () => {
    expect(closeDuration(Q_OPEN)).toBeGreaterThan(closeDuration(0));
    expect(closeDuration(Q_REST)).toBe(150);
  });
});

describe("usePanelPan", () => {
  it("closes when cancelled, even past half", () => {
    const m = makeMotion();
    const { onDrag } = drag(m, -0.9 * TRAVEL, 0, false);
    expect(onDrag).toHaveBeenLastCalledWith(false);
    expect(m.q.value).toBe(Q_REST);
  });

  it("follows the finger and opens past half on release", () => {
    const m = makeMotion();
    const { onDrag, draggedTo } = drag(m, -0.9 * TRAVEL);
    expect(draggedTo).toBeCloseTo(0.6);
    expect(onDrag).toHaveBeenNthCalledWith(1, true);
    expect(onDrag).toHaveBeenLastCalledWith(true);
    expect(m.q.value).toBe(Q_OPEN);
  });

  it("closes below half", () => {
    const m = makeMotion();
    const { onDrag } = drag(m, -0.7 * TRAVEL);
    expect(onDrag).toHaveBeenLastCalledWith(false);
    expect(m.q.value).toBe(Q_REST);
    expect(m.target.value).toBe(Q_REST);
  });

  it("a flick wins over position", () => {
    const up = makeMotion();
    expect(drag(up, -20, -600).onDrag).toHaveBeenLastCalledWith(true);
    const down = makeMotion(Q_OPEN);
    expect(drag(down, 20, 600).onDrag).toHaveBeenLastCalledWith(false);
  });

  it("ticks each time the drag crosses the open/close threshold", () => {
    const m = makeMotion();
    const pan = renderHook(() => usePanelPan(m, jest.fn(), true)).result
      .current as unknown as Record<
      "onActivate" | "onUpdate",
      (e: object) => void
    >;
    (Haptics.selectionAsync as jest.Mock).mockClear();
    pan.onActivate({ translationY: 0 });
    pan.onUpdate({ translationY: -0.7 * TRAVEL });
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    pan.onUpdate({ translationY: -0.9 * TRAVEL });
    pan.onUpdate({ translationY: -TRAVEL });
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    pan.onUpdate({ translationY: -0.7 * TRAVEL });
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
  });

  it("resists past open and stops at rest", () => {
    expect(drag(makeMotion(Q_OPEN), -TRAVEL).draggedTo).toBeCloseTo(1.3);
    expect(drag(makeMotion(0), 2 * TRAVEL).draggedTo).toBe(Q_REST);
  });
});
