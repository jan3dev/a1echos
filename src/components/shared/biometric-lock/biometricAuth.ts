import * as LocalAuthentication from "expo-local-authentication";

import { FeatureFlag, logError } from "@/utils";

export type BiometricAuthResult = "success" | "unavailable" | "failed";

const UNAVAILABLE_ERRORS: LocalAuthentication.LocalAuthenticationError[] = [
  "not_available",
  "not_enrolled",
  "passcode_not_set",
];

let inFlight = false;

/** True while a system auth prompt is up. Android's PIN fallback pauses the
 *  activity (AppState "background"), which must not count as leaving the app. */
export const isBiometricAuthInFlight = () => inFlight;

export const authenticateBiometric = async (
  promptMessage: string,
): Promise<BiometricAuthResult> => {
  if (inFlight) return "failed";
  inFlight = true;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
    });
    if (result.success) return "success";
    return UNAVAILABLE_ERRORS.includes(result.error) ? "unavailable" : "failed";
  } catch (error) {
    logError(error, {
      flag: FeatureFlag.general,
      message: "Biometric authentication failed",
    });
    return "failed";
  } finally {
    inFlight = false;
  }
};
