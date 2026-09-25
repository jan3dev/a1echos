import { useRouter } from "expo-router";

import { PrivacyScreen } from "@/components";
import { Routes } from "@/constants";

export default function Privacy() {
  const router = useRouter();

  return (
    <PrivacyScreen
      testID="privacy"
      onBack={router.back}
      onNext={() => router.push(Routes.onboardingAllSet)}
    />
  );
}
