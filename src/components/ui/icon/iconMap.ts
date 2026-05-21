import { FC } from "react";
import { SvgProps } from "react-native-svg";

import Check from "@/assets/icons/check.svg";
import ChevronLeft from "@/assets/icons/chevron_left.svg";
import ChevronRight from "@/assets/icons/chevron_right.svg";
import CircularProgress from "@/assets/icons/circular_progress.svg";
import Close from "@/assets/icons/close.svg";
import CloseCircle from "@/assets/icons/close_circle.svg";
import Copy from "@/assets/icons/copy.svg";
import Danger from "@/assets/icons/danger.svg";
import Download from "@/assets/icons/download.svg";
import EchosLogo from "@/assets/icons/echos_logo.svg";
import Edit from "@/assets/icons/edit.svg";
import Export from "@/assets/icons/export.svg";
import Flash from "@/assets/icons/flash.svg";
import FooterLogo from "@/assets/icons/footer_logo.svg";
import Ghost from "@/assets/icons/ghost.svg";
import GhostOn from "@/assets/icons/ghost_on.svg";
import Globe from "@/assets/icons/globe.svg";
import HelpSupport from "@/assets/icons/help_support.svg";
import InfoCircle from "@/assets/icons/info_circle.svg";
import Language from "@/assets/icons/language.svg";
import Menu from "@/assets/icons/menu.svg";
import Mic from "@/assets/icons/mic.svg";
import More from "@/assets/icons/more.svg";
import Paste from "@/assets/icons/paste.svg";
import Rectangle from "@/assets/icons/rectangle.svg";
import RotateLeft from "@/assets/icons/rotate_left.svg";
import SelectAll from "@/assets/icons/select_all.svg";
import Settings from "@/assets/icons/settings.svg";
import Theme from "@/assets/icons/theme.svg";
import Timer from "@/assets/icons/timer.svg";
import Trash from "@/assets/icons/trash.svg";
import VoiceCircle from "@/assets/icons/voice_circle.svg";
import Warning from "@/assets/icons/warning.svg";

export const iconMap: Record<string, FC<SvgProps>> = {
  check: Check,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  circular_progress: CircularProgress,
  close: Close,
  close_circle: CloseCircle,
  copy: Copy,
  danger: Danger,
  download: Download,
  echos_logo: EchosLogo,
  edit: Edit,
  export: Export,
  flash: Flash,
  footer_logo: FooterLogo,
  ghost: Ghost,
  ghost_on: GhostOn,
  globe: Globe,
  help_support: HelpSupport,
  info_circle: InfoCircle,
  language: Language,
  menu: Menu,
  mic: Mic,
  more: More,
  paste: Paste,
  rectangle: Rectangle,
  rotate_left: RotateLeft,
  select_all: SelectAll,
  settings: Settings,
  theme: Theme,
  timer: Timer,
  trash: Trash,
  voice_circle: VoiceCircle,
  warning: Warning,
};

export type IconName = keyof typeof iconMap;
