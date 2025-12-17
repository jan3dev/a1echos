import { useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { useLocalization, useSessionOperations } from '@/hooks';
import { Session } from '@/models';
import { useRenameSession, useShowGlobalTooltip } from '@/stores';
import { getShadow, useTheme } from '@/theme';
import { FeatureFlag, formatDate, formatSessionSubtitle, logError } from '@/utils';

import { ListItem } from '../../shared/list-item/ListItem';
import { Icon } from '../../ui/icon/Icon';
import { Text } from '../../ui/text/Text';
import { Toast } from '../../ui/toast/Toast';
import { useToast } from '../../ui/toast/useToast';

import { SessionInputModal } from './SessionInputModal';

const MENU_HEIGHT_FALLBACK = 200;
// Buffer to keep menu above tab bar and safe area insets
const BOTTOM_SAFE_AREA = 100;

interface SessionMoreMenuProps {
  session: Session;
}

export const SessionMoreMenu = ({ session }: SessionMoreMenuProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const [menuVisible, setMenuVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
  }>({ top: 0, right: 16 });
  const [measuredMenuHeight, setMeasuredMenuHeight] = useState<number | null>(
    null
  );
  const iconRef = useRef<View>(null);

  const {
    show: showDeleteToast,
    hide: hideDeleteToast,
    toastState: deleteToastState,
  } = useToast();
  const showGlobalTooltip = useShowGlobalTooltip();

  const renameSession = useRenameSession();
  const { deleteSession } = useSessionOperations();

  const handleRename = (newName: string) => {
    renameSession(session.id, newName);
    setRenameVisible(false);
  };

  const confirmDelete = () => {
    setMenuVisible(false);
    showDeleteToast({
      title: loc.homeDeleteSelectedSessionsTitle,
      message: loc.homeDeleteSelectedSessionsMessage(1),
      primaryButtonText: loc.delete,
      onPrimaryButtonTap: performDelete,
      secondaryButtonText: loc.cancel,
      onSecondaryButtonTap: hideDeleteToast,
      variant: 'informative',
    });
  };

  const performDelete = async () => {
    hideDeleteToast();

    try {
      await deleteSession(session.id);
      showGlobalTooltip(loc.homeSessionsDeleted(1));
    } catch (error) {
      logError(error, { flag: FeatureFlag.session, message: 'Failed to delete session' });
    }
  };

  const openMenu = () => {
    iconRef.current?.measureInWindow((x, y, width, height) => {
      const screenHeight = Dimensions.get('window').height;
      const right = 16;
      const menuGap = 8;
      const proposedTop = y + height + menuGap;
      const menuHeight = measuredMenuHeight ?? MENU_HEIGHT_FALLBACK;

      const wouldOverflow =
        proposedTop + menuHeight > screenHeight - BOTTOM_SAFE_AREA;
      const top = wouldOverflow ? y - menuHeight - menuGap : proposedTop;

      setMenuPosition({ top, right });
      setMenuVisible(true);
    });
  };

  return (
    <>
      <TouchableOpacity
        onPress={openMenu}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View ref={iconRef} collapsable={false}>
          <Icon name="more" size={24} color={theme.colors.textPrimary} />
        </View>
      </TouchableOpacity>

      {/* Popover Menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <View
            style={[
              styles.menuContainer,
              getShadow('menu'),
              {
                top: menuPosition.top,
                right: menuPosition.right,
              },
            ]}
            onLayout={(e) => setMeasuredMenuHeight(e.nativeEvent.layout.height)}
          >
            <View
              style={[
                styles.menuInner,
                { backgroundColor: theme.colors.surfacePrimary },
              ]}
            >
              {/* Rename */}
              <ListItem
                title={loc.sessionRenameTitle}
                iconLeading={
                  <Icon
                    name="edit"
                    size={24}
                    color={theme.colors.textPrimary}
                  />
                }
                iconTrailing={
                  <Icon
                    name="chevron_right"
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                }
                onPress={() => {
                  setMenuVisible(false);
                  setRenameVisible(true);
                }}
                backgroundColor="transparent"
              />

              {/* Delete */}
              <ListItem
                title={loc.delete}
                iconLeading={
                  <Icon
                    name="trash"
                    size={24}
                    color={theme.colors.textPrimary}
                  />
                }
                iconTrailing={
                  <Icon
                    name="chevron_right"
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                }
                onPress={confirmDelete}
                backgroundColor="transparent"
              />

              {/* Info */}
              <View style={styles.infoContainer}>
                <Text
                  variant="caption1"
                  weight="medium"
                  color={theme.colors.textTertiary}
                >
                  {formatSessionSubtitle({
                    now: new Date(),
                    created: session.timestamp,
                    lastModified: session.lastModified,
                    modifiedPrefix: loc.modifiedPrefix,
                  })}
                </Text>
                <View style={styles.spacer} />
                <Text
                  variant="caption1"
                  weight="medium"
                  color={theme.colors.textTertiary}
                >
                  {`${loc.createdPrefix}: ${formatDate(session.timestamp)}`}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Rename Modal */}
      <SessionInputModal
        visible={renameVisible}
        title={loc.sessionRenameTitle}
        buttonText={loc.save}
        initialValue={session.name}
        onSubmit={handleRename}
        onCancel={() => setRenameVisible(false)}
      />

      {/* Delete Confirmation Toast */}
      <Toast {...deleteToastState} />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  menuContainer: {
    position: 'absolute',
    width: 240,
  },
  menuInner: {
    borderRadius: 12,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  infoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    opacity: 0.6,
  },
  spacer: {
    height: 4,
  },
});
