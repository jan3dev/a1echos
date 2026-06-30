import { render } from "@testing-library/react-native";

import { AmbientGlow } from "./AmbientGlow";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Reanimated = require("react-native-reanimated") as {
  useReducedMotion: jest.Mock;
  withRepeat: jest.Mock;
  cancelAnimation: jest.Mock;
};

describe("AmbientGlow", () => {
  it("renders with a testID", () => {
    const { getByTestId } = render(<AmbientGlow testID="glow" />);
    expect(getByTestId("glow")).toBeTruthy();
  });

  it("starts the drift/pulse animation when animated", () => {
    render(<AmbientGlow testID="glow" />);
    expect(Reanimated.withRepeat).toHaveBeenCalled();
  });

  it("cancels animations on unmount", () => {
    const { unmount } = render(<AmbientGlow testID="glow" />);
    unmount();
    expect(Reanimated.cancelAnimation).toHaveBeenCalled();
  });

  it("does not animate when animated is false", () => {
    Reanimated.withRepeat.mockClear();
    render(<AmbientGlow testID="glow" animated={false} />);
    expect(Reanimated.withRepeat).not.toHaveBeenCalled();
  });

  it("does not animate under reduced motion", () => {
    Reanimated.useReducedMotion.mockReturnValueOnce(true);
    Reanimated.withRepeat.mockClear();
    render(<AmbientGlow testID="glow" />);
    expect(Reanimated.withRepeat).not.toHaveBeenCalled();
  });

  it("accepts custom accent colors and intensity", () => {
    const { getByTestId } = render(
      <AmbientGlow
        testID="glow"
        accentLeft="#112233"
        accentRight="#445566"
        intensity={0.9}
      />,
    );
    expect(getByTestId("glow")).toBeTruthy();
  });
});
