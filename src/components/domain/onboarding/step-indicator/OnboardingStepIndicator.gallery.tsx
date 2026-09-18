import { View } from "react-native";

import { OnboardingStepIndicator } from "@/components";
import { AppConstants } from "@/constants";
import type { GalleryEntry } from "@/design-system/manifest";
import { darkColors, spacing } from "@/theme";

const TOTAL_STEPS = AppConstants.ONBOARDING_STEP_COUNT;

const Frame = ({ step }: { step: number }) => (
  <View
    style={{
      padding: spacing.md,
      backgroundColor: darkColors.surfaceBackground,
      alignItems: "center",
    }}
  >
    <OnboardingStepIndicator step={step} totalSteps={TOTAL_STEPS} />
  </View>
);

const gallery: GalleryEntry = {
  slug: "onboarding-step-indicator",
  title: "Onboarding Step Indicator",
  group: "Domain",
  demos: [
    { name: "Step 1", render: () => <Frame step={1} /> },
    { name: "Step 2", render: () => <Frame step={2} /> },
    {
      name: `Step ${TOTAL_STEPS}`,
      render: () => <Frame step={TOTAL_STEPS} />,
    },
  ],
};

export default gallery;
