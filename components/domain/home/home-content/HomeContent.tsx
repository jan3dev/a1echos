import { RefObject } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppConstants } from "@/constants";
import { Session } from "@/models";

import { SessionList } from "../../session/session-list/SessionList";

interface HomeContentProps {
  selectionMode: boolean;
  selectedSessionIds: Set<string>;
  onSessionLongPress: (session: Session) => void;
  onSessionTap: (sessionId: string) => void;
  onSelectionToggle: (sessionId: string) => void;
  scrollRef?: RefObject<ScrollView | null>;
}

export const HomeContent = ({
  selectionMode,
  selectedSessionIds,
  onSessionLongPress,
  onSessionTap,
  onSelectionToggle,
  scrollRef,
}: HomeContentProps) => {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={{
        paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + AppConstants.RECORDING_CONTROLS_HEIGHT,
      }}
      showsVerticalScrollIndicator={false}
    >
      <SessionList
        selectionMode={selectionMode}
        selectedSessionIds={selectedSessionIds}
        onSessionLongPress={onSessionLongPress}
        onSessionTap={onSessionTap}
        onSelectionToggle={onSelectionToggle}
      />
    </ScrollView>
  );
};
