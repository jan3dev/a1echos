import { RefObject } from "react";
import { View } from "react-native";

import { useLocalization } from "@/hooks";
import { getCountryCode } from "@/models";
import { useSelectedLanguage } from "@/stores";
import { useTheme } from "@/theme";

import { FlagIcon } from "../../../ui/icon/FlagIcon";
import { Icon } from "../../../ui/icon/Icon";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { TopAppBar } from "../../../ui/top-app-bar/TopAppBar";

interface SessionAppBarProps {
  sessionName: string;
  selectionMode?: boolean;
  selectionTitle?: string;
  editMode?: boolean;
  isIncognitoSession: boolean;
  onBackPressed?: () => void;
  onTitlePressed?: () => void;
  onLanguageFlagPressed?: () => void;
  onMorePressed?: () => void;
  onExitSelectionPressed?: () => void;
  onCancelEditPressed?: () => void;
  onSaveEditPressed?: () => void;
  blurTarget?: RefObject<View | null>;
}

export const SessionAppBar = ({
  sessionName,
  selectionMode = false,
  selectionTitle,
  editMode = false,
  isIncognitoSession,
  onBackPressed,
  onTitlePressed,
  onLanguageFlagPressed,
  onMorePressed,
  onExitSelectionPressed,
  onCancelEditPressed,
  onSaveEditPressed,
  blurTarget,
}: SessionAppBarProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const selectedLanguage = useSelectedLanguage();

  if (editMode) {
    return (
      <TopAppBar
        title={loc.edit}
        showBackButton={false}
        blurTarget={blurTarget}
        leading={
          <RipplePressable
            onPress={onCancelEditPressed}
            hitSlop={10}
            rippleColor={theme.colors.ripple}
            borderless
          >
            <Icon name="close" size={24} color={theme.colors.textPrimary} />
          </RipplePressable>
        }
        actions={[
          <RipplePressable
            key="save"
            onPress={onSaveEditPressed}
            hitSlop={10}
            rippleColor={theme.colors.ripple}
            borderless
          >
            <Icon name="check" size={24} color={theme.colors.textPrimary} />
          </RipplePressable>,
        ]}
      />
    );
  }

  const trailingAction = selectionMode ? "close" : "more";
  const onTrailingActionPressed = selectionMode
    ? onExitSelectionPressed
    : onMorePressed;

  return (
    <TopAppBar
      title={selectionMode ? (selectionTitle ?? "") : sessionName}
      blurTarget={blurTarget}
      onBackPressed={onBackPressed}
      onTitlePressed={
        !isIncognitoSession && !selectionMode ? onTitlePressed : undefined
      }
      actions={[
        <RipplePressable
          key="language"
          onPress={onLanguageFlagPressed}
          hitSlop={10}
          rippleColor={theme.colors.ripple}
          borderless
        >
          <FlagIcon name={getCountryCode(selectedLanguage)} size={24} />
        </RipplePressable>,
        <RipplePressable
          key={trailingAction}
          onPress={onTrailingActionPressed}
          hitSlop={10}
          rippleColor={theme.colors.ripple}
          borderless
        >
          <Icon
            name={trailingAction}
            size={24}
            color={theme.colors.textPrimary}
          />
        </RipplePressable>,
      ]}
    />
  );
};
