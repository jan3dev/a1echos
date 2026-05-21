import { View } from "react-native";

import { TestID, dynamicTestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { Session } from "@/models";
import { useSessionTranscriptions } from "@/stores";
import { useTheme } from "@/theme";

import { ListItem } from "../../../shared/list-item/ListItem";
import { Checkbox } from "../../../ui/checkbox/Checkbox";
import { Icon } from "../../../ui/icon/Icon";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";

interface SessionListItemProps {
  session: Session;
  onTap: () => void;
  onLongPress: () => void;
  onMorePress?: (session: Session) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
}

export const SessionListItem = ({
  session,
  onTap,
  onLongPress,
  onMorePress,
  selectionMode = false,
  isSelected = false,
}: SessionListItemProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const transcriptions = useSessionTranscriptions(session.id);

  return (
    <ListItem
      testID={dynamicTestID.session(session.id)}
      title={session.name}
      subtitle={loc.transcriptionCount(transcriptions.length)}
      iconTrailing={
        selectionMode ? (
          <View pointerEvents="none">
            <Checkbox value={isSelected} size="small" enabled={true} />
          </View>
        ) : onMorePress ? (
          <RipplePressable
            testID={TestID.SessionMoreMenu}
            onPress={() => onMorePress(session)}
            hitSlop={10}
            rippleColor={theme.colors.ripple}
            borderless
          >
            <View>
              <Icon name="more" size={18} color={theme.colors.textPrimary} />
            </View>
          </RipplePressable>
        ) : null
      }
      titleColor={theme.colors.textPrimary}
      subtitleColor={theme.colors.textSecondary}
      onPress={onTap}
      onLongPress={onLongPress}
    />
  );
};
