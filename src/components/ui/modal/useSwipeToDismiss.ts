import { useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder } from "react-native";

const DRAG_START_DISTANCE = 8;
// The recording controls sit ~90pt above the screen edge, so a drag from there
// must be able to clear this.
const DISMISS_DISTANCE = 60;
const DISMISS_VELOCITY = 0.5;

/**
 * Drag-down-to-close for bottom sheets: spread `panHandlers` on the panel and
 * add `dragY` to its translateY. Buttons and rows keep their taps (they claim
 * the touch first) and hand it over once it turns into a downward drag.
 */
export const useSwipeToDismiss = (visible: boolean, onDismiss?: () => void) => {
  const dragY = useRef(new Animated.Value(0)).current;
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (visible) dragY.setValue(0);
  }, [visible, dragY]);

  const panHandlers = useMemo(() => {
    const settle = () =>
      Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();

    return PanResponder.create({
      // Claim touches on the panel's empty areas, or they bubble to an ancestor
      // responder outside the sheet and it never gets asked about the drag.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        dy > DRAG_START_DISTANCE && dy > Math.abs(dx),
      onPanResponderMove: (_, { dy }) => dragY.setValue(Math.max(0, dy)),
      onPanResponderRelease: (_, { dy, vy }) => {
        const dismiss = onDismissRef.current;
        if (dismiss && (dy > DISMISS_DISTANCE || vy > DISMISS_VELOCITY)) {
          dismiss();
        } else {
          settle();
        }
      },
      onPanResponderTerminate: settle,
    }).panHandlers;
  }, [dragY]);

  return { dragY, panHandlers };
};
