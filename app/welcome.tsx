import { Href, Redirect, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { WelcomeScreen } from "@/components";
import { Routes } from "@/constants";
import { useHasSeenWelcome, useOnboardingStep } from "@/stores";

export default function Welcome() {
  const router = useRouter();
  const hasSeenWelcome = useHasSeenWelcome();
  // Captured once: the store updates on every onboarding step, and only a
  // relaunch mid-onboarding should resume.
  const resumeStep = useRef(useOnboardingStep()).current;

  useEffect(() => {
    if (hasSeenWelcome || !resumeStep) return;
    router.push({ pathname: resumeStep, params: { resumed: "1" } } as Href);
  }, [hasSeenWelcome, resumeStep, router]);

  if (hasSeenWelcome) {
    return <Redirect href={Routes.home} />;
  }

  return (
    <WelcomeScreen
      onGetStarted={() => router.push(Routes.onboardingAllowMicrophone)}
    />
  );
}
