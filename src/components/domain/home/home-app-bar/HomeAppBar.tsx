import { useRouter } from "expo-router";
import { RefObject } from "react";
import { Pressable, View } from "react-native";

import { Routes, TestID } from "@/constants";
import { useIsIncognitoMode, useSetIncognitoMode } from "@/stores";
import { useTheme } from "@/theme";

import { GlassIconButton } from "../../../ui/glass-icon-button/GlassIconButton";
import { Icon } from "../../../ui/icon/Icon";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { TopAppBar } from "../../../ui/top-app-bar/TopAppBar";

interface HomeAppBarProps {
  selectionMode?: boolean;
  selectionTitle?: string;
  onExitSelectionPressed?: () => void;
  blurTarget?: RefObject<View | null>;
  scrolled?: boolean;
}

export const HomeAppBar = ({
  selectionMode = false,
  selectionTitle,
  onExitSelectionPressed,
  blurTarget,
  scrolled = false,
}: HomeAppBarProps) => {
  const { theme } = useTheme();
  const router = useRouter();
  const isIncognitoMode = useIsIncognitoMode();
  const setIncognitoMode = useSetIncognitoMode();

  const handleIncognitoToggle = async () => {
    await setIncognitoMode(!isIncognitoMode);
  };

  if (selectionMode) {
    return (
      <TopAppBar
        title={selectionTitle ?? ""}
        showBackButton={false}
        blurTarget={blurTarget}
        scrolled={scrolled}
        leading={
          <RipplePressable
            onPress={() => onExitSelectionPressed?.()}
            hitSlop={10}
            rippleColor={theme.colors.ripple}
            borderless
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Icon
              name="chevron_left"
              size={24}
              color={theme.colors.textPrimary}
            />
          </RipplePressable>
        }
        actions={[
          <RipplePressable
            key="close"
            onPress={() => onExitSelectionPressed?.()}
            hitSlop={10}
            rippleColor={theme.colors.ripple}
            borderless
            accessibilityRole="button"
            accessibilityLabel="Exit selection mode"
          >
            <Icon name="close" size={24} color={theme.colors.textPrimary} />
          </RipplePressable>,
        ]}
      />
    );
  }

  const leading = (
    <GlassIconButton
      onPress={() => router.push(Routes.settings)}
      accessibilityLabel="Settings"
      testID={TestID.HomeSettingsButton}
    >
      <Icon name="menu" size={24} color={theme.colors.textPrimary} />
    </GlassIconButton>
  );

  const titleWidget = (
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

  const actions = [
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

  return (
    <TopAppBar
      showBackButton={false}
      blurTarget={blurTarget}
      scrolled={scrolled}
      leading={leading}
      titleWidget={titleWidget}
      actions={actions}
    />
  );
};
