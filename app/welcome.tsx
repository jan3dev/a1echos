import { Redirect, useRouter } from "expo-router";

import { WelcomeScreen } from "@/components";
import { Routes } from "@/constants";
import { useHasSeenWelcome } from "@/stores";

export default function Welcome() {
  const router = useRouter();
  const hasSeenWelcome = useHasSeenWelcome();

  if (hasSeenWelcome) {
    return <Redirect href={Routes.home} />;
  }

  return (
    <WelcomeScreen
      onGetStarted={() => router.push(Routes.onboardingAllowMicrophone)}
    />
  );
}
