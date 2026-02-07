import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useSettingsStore } from '@/stores';
import { useTheme } from '@/theme';

import { Icon } from '../../ui/icon/Icon';
import { RipplePressable } from '../../ui/ripple-pressable/RipplePressable';
import { TopAppBar } from '../../ui/top-app-bar/TopAppBar';

import { IncognitoExplainerModal } from './IncognitoExplainerModal';

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
        <RipplePressable
          onPress={() => onExitSelectionMode?.()}
          hitSlop={10}
          rippleColor={theme.colors.ripple}
          borderless
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
        <RipplePressable
          key="trash"
          onPress={() => onDeleteSelected?.()}
          hitSlop={10}
          rippleColor={theme.colors.ripple}
          borderless
        >
          <Icon name="trash" size={24} color={theme.colors.textPrimary} />
        </RipplePressable>,
      ];
    }

    return [
      <RipplePressable
        key="ghost"
        onPress={handleIncognitoToggle}
        hitSlop={10}
        rippleColor={theme.colors.ripple}
        borderless
      >
        <Icon
          name="ghost"
          size={24}
          color={
            isIncognitoMode
              ? theme.colors.accentBrand
              : theme.colors.textPrimary
          }
        />
      </RipplePressable>,
      <RipplePressable
        key="settings"
        onPress={() => router.push('/settings' as any)}
        hitSlop={10}
        rippleColor={theme.colors.ripple}
        borderless
      >
        <Icon name="hamburger" size={24} color={theme.colors.textPrimary} />
      </RipplePressable>,
    ];
  };

  return (
    <>
      <TopAppBar
        showBackButton={false}
        leading={renderLeading()}
        actions={renderActions()}
        transparent={false}
      />
      <IncognitoExplainerModal
        visible={showIncognitoModal}
        onConfirm={handleIncognitoDismiss}
        onCancel={() => setShowIncognitoModal(false)}
      />
    </>
  );
};
