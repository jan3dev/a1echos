import { RefObject, useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScrollToEdgeButton } from "@/components/shared/scroll-to-edge-button";
import { AppConstants, TestID } from "@/constants";
import { useLocalization, useProgrammaticScrollGuard } from "@/hooks";
import { Session } from "@/models";
import { useIsIncognitoMode, useSessions } from "@/stores";

import { SessionListItem } from "../../session/session-list-item/SessionListItem";
import { IncognitoEmptyState } from "../incognito-empty-state/IncognitoEmptyState";

interface HomeContentProps {
  selectionMode: boolean;
  selectedSessionIds: Set<string>;
  onSessionLongPress: (session: Session) => void;
  onSessionTap: (sessionId: string) => void;
  onSelectionToggle: (sessionId: string) => void;
  onSessionMorePress: (session: Session) => void;
  scrollRef?: RefObject<FlatList<Session> | null>;
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
  const { height: windowHeight } = useWindowDimensions();
  const { loc } = useLocalization();
  const isIncognitoMode = useIsIncognitoMode();
  const sessions = useSessions();

  const [limit, setLimit] = useState<number>(AppConstants.LIST_PAGE_SIZE);
  const [showJumpButton, setShowJumpButton] = useState(false);
  // Unlocks the next bump only after `limit` advances; otherwise duplicate
  // onEndReached fires at the same window would double-bump.
  const lastBumpedAtLimitRef = useRef<number | null>(null);
  const scrollGuard = useProgrammaticScrollGuard();

  const visibleSessions = useMemo(
    () => sessions.slice(0, limit),
    [sessions, limit],
  );
  const hasMore = sessions.length > limit;

  const handleEndReached = useCallback(() => {
    if (!hasMore) return;
    if (lastBumpedAtLimitRef.current === limit) return;
    lastBumpedAtLimitRef.current = limit;
    setLimit((prev) => prev + AppConstants.LIST_PAGE_SIZE);
  }, [hasMore, limit]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (scrollGuard.isActive()) return;
      if (selectionMode) return;
      setShowJumpButton(
        event.nativeEvent.contentOffset.y >
          windowHeight * AppConstants.SCROLL_TO_EDGE_THRESHOLD_RATIO,
      );
    },
    [scrollGuard, selectionMode, windowHeight],
  );

  const handleScrollToTop = useCallback(() => {
    scrollGuard.begin();
    setShowJumpButton(false);
    scrollRef?.current?.scrollToOffset({ offset: 0, animated: true });
  }, [scrollGuard, scrollRef]);

  const renderItem = useCallback(
    ({ item }: { item: Session }) => (
      <SessionListItem
        session={item}
        selectionMode={selectionMode}
        isSelected={selectedSessionIds.has(item.id)}
        onTap={() =>
          selectionMode ? onSelectionToggle(item.id) : onSessionTap(item.id)
        }
        onLongPress={() => onSessionLongPress(item)}
        onMorePress={onSessionMorePress}
      />
    ),
    [
      onSelectionToggle,
      onSessionLongPress,
      onSessionMorePress,
      onSessionTap,
      selectedSessionIds,
      selectionMode,
    ],
  );

  if (isIncognitoMode) {
    return (
      <View
        style={[
          styles.incognitoContainer,
          {
            paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
            paddingBottom:
              insets.bottom + AppConstants.RECORDING_CONTROLS_HEIGHT,
          },
        ]}
      >
        <IncognitoEmptyState />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        testID={TestID.SessionList}
        ref={scrollRef}
        data={visibleSessions}
        keyExtractor={(session) => session.id}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{
          paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + AppConstants.RECORDING_CONTROLS_HEIGHT,
        }}
        showsVerticalScrollIndicator={false}
      />

      <View
        pointerEvents="box-none"
        style={[
          styles.jumpButtonOverlay,
          {
            bottom: insets.bottom + AppConstants.RECORDING_CONTROLS_HEIGHT + 16,
          },
        ]}
      >
        <ScrollToEdgeButton
          visible={showJumpButton && !selectionMode}
          direction="up"
          onPress={handleScrollToTop}
          accessibilityLabel={loc.scrollToTop}
        />
      </View>
    </View>
  );
};

const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  incognitoContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  separator: {
    height: 16,
  },
  jumpButtonOverlay: {
    position: "absolute",
    right: 16,
    zIndex: 200,
    elevation: 200,
  },
});
