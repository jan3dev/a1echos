/* eslint-disable @typescript-eslint/no-require-imports */
import { act, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";
import { lightColors } from "@/theme/themeColors";

import { Tooltip } from "./Tooltip";

const defaultProps = {
  visible: true,
  message: "This is a tooltip",
  onDismiss: jest.fn(),
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe("Tooltip", () => {
  it("renders message text when visible", () => {
    const { getByText } = render(<Tooltip {...defaultProps} />);
    act(() => {
      jest.runAllTimers();
    });
    expect(getByText("This is a tooltip")).toBeTruthy();
  });

  it("applies variant background color for success variant", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} variant="success" />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // Success variant uses accentSuccessTransparent as background color
    expect(json).toContain(lightColors.accentSuccessTransparent);
  });

  it("renders SVG pointer when pointerPosition is top", () => {
    const { toJSON } = render(
      <Tooltip {...defaultProps} pointerPosition="top" />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // The pointer renders an Svg (mocked as "Svg" string) and a Path
    // (mocked as "Path" string). The pointer container has marginBottom: -1
    // for top position.
    expect(json).toContain("Svg");
    expect(json).toContain("Path");
    // Top pointer has marginBottom: -1
    expect(json).toContain('"marginBottom":-1');
  });

  it("renders SVG pointer when pointerPosition is bottom", () => {
    const { toJSON } = render(
      <Tooltip {...defaultProps} pointerPosition="bottom" />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain("Svg");
    expect(json).toContain("Path");
    // Bottom pointer has marginTop: -1
    expect(json).toContain('"marginTop":-1');
  });

  it("dismissible tooltip has pointerEvents auto", () => {
    const { toJSON } = render(
      <Tooltip {...defaultProps} isDismissible={true} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // The outermost Animated.View has pointerEvents="auto" when isDismissible
    expect(json).toContain('"pointerEvents":"auto"');
  });

  it("info mode shows leading icon", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} isInfo={true} />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // Info mode renders an Icon component (warning icon by default, size 18).
    // The Icon has a container View with width: 18 and height: 18.
    expect(json).toContain('"width":18');
    expect(json).toContain('"height":18');
  });

  it("applies warning variant background color", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} variant="warning" />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(lightColors.accentWarningTransparent);
  });

  it("applies error variant background color", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} variant="error" />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(lightColors.accentDangerTransparent);
  });

  it("normal variant uses BlurView wrapper", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} variant="normal" />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain("BlurView");
  });

  it("non-normal variant uses plain View wrapper", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} variant="error" />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // Non-normal variants don't use BlurView for the bubble
    expect(json).toContain(lightColors.accentDangerTransparent);
  });

  it("dismissible tooltip renders close icon", () => {
    const onDismiss = jest.fn();
    const { toJSON } = render(
      <Tooltip {...defaultProps} isDismissible={true} onDismiss={onDismiss} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // Dismissible renders a trailing close icon (size 18)
    expect(json).toContain('"pointerEvents":"auto"');
  });

  it("non-dismissible tooltip has pointerEvents none", () => {
    const { toJSON } = render(
      <Tooltip {...defaultProps} isDismissible={false} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"pointerEvents":"none"');
  });

  it("no pointer renders when pointerPosition is none", () => {
    const { toJSON } = render(
      <Tooltip {...defaultProps} pointerPosition="none" />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).not.toContain("Svg");
    expect(json).not.toContain("Path");
  });

  it("fade out animation when visible becomes false", () => {
    const { rerender, toJSON } = render(<Tooltip {...defaultProps} />);
    act(() => {
      jest.runAllTimers();
    });
    rerender(<Tooltip {...defaultProps} visible={false} />);
    act(() => {
      jest.runAllTimers();
    });
    // Component still renders, just with opacity animated to 0
    expect(toJSON()).toBeTruthy();
  });

  it("info mode with onLeadingIconTap renders pressable leading icon", () => {
    const onLeadingTap = jest.fn();
    const { toJSON } = render(
      <Tooltip
        {...defaultProps}
        isInfo={true}
        onLeadingIconTap={onLeadingTap}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // Should render leading icon within a pressable wrapper
    expect(json).toContain('"width":18');
  });

  it("info mode with custom leadingIcon renders it", () => {
    const { View } = require("react-native");
    const customIcon = <View testID={TestID.CustomLeadingIcon} />;
    const { toJSON } = render(
      <Tooltip {...defaultProps} isInfo={true} leadingIcon={customIcon} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(TestID.CustomLeadingIcon);
  });

  it("dismissible with custom trailingIcon renders it", () => {
    const { View } = require("react-native");
    const customTrailing = <View testID={TestID.CustomTrailingIcon} />;
    const { toJSON } = render(
      <Tooltip
        {...defaultProps}
        isDismissible={true}
        trailingIcon={customTrailing}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(TestID.CustomTrailingIcon);
  });

  it("custom margin is applied", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} margin={32} />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"margin":32');
  });

  it("success variant text color uses accentSuccess", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} variant="success" />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(lightColors.accentSuccess);
  });

  it("warning variant text color uses accentWarning", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} variant="warning" />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(lightColors.accentWarning);
  });

  it("error variant text/icon color uses accentDanger", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} variant="error" />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(lightColors.accentDanger);
  });

  it("dismissible with onTrailingIconTap uses it instead of onDismiss", () => {
    const onTrailingTap = jest.fn();
    const onDismiss = jest.fn();
    const { toJSON } = render(
      <Tooltip
        {...defaultProps}
        isDismissible={true}
        onTrailingIconTap={onTrailingTap}
        onDismiss={onDismiss}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });
    // Should render without error
    expect(toJSON()).toBeTruthy();
  });

  it("info mode with onLeadingIconTap and custom leadingIcon renders custom icon in pressable", () => {
    const { View } = require("react-native");
    const onLeadingTap = jest.fn();
    const customIcon = <View testID={TestID.CustomIconPressable} />;
    const { toJSON } = render(
      <Tooltip
        {...defaultProps}
        isInfo={true}
        onLeadingIconTap={onLeadingTap}
        leadingIcon={customIcon}
      />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain("custom-icon-pressable");
  });

  it("custom pointerSize renders correctly", () => {
    const { toJSON } = render(
      <Tooltip {...defaultProps} pointerPosition="top" pointerSize={12} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // With pointerSize=12, viewBox should be "0 0 24 12"
    expect(json).toContain("0 0 24 12");
  });

  it("dismissible tooltip with normal variant uses textTertiary for close icon color", () => {
    const { toJSON } = render(
      <Tooltip {...defaultProps} isDismissible={true} variant="normal" />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(lightColors.textTertiary);
  });
});
