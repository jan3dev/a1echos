import { RefObject } from "react";
import { View } from "react-native";

import { useLocalization } from "@/hooks";
import { useTheme } from "@/theme";

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
  onMorePressed?: () => void;
  onExitSelectionPressed?: () => void;
  onSelectAllPressed?: () => void;
  onCancelEditPressed?: () => void;
  onSaveEditPressed?: () => void;
  blurTarget?: RefObject<View | null>;
  scrolled?: boolean;
}

export const SessionAppBar = ({
  sessionName,
  selectionMode = false,
  selectionTitle,
  editMode = false,
  isIncognitoSession,
  onBackPressed,
  onTitlePressed,
  onMorePressed,
  onExitSelectionPressed,
  onSelectAllPressed,
  onCancelEditPressed,
  onSaveEditPressed,
  blurTarget,
  scrolled = false,
}: SessionAppBarProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();

  if (editMode) {
    return (
      <TopAppBar
        title={loc.edit}
        showBackButton={false}
        blurTarget={blurTarget}
        scrolled={scrolled}
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
      scrolled={scrolled}
      onBackPressed={onBackPressed}
      onTitlePressed={
        !isIncognitoSession && !selectionMode ? onTitlePressed : undefined
      }
      actions={[
        ...(selectionMode
          ? [
              <RipplePressable
                key="select_all"
                onPress={onSelectAllPressed}
                hitSlop={10}
                rippleColor={theme.colors.ripple}
                borderless
              >
                <Icon
                  name="select_all"
                  size={24}
                  color={theme.colors.textPrimary}
                />
              </RipplePressable>,
            ]
          : []),
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
