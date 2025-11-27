import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useLocalization } from '../../../hooks/useLocalization';
import { getCountryCode } from '../../../models/SpokenLanguage';
import { useSelectedLanguage } from '../../../stores/settingsStore';
import { useTheme } from '../../../theme/useTheme';
import { FlagIcon } from '../../ui/icon/FlagIcon';
import { Icon } from '../../ui/icon/Icon';
import { TopAppBar } from '../../ui/top-app-bar/TopAppBar';

interface SessionAppBarProps {
  sessionName: string;
  selectionMode: boolean;
  editMode?: boolean;
  isIncognitoSession: boolean;
  onBackPressed?: () => void;
  onTitlePressed?: () => void;
  onCopyAllPressed?: () => void;
  onLanguageFlagPressed?: () => void;
  onSelectAllPressed?: () => void;
  onDeleteSelectedPressed?: () => void;
  onCancelEditPressed?: () => void;
  onSaveEditPressed?: () => void;
}

export const SessionAppBar = ({
  sessionName,
  selectionMode,
  editMode = false,
  isIncognitoSession,
  onBackPressed,
  onTitlePressed,
  onCopyAllPressed,
  onLanguageFlagPressed,
  onSelectAllPressed,
  onDeleteSelectedPressed,
  onCancelEditPressed,
  onSaveEditPressed,
}: SessionAppBarProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const selectedLanguage = useSelectedLanguage();

  if (editMode) {
    return (
      <TopAppBar
        title={loc.edit}
        showBackButton={false}
        leading={
          <Pressable onPress={onCancelEditPressed} hitSlop={10}>
            <Icon name="close" size={24} color={theme.colors.textPrimary} />
          </Pressable>
        }
        actions={[
          <Pressable key="save" onPress={onSaveEditPressed} hitSlop={10}>
            <Icon name="check" size={24} color={theme.colors.textPrimary} />
          </Pressable>,
        ]}
      />
    );
  }

  if (selectionMode) {
    return (
      <TopAppBar
        title={sessionName}
        onBackPressed={onBackPressed}
        actions={[
          <Pressable
            key="select_all"
            onPress={onSelectAllPressed}
            hitSlop={10}
            style={styles.actionButton}
          >
            <Icon
              name="select_all"
              size={24}
              color={theme.colors.textPrimary}
            />
          </Pressable>,
          <Pressable
            key="delete"
            onPress={onDeleteSelectedPressed}
            hitSlop={10}
            style={styles.actionButton}
          >
            <Icon name="trash" size={24} color={theme.colors.textPrimary} />
          </Pressable>,
        ]}
      />
    );
  }

  return (
    <TopAppBar
      title={sessionName}
      onBackPressed={onBackPressed}
      onTitlePressed={!isIncognitoSession ? onTitlePressed : undefined}
      actions={[
        <Pressable
          key="language"
          onPress={onLanguageFlagPressed}
          hitSlop={10}
          style={[styles.actionButton, styles.languageButton]}
        >
          <FlagIcon name={getCountryCode(selectedLanguage)} size={24} />
        </Pressable>,
        <Pressable
          key="copy"
          onPress={onCopyAllPressed}
          hitSlop={10}
          style={styles.actionButton}
        >
          <Icon
            name="copy_multiple"
            size={24}
            color={theme.colors.textPrimary}
          />
        </Pressable>,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  actionButton: {
    marginLeft: 8,
  },
  languageButton: {
    marginRight: 12,
  },
});
