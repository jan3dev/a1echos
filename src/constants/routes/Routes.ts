import type { Href } from "expo-router";

/**
 * Central list of app routes. Centralized here because Expo Router's generated
 * `.expo/types/router.d.ts` only re-exports generic types in this project, so
 * literal paths like `"/settings/model"` don't type-check as valid `Href`s.
 * Isolating the cast here keeps call sites clean and gives us a single place
 * to rename routes if the file structure moves.
 */
export const Routes = {
  home: "/" as Href,
  welcome: "/welcome" as Href,
  onboardingAllowMicrophone: "/onboarding/allow-microphone" as Href,
  onboardingEnableKeyboard: "/onboarding/enable-keyboard" as Href,
  onboardingSpokenLanguage: "/onboarding/spoken-language" as Href,
  onboardingTryLargerModel: "/onboarding/try-larger-model" as Href,
  onboardingTutorialIntro: "/onboarding/tutorial-intro" as Href,
  onboardingSwitchKeyboard: "/onboarding/switch-keyboard" as Href,
  onboardingDictate: "/onboarding/dictate" as Href,
  onboardingAutocorrect: "/onboarding/autocorrect" as Href,
  onboardingRecord: "/onboarding/record" as Href,
  onboardingPrivacy: "/onboarding/privacy" as Href,
  onboardingAllSet: "/onboarding/all-set" as Href,
  session: (id: string): Href =>
    ({ pathname: "/session/[id]", params: { id } }) as unknown as Href,
  settings: "/settings" as Href,
  settingsModel: "/settings/model" as Href,
  settingsTheme: "/settings/theme" as Href,
  settingsLanguage: "/settings/language" as Href,
  settingsAdvanced: "/settings/advanced" as Href,
  settingsMicTimeout: "/settings/microphone-timeout" as Href,
  settingsModelLanguages: (modelId: string): Href =>
    ({
      pathname: "/settings/model-languages",
      params: { modelId },
    }) as unknown as Href,
  designSystem: "/(dev)/design-system" as Href,
  designSystemDetail: (slug: string): Href =>
    ({
      pathname: "/(dev)/design-system/[slug]",
      params: { slug },
    }) as unknown as Href,
} as const;
