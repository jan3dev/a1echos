import type { ReactNode } from "react";

import buttonGallery from "@/components/ui/button/Button.gallery";
import checkboxGallery from "@/components/ui/checkbox/Checkbox.gallery";
import chipGallery from "@/components/ui/chip/Chip.gallery";
import ctaModuleGallery from "@/components/ui/cta-module/CTAModule.gallery";
import dimmerGallery from "@/components/ui/modal/Dimmer.gallery";
import dividerGallery from "@/components/ui/divider/Divider.gallery";
import flagIconGallery from "@/components/ui/icon/FlagIcon.gallery";
import iconGallery from "@/components/ui/icon/Icon.gallery";
import modalGallery from "@/components/ui/modal/Modal.gallery";
import progressGallery from "@/components/ui/progress/ProgressIndicator.gallery";
import radioGallery from "@/components/ui/radio/Radio.gallery";
import textGallery from "@/components/ui/text/Text.gallery";
import textFieldGallery from "@/components/ui/textfield/TextField.gallery";
import toastGallery from "@/components/ui/toast/Toast.gallery";
import toggleGallery from "@/components/ui/toggle/Toggle.gallery";
import tooltipGallery from "@/components/ui/tooltip/Tooltip.gallery";
import topAppBarGallery from "@/components/ui/top-app-bar/TopAppBar.gallery";
import errorViewGallery from "@/components/shared/error-view/ErrorView.gallery";
import listItemGallery from "@/components/shared/list-item/ListItem.gallery";
import recordingButtonGallery from "@/components/shared/recording-controls/RecordingButton.gallery";
import homeGallery from "@/components/domain/home/Home.gallery";
import sessionGallery from "@/components/domain/session/Session.gallery";
import settingsGallery from "@/components/domain/settings/Settings.gallery";
import transcriptionGallery from "@/components/domain/transcription/Transcription.gallery";

export type GalleryGroup = "UI" | "Shared" | "Domain";

export interface GalleryDemo {
  name: string;
  render: () => ReactNode;
}

export interface GalleryEntry {
  slug: string;
  title: string;
  group: GalleryGroup;
  demos: GalleryDemo[];
}

export const DESIGN_SYSTEM_MANIFEST: GalleryEntry[] = [
  buttonGallery,
  checkboxGallery,
  chipGallery,
  ctaModuleGallery,
  dimmerGallery,
  dividerGallery,
  flagIconGallery,
  iconGallery,
  modalGallery,
  progressGallery,
  radioGallery,
  textGallery,
  textFieldGallery,
  toastGallery,
  toggleGallery,
  tooltipGallery,
  topAppBarGallery,
  errorViewGallery,
  listItemGallery,
  recordingButtonGallery,
  homeGallery,
  sessionGallery,
  settingsGallery,
  transcriptionGallery,
];

export const findGalleryBySlug = (slug: string): GalleryEntry | undefined =>
  DESIGN_SYSTEM_MANIFEST.find((entry) => entry.slug === slug);
