import { useRouter } from "expo-router";
import { Pressable } from "react-native";

import { Routes, TestID } from "@/constants";
import { useIsIncognitoMode, useSetIncognitoMode } from "@/stores";
import { useTheme } from "@/theme";
import { iosPressed } from "@/utils";

import { GlassIconButton } from "../../../ui/glass-icon-button/GlassIconButton";
import { Icon } from "../../../ui/icon/Icon";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { TopAppBar } from "../../../ui/top-app-bar/TopAppBar";

interface HomeAppBarProps {
  selectionMode: boolean;
  onDeleteSelected?: () => void;
  onExitSelectionMode?: () => void;
}

export const HomeAppBar = ({
  selectionMode,
  onDeleteSelected,
  onExitSelectionMode,
}: HomeAppBarProps) => {
  const { theme } = useTheme();
  const router = useRouter();
  const isIncognitoMode = useIsIncognitoMode();
  const setIncognitoMode = useSetIncognitoMode();

  const handleIncognitoToggle = async () => {
    await setIncognitoMode(!isIncognitoMode);
  };

  const renderLeading = () => {
    if (selectionMode) {
      return (
        <RipplePressable
          onPress={() => onExitSelectionMode?.()}
          hitSlop={10}
          rippleColor={theme.colors.ripple}
          borderless
          accessibilityRole="button"
          accessibilityLabel="Exit selection mode"
          style={({ pressed }) => ({ opacity: iosPressed(pressed) })}
        >
          <Icon
            name="chevron_left"
            size={24}
            color={theme.colors.textPrimary}
          />
        </RipplePressable>
      );
    }
    return (
      <GlassIconButton
        onPress={() => router.push(Routes.settings)}
        accessibilityLabel="Settings"
        testID={TestID.HomeSettingsButton}
      >
        <Icon name="menu" size={24} color={theme.colors.textPrimary} />
      </GlassIconButton>
    );
  };

  const renderTitleWidget = () => {
    if (selectionMode) return undefined;
    return (
      <Pressable
        onLongPress={() => {
          if (__DEV__) router.push(Routes.designSystem);
        }}
        delayLongPress={600}
      >
        <Icon
          name="echos_logo"
          size={75}
          style={{ width: 75, height: 24 }}
          color={theme.colors.textPrimary}
        />
      </Pressable>
    );
  };

  const renderActions = () => {
    if (selectionMode) {
      return [
        <GlassIconButton
          key="trash"
          onPress={() => onDeleteSelected?.()}
          accessibilityLabel="Delete selected"
        >
          <Icon name="trash" size={24} color={theme.colors.textPrimary} />
        </GlassIconButton>,
      ];
    }

    return [
      <GlassIconButton
        key="ghost"
        onPress={handleIncognitoToggle}
        accessibilityLabel={
          isIncognitoMode ? "Disable incognito mode" : "Enable incognito mode"
        }
        accessibilityState={{ selected: isIncognitoMode }}
      >
        <Icon
          name={isIncognitoMode ? "ghost_on" : "ghost"}
          size={24}
          color={theme.colors.textPrimary}
        />
      </GlassIconButton>,
    ];
  };

  return (
    <TopAppBar
      showBackButton={false}
      leading={renderLeading()}
      titleWidget={renderTitleWidget()}
      actions={renderActions()}
    />
  );
};
