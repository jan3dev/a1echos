import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, StyleSheet, View } from "react-native";

import { TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { useBiometricAuthEnabled } from "@/stores";
import { useTheme } from "@/theme";

import { Button } from "../../ui/button/Button";
import { Icon } from "../../ui/icon/Icon";
import { Text } from "../../ui/text/Text";

import {
  authenticateBiometric,
  isBiometricAuthInFlight,
} from "./biometricAuth";

export const BiometricLockView = ({ onUnlock }: { onUnlock: () => void }) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();

  return (
    <View
      testID={TestID.BiometricLockScreen}
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <Icon
        name="biometric_fingerprint"
        size={64}
        color={theme.colors.textSecondary}
      />
      <Text
        variant="h3"
        align="center"
        style={styles.title}
        accessibilityRole="header"
      >
        {loc.biometricAuthPrompt}
      </Text>
      <View style={styles.button}>
        <Button.primary
          testID={TestID.BiometricLockUnlockButton}
          text={loc.biometricAuthUnlock}
          onPress={onUnlock}
        />
      </View>
    </View>
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
    padding: 24,
  },
  title: {
    marginTop: 24,
  },
  button: {
    marginTop: 32,
    alignSelf: "stretch",
  },
});
