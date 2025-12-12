import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SessionList } from '@/components';
import { Session } from '@/models';

interface HomeContentProps {
  selectionMode: boolean;
  selectedSessionIds: Set<string>;
  onSessionLongPress: (session: Session) => void;
  onSessionTap: (sessionId: string) => void;
  onSelectionToggle: (sessionId: string) => void;
  scrollRef?: React.RefObject<ScrollView | null>;
}

const RECORDING_CONTROLS_HEIGHT = 96;

export const HomeContent = ({
  selectionMode,
  selectedSessionIds,
  onSessionLongPress,
  onSessionTap,
  onSelectionToggle,
  scrollRef,
}: HomeContentProps) => {
  const insets = useSafeAreaInsets();
  const APP_BAR_HEIGHT = 60; // Standard top app bar height

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={{
        paddingTop: insets.top + APP_BAR_HEIGHT + 16,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + RECORDING_CONTROLS_HEIGHT,
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
