import { render } from "@testing-library/react-native";

import { DownloadProgressBar } from "./DownloadProgressBar";

const widthOf = (
  testID: string,
  ratio: number,
): string | number | undefined => {
  const { getByTestId } = render(
    <DownloadProgressBar ratio={ratio} testID={testID} />,
  );
  const track = getByTestId(testID);
  const fill = track.children[0] as { props: { style: { width?: string }[] } };
  return fill.props.style.flat().find((s) => s && "width" in s)?.width;
};

describe("DownloadProgressBar", () => {
  it("renders the fill proportional to the ratio", () => {
    expect(widthOf("bar-half", 0.5)).toBe("50%");
  });

  it("reports progress to assistive tech as a percentage", () => {
    const { getByTestId } = render(
      <DownloadProgressBar ratio={0.42} testID="bar-a11y" />,
    );
    const track = getByTestId("bar-a11y");
    expect(track.props.accessibilityRole).toBe("progressbar");
    expect(track.props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 42,
    });
  });

  // A ratio out of range would otherwise paint the fill past the track, and a
  // NaN one would collapse it to an invisible "stuck at zero".
  it.each([
    [-1, "0%"],
    [2, "100%"],
    [NaN, "0%"],
  ])("clamps a ratio of %p to %s", (ratio, expected) => {
    expect(widthOf(`bar-${String(ratio)}`, ratio)).toBe(expected);
  });
});
