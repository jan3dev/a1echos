import { useLocalization } from '@/hooks';
import { getCountryCode } from '@/models';
import { useSelectedLanguage } from '@/stores';
import { useTheme } from '@/theme';

import { FlagIcon } from '../../ui/icon/FlagIcon';
import { Icon } from '../../ui/icon/Icon';
import { RipplePressable } from '../../ui/ripple-pressable/RipplePressable';
import { TopAppBar } from '../../ui/top-app-bar/TopAppBar';

interface SessionAppBarProps {
  sessionName: string;
  selectionMode: boolean;
  editMode?: boolean;
  isIncognitoSession: boolean;
  copyAllEnabled?: boolean;
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
  copyAllEnabled = true,
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
          <RipplePressable
            onPress={onCancelEditPressed}
            hitSlop={10}
            rippleColor={theme.colors.ripple} borderless
          >
            <Icon name="close" size={24} color={theme.colors.textPrimary} />
          </RipplePressable>
        }
        actions={[
          <RipplePressable
            key="save"
            onPress={onSaveEditPressed}
            hitSlop={10}
            rippleColor={theme.colors.ripple} borderless
          >
            <Icon name="check" size={24} color={theme.colors.textPrimary} />
          </RipplePressable>,
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
          <RipplePressable
            key="select_all"
            onPress={onSelectAllPressed}
            hitSlop={10}
            rippleColor={theme.colors.ripple} borderless
          >
            <Icon
              name="select_all"
              size={24}
              color={theme.colors.textPrimary}
            />
          </RipplePressable>,
          <RipplePressable
            key="delete"
            onPress={onDeleteSelectedPressed}
            hitSlop={10}
            rippleColor={theme.colors.ripple} borderless
          >
            <Icon name="trash" size={24} color={theme.colors.textPrimary} />
          </RipplePressable>,
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
        <RipplePressable
          key="language"
          onPress={onLanguageFlagPressed}
          hitSlop={10}
          rippleColor={theme.colors.ripple} borderless
        >
          <FlagIcon name={getCountryCode(selectedLanguage)} size={24} />
        </RipplePressable>,
        <RipplePressable
          key="copy"
          onPress={onCopyAllPressed}
          hitSlop={10}
          rippleColor={theme.colors.ripple} borderless
          style={{ opacity: copyAllEnabled ? 1 : 0.5 }}
        >
          <Icon name="copy" size={24} color={theme.colors.textPrimary} />
        </RipplePressable>,
      ]}
    />
  );
};
