import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppConstants, Routes, TestID } from "@/constants";
import { useSettingsStore } from "@/stores";
import { AquaPrimitiveColors, useTheme } from "@/theme";
import { iosPressed } from "@/utils";

import { Icon, IconName } from "../../../ui/icon/Icon";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { TopAppBar } from "../../../ui/top-app-bar/TopAppBar";
import { IncognitoExplainerModal } from "../incognito-explainer-modal/IncognitoExplainerModal";

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
  const {
    isIncognitoMode,
    hasSeenIncognitoExplainer,
    setIncognitoMode,
    markIncognitoExplainerSeen,
  } = useSettingsStore();

  const [showIncognitoModal, setShowIncognitoModal] = useState(false);

  const handleIncognitoToggle = async () => {
    const newValue = !isIncognitoMode;
    const shouldShowModal = newValue && !hasSeenIncognitoExplainer;

    await setIncognitoMode(newValue);

    if (shouldShowModal) {
      setShowIncognitoModal(true);
    }
  };

  const handleIncognitoDismiss = async () => {
    await markIncognitoExplainerSeen();
    setShowIncognitoModal(false);
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
      <Icon
        name="echos_logo"
        size={75}
        style={{ width: 75, height: 24 }}
        color={theme.colors.textPrimary}
      />
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
    <>
      <TopAppBar
        showBackButton={false}
        leading={renderLeading()}
        titleWidget={renderTitleWidget()}
        actions={renderActions()}
      />
      <IncognitoExplainerModal
        visible={showIncognitoModal}
        onConfirm={handleIncognitoDismiss}
        onCancel={() => setShowIncognitoModal(false)}
      />
    </>
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
