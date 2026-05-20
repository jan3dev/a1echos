import { RefObject } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppConstants } from "@/constants";
import { Session } from "@/models";
import { useIsIncognitoMode } from "@/stores";

import { SessionList } from "../../session/session-list/SessionList";
import { IncognitoEmptyState } from "../incognito-empty-state/IncognitoEmptyState";

interface HomeContentProps {
  selectionMode: boolean;
  selectedSessionIds: Set<string>;
  onSessionLongPress: (session: Session) => void;
  onSessionTap: (sessionId: string) => void;
  onSelectionToggle: (sessionId: string) => void;
  onSessionMorePress: (session: Session) => void;
  scrollRef?: RefObject<ScrollView | null>;
}

export const HomeContent = ({
  selectionMode,
  selectedSessionIds,
  onSessionLongPress,
  onSessionTap,
  onSelectionToggle,
  onSessionMorePress,
  scrollRef,
}: HomeContentProps) => {
  const insets = useSafeAreaInsets();
  const isIncognitoMode = useIsIncognitoMode();

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={{
        flexGrow: isIncognitoMode ? 1 : undefined,
        paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + AppConstants.RECORDING_CONTROLS_HEIGHT,
      }}
      showsVerticalScrollIndicator={false}
    >
      {isIncognitoMode ? (
        <IncognitoEmptyState />
      ) : (
        <SessionList
          selectionMode={selectionMode}
          selectedSessionIds={selectedSessionIds}
          onSessionLongPress={onSessionLongPress}
          onSessionTap={onSessionTap}
          onSelectionToggle={onSelectionToggle}
          onSessionMorePress={onSessionMorePress}
        />
      )}
    </ScrollView>
  );
};
