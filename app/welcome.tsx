import { useRouter } from "expo-router";

import { WelcomeScreen } from "@/components";
import { Routes } from "@/constants";
import { useMarkWelcomeSeen } from "@/stores";

export default function Welcome() {
  const router = useRouter();
  const markWelcomeSeen = useMarkWelcomeSeen();

  const handleGetStarted = () => {
    // Persist completion (fire-and-forget) and leave onboarding for good.
    void markWelcomeSeen();
    router.replace(Routes.home);
  };

  return <WelcomeScreen onGetStarted={handleGetStarted} />;
}
