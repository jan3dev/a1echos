import React from 'react';
import { View } from 'react-native';
import { useLoc } from '../../../hooks/useLoc';
import { Session } from '../../../models/Session';
import { useSessionTranscriptions } from '../../../stores/transcriptionStore';
import { useTheme } from '../../../theme/useTheme';
import { ListItem } from '../../shared/list-item/ListItem';
import { Checkbox } from '../../ui/checkbox';
import { SessionMoreMenu } from './SessionMoreMenu';

interface SessionListItemProps {
  session: Session;
  onTap: () => void;
  onLongPress: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
}

export const SessionListItem = ({
  session,
  onTap,
  onLongPress,
  selectionMode = false,
  isSelected = false,
}: SessionListItemProps) => {
  const { theme } = useTheme();
  const { loc } = useLoc();
  const transcriptions = useSessionTranscriptions(session.id);
  const count = transcriptions.length;
  const subtitle = loc.transcriptionCount(count);

  return (
    <ListItem
      title={session.name}
      subtitle={subtitle}
      iconTrailing={
        selectionMode ? (
          <View pointerEvents="none">
            <Checkbox value={isSelected} size="small" enabled={true} />
          </View>
        ) : (
          <SessionMoreMenu session={session} />
        )
      }
      backgroundColor={theme.colors.surfacePrimary}
      titleColor={theme.colors.textPrimary}
      subtitleColor={theme.colors.textSecondary}
      onPress={onTap}
      onLongPress={onLongPress}
    />
  );
};
