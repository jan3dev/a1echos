import type { ReactNode } from "react";

import buttonGallery from "@/components/ui/button/Button.gallery";
import checkboxGallery from "@/components/ui/checkbox/Checkbox.gallery";
import chipGallery from "@/components/ui/chip/Chip.gallery";
import ctaModuleGallery from "@/components/ui/cta-module/CTAModule.gallery";
import dimmerGallery from "@/components/ui/modal/Dimmer.gallery";
import dividerGallery from "@/components/ui/divider/Divider.gallery";
import downloadProgressBarGallery from "@/components/ui/download-progress-bar/DownloadProgressBar.gallery";
import flagIconGallery from "@/components/ui/icon/FlagIcon.gallery";
import glassIconButtonGallery from "@/components/ui/glass-icon-button/GlassIconButton.gallery";
import iconGallery from "@/components/ui/icon/Icon.gallery";
import modalGallery from "@/components/ui/modal/Modal.gallery";
import progressGallery from "@/components/ui/progress/ProgressIndicator.gallery";
import radioGallery from "@/components/ui/radio/Radio.gallery";
import subScreenNavbarGallery from "@/components/ui/sub-screen-navbar/SubScreenNavbar.gallery";
import textGallery from "@/components/ui/text/Text.gallery";
import textFieldGallery from "@/components/ui/textfield/TextField.gallery";
import toastGallery from "@/components/ui/toast/Toast.gallery";
import toggleGallery from "@/components/ui/toggle/Toggle.gallery";
import tooltipGallery from "@/components/ui/tooltip/Tooltip.gallery";
import topAppBarGallery from "@/components/ui/top-app-bar/TopAppBar.gallery";
import ambientGlowGallery from "@/components/shared/ambient-glow/AmbientGlow.gallery";
import errorViewGallery from "@/components/shared/error-view/ErrorView.gallery";
import listItemGallery from "@/components/shared/list-item/ListItem.gallery";
import recordingButtonGallery from "@/components/shared/recording-controls/RecordingButton.gallery";
import scrollToEdgeButtonGallery from "@/components/shared/scroll-to-edge-button/ScrollToEdgeButton.gallery";
import colorsGallery from "@/design-system/colors/Colors.gallery";
import keyboardLayoutsGallery from "@/design-system/keyboard-layouts/KeyboardLayouts.gallery";
import homeGallery from "@/components/domain/home/Home.gallery";
import welcomeScreenGallery from "@/components/domain/onboarding/welcome-screen/WelcomeScreen.gallery";
import sessionGallery from "@/components/domain/session/Session.gallery";
import settingsGallery from "@/components/domain/settings/Settings.gallery";
import transcriptionGallery from "@/components/domain/transcription/Transcription.gallery";

export type GalleryGroup = "UI" | "Shared" | "Domain";

export interface GalleryDemo {
  name: string;
  render: () => ReactNode;
  /**
   * Set when the demo renders its own VirtualizedList (FlatList/SectionList).
   * Such demos are rendered outside the detail page's ScrollView so the inner
   * list doesn't trip the "VirtualizedLists should never be nested inside
   * plain ScrollViews with the same orientation" warning.
   */
  selfScrolling?: boolean;
}

export interface GalleryEntry {
  slug: string;
  title: string;
  group: GalleryGroup;
  demos: GalleryDemo[];
}

export const DESIGN_SYSTEM_MANIFEST: GalleryEntry[] = [
  colorsGallery,
  buttonGallery,
  checkboxGallery,
  chipGallery,
  ctaModuleGallery,
  dimmerGallery,
  dividerGallery,
  flagIconGallery,
  glassIconButtonGallery,
  iconGallery,
  modalGallery,
  downloadProgressBarGallery,
  progressGallery,
  radioGallery,
  subScreenNavbarGallery,
  textGallery,
  textFieldGallery,
  toastGallery,
  toggleGallery,
  tooltipGallery,
  topAppBarGallery,
  ambientGlowGallery,
  errorViewGallery,
  listItemGallery,
  recordingButtonGallery,
  scrollToEdgeButtonGallery,
  keyboardLayoutsGallery,
  homeGallery,
  welcomeScreenGallery,
  sessionGallery,
  settingsGallery,
  transcriptionGallery,
];

export const findGalleryBySlug = (slug: string): GalleryEntry | undefined =>
  DESIGN_SYSTEM_MANIFEST.find((entry) => entry.slug === slug);
