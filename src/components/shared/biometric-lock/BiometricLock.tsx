import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  useColorScheme,
} from "react-native";

import { TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { useBiometricAuthEnabled } from "@/stores";

import {
  authenticateBiometric,
  isBiometricAuthInFlight,
} from "./biometricAuth";

// Mirrors the expo-splash-screen config in app.json, which follows the system
// scheme rather than the in-app theme.
const SPLASH = {
  light: { image: require("@/assets/images/icon.png"), background: "#ffffff" },
  dark: {
    image: require("@/assets/images/icon-dark.png"),
    background: "#000000",
  },
};

export const BiometricLockView = ({ onUnlock }: { onUnlock: () => void }) => {
  const { loc } = useLocalization();
  const splash = SPLASH[useColorScheme() === "dark" ? "dark" : "light"];

  return (
    <Pressable
      testID={TestID.BiometricLockScreen}
      accessibilityRole="button"
      accessibilityLabel={loc.biometricAuthPrompt}
      onPress={onUnlock}
      style={[styles.container, { backgroundColor: splash.background }]}
    >
      <Image source={splash.image} style={styles.image} resizeMode="contain" />
    </Pressable>
  );
};

export const BiometricLock = () => {
  const enabled = useBiometricAuthEnabled();
  const { loc } = useLocalization();
  const [locked, setLocked] = useState(enabled);
  // A background launch (headless/foreground-service start) prompts on the
  // first "active" instead of at mount.
  const wasBackgrounded = useRef(AppState.currentState !== "active");

  const unlock = useCallback(async () => {
    const result = await authenticateBiometric(loc.biometricAuthPrompt);
    // "unavailable": the device lost its passcode/biometrics, so there is no
    // way to authenticate; staying locked would strand the user's data.
    if (result !== "failed") setLocked(false);
  }, [loc]);

  // Only a real background trip re-locks: the system auth prompt itself
  // bounces iOS through "inactive", which would otherwise re-prompt forever.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" && !isBiometricAuthInFlight()) {
        wasBackgrounded.current = true;
        setLocked(true);
      } else if (state === "active" && wasBackgrounded.current) {
        wasBackgrounded.current = false;
        void unlock();
      }
    });
    return () => sub.remove();
  }, [enabled, unlock]);

  useEffect(() => {
    if (enabled && AppState.currentState === "active") void unlock();
    // Cold start only; later prompts come from the AppState listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal
      visible={enabled && locked}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => undefined}
      supportedOrientations={["portrait", "portrait-upside-down", "landscape"]}
    >
      <BiometricLockView onUnlock={() => void unlock()} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: 200,
    height: 200,
  },
});
