import { View } from 'react-native';

import { Checkbox, ListItem, SessionMoreMenu } from '@/components';
import { useLocalization } from '@/hooks';
import { Session } from '@/models';
import { useSessionTranscriptions } from '@/stores';
import { useTheme } from '@/theme';

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
  const { loc } = useLocalization();
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
            <Checkbox value={isSelected} size="large" enabled={true} />
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
