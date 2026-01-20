import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useSettingsStore } from '@/stores';
import { useTheme } from '@/theme';

import { Icon } from '../../ui/icon/Icon';
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
        <Pressable onPress={() => onExitSelectionMode?.()} hitSlop={8}>
          <Icon
            name="chevron_left"
            size={24}
            color={theme.colors.textPrimary}
          />
        </Pressable>
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
        <Pressable key="trash" onPress={() => onDeleteSelected?.()} hitSlop={8}>
          <Icon name="trash" size={24} color={theme.colors.textPrimary} />
        </Pressable>,
      ];
    }

    return [
      <Pressable
        key="ghost"
        onPress={handleIncognitoToggle}
        hitSlop={10}
        style={styles.ghostButton}
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
      </Pressable>,
      <Pressable
        key="settings"
        onPress={() => router.push('/settings' as any)}
        hitSlop={10}
      >
        <Icon name="hamburger" size={24} color={theme.colors.textPrimary} />
      </Pressable>,
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

const styles = StyleSheet.create({
  ghostButton: {
    marginRight: 16,
  },
});
