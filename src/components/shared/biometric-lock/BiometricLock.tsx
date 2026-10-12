import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, AppState, Modal, StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { useBiometricAuthEnabled } from "@/stores";
import { darkColors, spacing } from "@/theme";

import { GlowCtaButton } from "../../ui/glow-cta-button/GlowCtaButton";
import { Icon } from "../../ui/icon/Icon";

import {
  authenticateBiometric,
  isBiometricAuthInFlight,
} from "./biometricAuth";
import { UnlockGradient } from "./UnlockGradient";

const LOGO_WIDTH = 193;
const LOGO_FADE_IN_MS = 150;
const UNLOCK_FADE_OUT_MS = 200;

export const BiometricLockView = ({
  showUnlock,
  onUnlock,
}: {
  showUnlock: boolean;
  onUnlock: () => void;
}) => {
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: LOGO_FADE_IN_MS,
      useNativeDriver: true,
    }).start();
  }, [logoOpacity]);

  return (
    <View
      testID={TestID.BiometricLockScreen}
      // A transparent Modal keeps the app in the iOS window; hide it from VoiceOver.
      accessibilityViewIsModal
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <SystemBars style="light" />
      <UnlockGradient />
      <Animated.View
        style={{ opacity: logoOpacity }}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Echos"
      >
        <Icon
          name="echos_logo"
          size={LOGO_WIDTH}
          style={styles.logo}
          color={darkColors.textPrimary}
        />
      </Animated.View>
      {/* The slot is always laid out so the logo doesn't jump when the button appears. */}
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
      visible={enabled && locked}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => undefined}
      supportedOrientations={["portrait", "portrait-upside-down", "landscape"]}
    >
      <Animated.View style={[styles.fill, { opacity }]}>
        <BiometricLockView showUnlock={failed} onUnlock={() => void unlock()} />
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xxxl,
    backgroundColor: darkColors.surfaceBackground,
  },
  logo: {
    width: LOGO_WIDTH,
    height: 62,
  },
  unlockSlot: {
    minWidth: 199,
    minHeight: 56,
  },
});
