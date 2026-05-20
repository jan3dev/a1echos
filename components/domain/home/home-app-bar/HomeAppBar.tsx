import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { AppConstants, Routes, TestID } from "@/constants";
import { useIsIncognitoMode, useSetIncognitoMode } from "@/stores";
import { AquaPrimitiveColors, useTheme } from "@/theme";
import { iosPressed } from "@/utils";

import { Icon, IconName } from "../../../ui/icon/Icon";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { TopAppBar } from "../../../ui/top-app-bar/TopAppBar";

interface HomeAppBarProps {
  selectionMode: boolean;
  onDeleteSelected?: () => void;
  onExitSelectionMode?: () => void;
}

interface SurfaceIconButtonProps {
  iconName: IconName;
  iconColor: string;
  onPress: () => void;
  testID?: string;
}

const SurfaceIconButton = ({
  iconName,
  iconColor,
  onPress,
  testID,
}: SurfaceIconButtonProps) => {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.iconButton,
        { backgroundColor: theme.colors.surfaceSecondary },
      ]}
    >
      <RipplePressable
        testID={testID}
        onPress={onPress}
        rippleColor={theme.colors.ripple}
        hitSlop={10}
        style={({ pressed }) => [
          styles.iconButtonInner,
          { opacity: iosPressed(pressed) },
        ]}
      >
        <Icon name={iconName} size={24} color={iconColor} />
      </RipplePressable>
    </View>
  );
};

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
        <SurfaceIconButton
          iconName="chevron_left"
          iconColor={theme.colors.textPrimary}
          onPress={() => onExitSelectionMode?.()}
        />
      );
    }
    return (
      <SurfaceIconButton
        iconName="menu"
        iconColor={theme.colors.textPrimary}
        onPress={() => router.push(Routes.settings)}
        testID={TestID.HomeSettingsButton}
      />
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
        <SurfaceIconButton
          key="trash"
          iconName="trash"
          iconColor={theme.colors.textPrimary}
          onPress={() => onDeleteSelected?.()}
        />,
      ];
    }

    return [
      <SurfaceIconButton
        key="ghost"
        iconName={isIncognitoMode ? "ghost_on" : "ghost"}
        iconColor={theme.colors.textPrimary}
        onPress={handleIncognitoToggle}
      />,
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

const styles = StyleSheet.create({
  iconButton: {
    width: AppConstants.APP_BAR_ICON_BUTTON_SIZE,
    height: AppConstants.APP_BAR_ICON_BUTTON_SIZE,
    borderRadius: AppConstants.APP_BAR_ICON_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: AquaPrimitiveColors.black,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  iconButtonInner: {
    width: AppConstants.APP_BAR_ICON_BUTTON_SIZE,
    height: AppConstants.APP_BAR_ICON_BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
});
