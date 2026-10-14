import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, AppState, Modal, StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";

import { TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { useBiometricAuthEnabled, useSetAppLocked } from "@/stores";
import { darkColors, spacing } from "@/theme";

import { GlowCtaButton } from "../../ui/glow-cta-button/GlowCtaButton";
import { Icon } from "../../ui/icon/Icon";

import {
  authenticateBiometric,
  isBiometricAuthInFlight,
} from "./biometricAuth";
import { UnlockGradient } from "./UnlockGradient";

const LOGO_WIDTH = 193;
const LOGO_HEIGHT = 62;
const GRADIENT_FADE_IN_MS = 300;
const UNLOCK_FADE_OUT_MS = 200;

export const BiometricLockView = ({
  showUnlock,
  onUnlock,
}: {
  showUnlock: boolean;
  onUnlock: () => void;
}) => {
  const { loc } = useLocalization();
  const gradientOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(gradientOpacity, {
      toValue: 1,
      duration: GRADIENT_FADE_IN_MS,
      useNativeDriver: true,
    }).start();
  }, [gradientOpacity]);

  return (
    <View
      testID={TestID.BiometricLockScreen}
      // A transparent Modal keeps the app in the iOS window; hide it from VoiceOver.
      accessibilityViewIsModal
      style={styles.container}
    >
      <SystemBars style="light" />
      {/* The native splash (app.json) is this screen's logo on the same
          background, so only the gradient fades in when JS takes over. */}
      <Animated.View style={[styles.fill, { opacity: gradientOpacity }]}>
        <UnlockGradient />
      </Animated.View>
      <View accessible accessibilityRole="image" accessibilityLabel="Echos">
        <Icon
          name="echos_logo"
          size={LOGO_WIDTH}
          style={styles.logo}
          color={darkColors.textPrimary}
        />
      </View>
      {/* Out of flow so the logo stays at screen center, where the splash draws it. */}
      <View style={styles.unlockSlot}>
        {showUnlock && (
          <GlowCtaButton
            text={loc.biometricUnlock}
            onPress={onUnlock}
            testID={TestID.BiometricUnlockButton}
          />
        )}
      </View>
    </View>
  );
};

export const BiometricLock = () => {
  const enabled = useBiometricAuthEnabled();
  const { loc } = useLocalization();
  const [locked, setLocked] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  // Blocks a second tap on Unlock from re-prompting during the fade-out.
  const fadingOut = useRef(false);
  // A background launch (headless/foreground-service start) prompts on the
  // first "active" instead of at mount.
  const wasBackgrounded = useRef(AppState.currentState !== "active");
  const setAppLocked = useSetAppLocked();
  const isShown = enabled && locked;

  useEffect(() => {
    setAppLocked(isShown);
  }, [isShown, setAppLocked]);

  const unlock = useCallback(async () => {
    if (fadingOut.current) return;
    const result = await authenticateBiometric(loc.biometricAuthPrompt);
    if (result === "failed") {
      setFailed(true);
      return;
    }
    // "unavailable": the device lost its passcode/biometrics, so there is no
    // way to authenticate; staying locked would strand the user's data.
    fadingOut.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: UNLOCK_FADE_OUT_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setLocked(false);
    });
  }, [loc, opacity]);

  // Only a real background trip re-locks: the system auth prompt itself
  // bounces iOS through "inactive", which would otherwise re-prompt forever.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" && !isBiometricAuthInFlight()) {
        wasBackgrounded.current = true;
        fadingOut.current = false;
        opacity.setValue(1);
        setFailed(false);
        setLocked(true);
      } else if (state === "active" && wasBackgrounded.current) {
        wasBackgrounded.current = false;
        void unlock();
      }
    });
    return () => sub.remove();
  }, [enabled, unlock, opacity]);

  useEffect(() => {
    if (enabled && AppState.currentState === "active") void unlock();
    // Cold start only; later prompts come from the AppState listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal
      visible={isShown}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => undefined}
      supportedOrientations={["portrait", "portrait-upside-down", "landscape"]}
    >
      <Animated.View
        style={[styles.fill, { opacity }]}
        onLayout={() => void SplashScreen.hideAsync()}
      >
        <BiometricLockView showUnlock={failed} onUnlock={() => void unlock()} />
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: darkColors.surfaceBackground,
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  unlockSlot: {
    position: "absolute",
    top: "50%",
    marginTop: LOGO_HEIGHT / 2 + spacing.xxxl,
  },
});
