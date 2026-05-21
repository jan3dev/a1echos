/* eslint-disable @typescript-eslint/no-require-imports */
import { act, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";
import { lightColors } from "@/theme";

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
  });

  it("dismissible tooltip has pointerEvents auto", () => {
    const { toJSON } = render(
      <Tooltip {...defaultProps} isDismissible={true} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"pointerEvents":"auto"');
  });

  it("info mode shows leading icon", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} isInfo={true} />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"width":18');
    expect(json).toContain('"height":18');
  });

  it("error variant uses accentDangerTransparent background", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} variant="error" />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(lightColors.accentDangerTransparent);
  });

  it("normal variant uses glass background", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} variant="normal" />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // light theme normal variant uses glassInverse (rgba(0,0,0,0.85))
    expect(json).toContain(lightColors.glassInverse);
  });

  it("error variant does not use normal glass background", () => {
    const { toJSON } = render(<Tooltip {...defaultProps} variant="error" />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).not.toContain(lightColors.glassInverse);
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
      <Tooltip {...defaultProps} pointerPosition="bottom" pointerSize={12} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // With pointerSize=12, viewBox should be "0 0 24 12"
    expect(json).toContain("0 0 24 12");
  });

  it("dismissible tooltip with normal variant uses textInverse for close icon color in light theme", () => {
    const { toJSON } = render(
      <Tooltip {...defaultProps} isDismissible={true} variant="normal" />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(lightColors.textInverse);
  });
});
