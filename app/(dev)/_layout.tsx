import { Redirect, Stack } from "expo-router";

import { AppErrorBoundary } from "@/components/shared/error-view";
import { Routes } from "@/constants";

export default function DevLayout() {
  if (!__DEV__) {
    return <Redirect href={Routes.home} />;
  }

  return (
    <AppErrorBoundary>
      <Stack screenOptions={{ headerShown: false }} />
    </AppErrorBoundary>
  );
}
