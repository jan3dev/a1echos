import { AquaPrimitiveColors } from '@/theme';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalization } from '../../../hooks/useLocalization';
import { useSessionOperations } from '../../../hooks/useSessionOperations';
import { Session } from '../../../models/Session';
import { useRenameSession } from '../../../stores/sessionStore';
import { useShowGlobalTooltip } from '../../../stores/uiStore';
import { useTheme } from '../../../theme/useTheme';
import { formatDate, formatSessionSubtitle } from '../../../utils';
import { ListItem } from '../../shared/list-item/ListItem';
import { Icon } from '../../ui/icon/Icon';
import { Text } from '../../ui/text/Text';
import { Toast } from '../../ui/toast/Toast';
import { useToast } from '../../ui/toast/useToast';
import { SessionInputModal } from './SessionInputModal';

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
      console.error('Failed to delete session:', error);
    }
  };

  const openMenu = () => {
    iconRef.current?.measureInWindow((x, y, width, height) => {
      const right = 16;
      setMenuPosition({ top: y + height + 32, right });
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
              {
                top: menuPosition.top,
                right: menuPosition.right,
                backgroundColor: theme.colors.surfacePrimary,
              },
            ]}
          >
            {/* Rename */}
            <ListItem
              title={loc.sessionRenameTitle}
              iconLeading={
                <Icon name="edit" size={24} color={theme.colors.textPrimary} />
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
                <Icon name="trash" size={24} color={theme.colors.textPrimary} />
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
                {`${loc.modifiedPrefix}: ${formatSessionSubtitle({
                  now: new Date(),
                  created: session.timestamp,
                  lastModified: session.lastModified,
                  modifiedPrefix: loc.modifiedPrefix,
                })}`}
              </Text>
              <View style={{ height: 4 }} />
              <Text
                variant="caption1"
                weight="medium"
                color={theme.colors.textTertiary}
              >
                {`${loc.createdPrefix}: ${formatDate(session.timestamp)}`}
              </Text>
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
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: AquaPrimitiveColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
  infoContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 8,
    opacity: 0.6,
  },
});
