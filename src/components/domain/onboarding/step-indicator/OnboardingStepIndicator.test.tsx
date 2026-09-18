import { render } from "@testing-library/react-native";

import { darkColors } from "@/theme";

import { OnboardingStepIndicator } from "./OnboardingStepIndicator";

describe("OnboardingStepIndicator", () => {
  it("renders one dot per step and widens only the active one", () => {
    const { getByTestId } = render(
      <OnboardingStepIndicator step={2} totalSteps={4} testID="steps" />,
    );
    expect(getByTestId("steps").children).toHaveLength(4);
    expect(getByTestId("steps-dot-2")).toHaveStyle({
      width: 24,
      backgroundColor: darkColors.textPrimary,
    });
    expect(getByTestId("steps-dot-1")).toHaveStyle({
      width: 6,
      backgroundColor: darkColors.surfaceTertiary,
    });
    expect(getByTestId("steps").props.accessibilityValue).toEqual({
      min: 1,
      max: 4,
      now: 2,
    });
  });

  it("renders without a testID", () => {
    const { toJSON } = render(
      <OnboardingStepIndicator step={1} totalSteps={3} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
