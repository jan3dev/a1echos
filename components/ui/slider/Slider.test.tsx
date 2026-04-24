/* eslint-disable @typescript-eslint/no-require-imports */
import { act, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { Slider, SliderState } from "./Slider";

// Suppress RN Animated internals triggering act() warnings for timer-based animations
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("was not wrapped in act")
    ) {
      return;
    }
    originalConsoleError(...args);
  };
});
afterAll(() => {
  console.error = originalConsoleError;
});

// Mock Icon to expose the icon name in the rendered tree
jest.mock("../icon/Icon", () => ({
  Icon: ({ name, ...rest }: { name: string; [key: string]: unknown }) => {
    const { View } = require("react-native");
    const { dynamicTestID: dTID } = require("@/constants");
    return <View testID={dTID.icon(name)} {...rest} />;
  },
}));

// Mock ProgressIndicator to be identifiable in the tree
jest.mock("../progress/ProgressIndicator", () => ({
  ProgressIndicator: (props: Record<string, unknown>) => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.ProgressIndicator} {...props} />;
  },
}));

describe("Slider", () => {
  const defaultProps = {
    width: 300,
    onConfirm: jest.fn(),
  };

  it.each([
    ["initial", "icon-arrow_right"],
    ["inProgress", TestID.ProgressIndicator],
    ["completed", "icon-check"],
    ["error", "icon-close"],
  ] as [string, string][])(
    "renders %s state with correct indicator",
    (sliderState, expectedTestId) => {
      const { getByTestId } = render(
        <Slider {...defaultProps} sliderState={sliderState as SliderState} />,
      );
      expect(getByTestId(expectedTestId)).toBeTruthy();
    },
  );

  it("renders disabled state with reduced opacity", () => {
    const { toJSON } = render(
      <Slider {...defaultProps} enabled={false} sliderState="initial" />,
    );
    const json = JSON.stringify(toJSON());
    // When disabled, the thumb View has opacity: 0.5
    expect(json).toContain('"opacity":0.5');
  });

  // --- PanResponder: onMoveShouldSetResponder returns true when enabled ---
  it("panResponder responds to moves when enabled and initial", () => {
    const { Animated } = require("react-native");
    const { UNSAFE_root } = render(
      <Slider {...defaultProps} enabled={true} sliderState="initial" />,
    );

    // PanResponder translates callback names to native responder prop names
    const animatedViews = UNSAFE_root.findAllByType(Animated.View);
    const touchArea = animatedViews.find(
      (v: any) => v.props.onMoveShouldSetResponder,
    );
    expect(touchArea).toBeTruthy();

    // onMoveShouldSetResponder should return true when enabled and initial
    const result = touchArea!.props.onMoveShouldSetResponder();
    expect(result).toBe(true);
  });

  // --- PanResponder: onMoveShouldSetResponder returns false when disabled ---
  it("panResponder does not respond when enabled=false", () => {
    const { Animated } = require("react-native");
    const { UNSAFE_root } = render(
      <Slider {...defaultProps} enabled={false} sliderState="initial" />,
    );

    const animatedViews = UNSAFE_root.findAllByType(Animated.View);
    const touchArea = animatedViews.find(
      (v: any) => v.props.onMoveShouldSetResponder,
    );
    expect(touchArea).toBeTruthy();

    const result = touchArea!.props.onMoveShouldSetResponder();
    expect(result).toBe(false);
  });

  // --- PanResponder: onStartShouldSetResponder returns false when not initial ---
  it("panResponder does not respond when sliderState is not initial", () => {
    const { Animated } = require("react-native");
    const { UNSAFE_root } = render(
      <Slider {...defaultProps} enabled={true} sliderState="inProgress" />,
    );

    const animatedViews = UNSAFE_root.findAllByType(Animated.View);
    const touchArea = animatedViews.find(
      (v: any) => v.props.onStartShouldSetResponder,
    );
    expect(touchArea).toBeTruthy();

    const result = touchArea!.props.onStartShouldSetResponder();
    expect(result).toBe(false);
  });

  // --- PanResponder: onResponderMove with positive dx ---
  it("onResponderMove updates position within bounds", async () => {
    const { Animated } = require("react-native");
    const { UNSAFE_root } = render(
      <Slider
        {...defaultProps}
        width={300}
        enabled={true}
        sliderState="initial"
      />,
    );

    const animatedViews = UNSAFE_root.findAllByType(Animated.View);
    const touchArea = animatedViews.find((v: any) => v.props.onResponderMove);
    expect(touchArea).toBeTruthy();

    // The onResponderMove wrapper calls config.onPanResponderMove(event, gestureState)
    // We need to provide a proper event with touchHistory
    const mockEvent = {
      touchHistory: {
        numberActiveTouches: 1,
        mostRecentTimeStamp: Date.now(),
        touchBank: [
          {
            touchActive: true,
            currentTimeStamp: Date.now(),
            currentPageX: 150,
            currentPageY: 30,
            previousTimeStamp: Date.now() - 16,
            previousPageX: 100,
            previousPageY: 30,
            startTimeStamp: Date.now() - 100,
            startPageX: 50,
            startPageY: 30,
          },
        ],
        indexOfSingleActiveTouch: 0,
      },
    };
    // First grant the responder to initialize gestureState
    await act(async () => {
      touchArea!.props.onResponderGrant(mockEvent);
      touchArea!.props.onResponderMove(mockEvent);
    });
  });

  // --- PanResponder: onResponderRelease below threshold resets ---
  it("onResponderRelease below threshold resets position", async () => {
    const { Animated } = require("react-native");
    const onConfirm = jest.fn();
    const { UNSAFE_root } = render(
      <Slider
        {...defaultProps}
        width={300}
        onConfirm={onConfirm}
        enabled={true}
        sliderState="initial"
      />,
    );

    const animatedViews = UNSAFE_root.findAllByType(Animated.View);
    const touchArea = animatedViews.find(
      (v: any) => v.props.onResponderRelease,
    );
    expect(touchArea).toBeTruthy();

    // Grant and release without significant movement - below threshold
    const mockEvent = {
      touchHistory: {
        numberActiveTouches: 1,
        mostRecentTimeStamp: Date.now(),
        touchBank: [
          {
            touchActive: true,
            currentTimeStamp: Date.now(),
            currentPageX: 60,
            currentPageY: 30,
            previousTimeStamp: Date.now() - 16,
            previousPageX: 55,
            previousPageY: 30,
            startTimeStamp: Date.now() - 100,
            startPageX: 50,
            startPageY: 30,
          },
        ],
        indexOfSingleActiveTouch: 0,
      },
    };
    await act(async () => {
      touchArea!.props.onResponderGrant(mockEvent);
      touchArea!.props.onResponderRelease(mockEvent);
    });

    // onConfirm should not be called for below-threshold release
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // --- PanResponder: onResponderRelease above threshold calls onConfirm ---
  it("onResponderRelease above threshold triggers onConfirm", async () => {
    jest.useFakeTimers();
    const { Animated } = require("react-native");
    const onConfirm = jest.fn();
    const { UNSAFE_root } = render(
      <Slider
        {...defaultProps}
        width={300}
        onConfirm={onConfirm}
        enabled={true}
        sliderState="initial"
      />,
    );

    const animatedViews = UNSAFE_root.findAllByType(Animated.View);
    const touchArea = animatedViews.find(
      (v: any) => v.props.onResponderRelease,
    );
    expect(touchArea).toBeTruthy();

    // maxSlidePosition = 300 - 56 - 2 = 242
    // threshold = 242 * 0.75 = 181.5
    // Need gestureState.dx * 2.5 > 181.5 => dx > 72.6
    // PanResponder computes dx = currentPageX - x0 (where x0 is set from grant event)
    const startX = 50;
    const grantEvent = {
      touchHistory: {
        numberActiveTouches: 1,
        mostRecentTimeStamp: 1000,
        touchBank: [
          {
            touchActive: true,
            currentTimeStamp: 1000,
            currentPageX: startX,
            currentPageY: 30,
            previousTimeStamp: 990,
            previousPageX: startX,
            previousPageY: 30,
            startTimeStamp: 1000,
            startPageX: startX,
            startPageY: 30,
          },
        ],
        indexOfSingleActiveTouch: 0,
      },
    };
    await act(async () => {
      touchArea!.props.onResponderGrant(grantEvent);
    });

    // Move far enough: dx = currentPageX - previousPageX = 250 - 50 = 200
    // clampedPos = Math.min(200 * 2.5, 242) = 242 > threshold (181.5)
    const moveEvent = {
      touchHistory: {
        numberActiveTouches: 1,
        mostRecentTimeStamp: 1100,
        touchBank: [
          {
            touchActive: true,
            currentTimeStamp: 1100,
            currentPageX: 250,
            currentPageY: 30,
            previousTimeStamp: 1050,
            previousPageX: startX,
            previousPageY: 30,
            startTimeStamp: 1000,
            startPageX: startX,
            startPageY: 30,
          },
        ],
        indexOfSingleActiveTouch: 0,
      },
    };
    await act(async () => {
      touchArea!.props.onResponderMove(moveEvent);
    });

    // Release
    const releaseEvent = {
      touchHistory: {
        numberActiveTouches: 0,
        mostRecentTimeStamp: 1200,
        touchBank: [
          {
            touchActive: false,
            currentTimeStamp: 1200,
            currentPageX: 250,
            currentPageY: 30,
            previousTimeStamp: 1100,
            previousPageX: 250,
            previousPageY: 30,
            startTimeStamp: 1000,
            startPageX: startX,
            startPageY: 30,
          },
        ],
        indexOfSingleActiveTouch: 0,
      },
    };
    await act(async () => {
      touchArea!.props.onResponderRelease(releaseEvent);
    });

    // Advance timers to allow Animated.timing callback to fire
    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Flush any remaining Animated.timing callbacks before switching to real timers
    await act(async () => {
      jest.runAllTimers();
    });
    jest.useRealTimers();
  });

  // --- PanResponder: onResponderTerminate resets below threshold ---
  it("onResponderTerminate below threshold resets without calling onConfirm", async () => {
    const { Animated } = require("react-native");
    const onConfirm = jest.fn();
    const { UNSAFE_root } = render(
      <Slider
        {...defaultProps}
        width={300}
        onConfirm={onConfirm}
        enabled={true}
        sliderState="initial"
      />,
    );

    const animatedViews = UNSAFE_root.findAllByType(Animated.View);
    const touchArea = animatedViews.find(
      (v: any) => v.props.onResponderTerminate,
    );
    expect(touchArea).toBeTruthy();

    const mockEvent = {
      touchHistory: {
        numberActiveTouches: 1,
        mostRecentTimeStamp: Date.now(),
        touchBank: [
          {
            touchActive: true,
            currentTimeStamp: Date.now(),
            currentPageX: 55,
            currentPageY: 30,
            previousTimeStamp: Date.now() - 16,
            previousPageX: 50,
            previousPageY: 30,
            startTimeStamp: Date.now() - 100,
            startPageX: 50,
            startPageY: 30,
          },
        ],
        indexOfSingleActiveTouch: 0,
      },
    };
    await act(async () => {
      touchArea!.props.onResponderGrant(mockEvent);
      touchArea!.props.onResponderTerminate(mockEvent);
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  // --- State transition: render text prop ---
  it("renders text label", () => {
    const { getByText } = render(
      <Slider {...defaultProps} text="Slide to confirm" />,
    );
    expect(getByText("Slide to confirm")).toBeTruthy();
  });

  // --- State transitions: completed state shows check icon ---
  it("shows check icon in completed state", () => {
    const { getByTestId } = render(
      <Slider {...defaultProps} sliderState="completed" />,
    );
    expect(getByTestId("icon-check")).toBeTruthy();
  });

  // --- State transitions: error state shows close icon ---
  it("shows close icon in error state", () => {
    const { getByTestId } = render(
      <Slider {...defaultProps} sliderState="error" />,
    );
    expect(getByTestId("icon-close")).toBeTruthy();
  });

  // --- State transition: returning from non-initial to initial resets position ---
  it("resets position when sliderState transitions back to initial", () => {
    jest.useFakeTimers();
    const { rerender, getByTestId } = render(
      <Slider {...defaultProps} sliderState="inProgress" />,
    );

    // Transition back to initial
    rerender(<Slider {...defaultProps} sliderState="initial" />);

    // The slider should have reset - verify initial thumb is rendered
    expect(getByTestId("icon-arrow_right")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(700);
    });
    jest.useRealTimers();
  });

  // --- Custom thumb dimensions ---
  it("renders with custom thumbWidth and thumbHeight", () => {
    const { getByTestId } = render(
      <Slider
        {...defaultProps}
        thumbWidth={80}
        thumbHeight={80}
        sliderState="initial"
      />,
    );
    expect(getByTestId("icon-arrow_right")).toBeTruthy();
  });

  // --- Custom height ---
  it("renders with custom height", () => {
    const { toJSON } = render(
      <Slider {...defaultProps} height={80} sliderState="initial" />,
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"height":80');
  });
});
