import { memo, RefObject, useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  type LayoutChangeEvent,
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
import { FolderSummary, Session } from "@/models";
import { useFolderSessions, useIsIncognitoMode } from "@/stores";
import { useTheme } from "@/theme";

import { Button } from "../../../ui/button/Button";
import { Divider } from "../../../ui/divider/Divider";
import { Icon } from "../../../ui/icon/Icon";
import { SessionListItem } from "../../session/session-list-item/SessionListItem";
import { FolderGrid } from "../folder-grid/FolderGrid";
import { IncognitoEmptyState } from "../incognito-empty-state/IncognitoEmptyState";

interface HomeContentProps {
  selectionMode: boolean;
  selectedSessionIds: Set<string>;
  onSessionLongPress: (session: Session) => void;
  onSessionTap: (sessionId: string) => void;
  onSessionMorePress: (session: Session) => void;
  scrollRef?: RefObject<FlatList<Session> | null>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange?: (contentWidth: number, contentHeight: number) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  folderId?: string;
  folders?: FolderSummary[];
  onFolderPress?: (folder: FolderSummary) => void;
  onFolderMorePress?: (folder: FolderSummary) => void;
  onCreateFolderPress?: () => void;
  onUploadPress?: () => void;
}

const NO_FOLDERS: FolderSummary[] = [];

export const HomeContent = ({
  selectionMode,
  selectedSessionIds,
  onSessionLongPress,
  onSessionTap,
  onSessionMorePress,
  scrollRef,
  onScroll,
  onContentSizeChange,
  onLayout,
  folderId,
  folders = NO_FOLDERS,
  onFolderPress,
  onFolderMorePress,
  onCreateFolderPress,
  onUploadPress,
}: HomeContentProps) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { loc } = useLocalization();
  const { theme } = useTheme();
  const isIncognitoMode = useIsIncognitoMode();
  const sessions = useFolderSessions(folderId ?? null);

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
      // Always forward to the surface tracker, even during a programmatic
      // scroll or selection mode, so the app bar's blur stays in sync.
      onScroll?.(event);
      if (scrollGuard.isActive()) return;
      if (selectionMode) return;
      setShowJumpButton(
        event.nativeEvent.contentOffset.y >
          windowHeight * AppConstants.SCROLL_TO_EDGE_THRESHOLD_RATIO,
      );
    },
    [onScroll, scrollGuard, selectionMode, windowHeight],
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
        onTap={() => onSessionTap(item.id)}
        onLongPress={() => onSessionLongPress(item)}
        onMorePress={onSessionMorePress}
      />
    ),
    [
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
        onContentSizeChange={onContentSizeChange}
        onLayout={onLayout}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          selectionMode ? null : (
            <ListHeader
              folders={folders}
              onFolderPress={onFolderPress}
              onFolderMorePress={onFolderMorePress}
              onCreateFolderPress={onCreateFolderPress}
              onUploadPress={onUploadPress}
            />
          )
        }
        contentContainerStyle={{
          paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + AppConstants.RECORDING_CONTROLS_HEIGHT,
          backgroundColor: theme.colors.surfaceBackground,
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

const ListHeader = memo(function ListHeader({
  folders,
  onFolderPress,
  onFolderMorePress,
  onCreateFolderPress,
  onUploadPress,
}: {
  folders: FolderSummary[];
  onFolderPress?: (folder: FolderSummary) => void;
  onFolderMorePress?: (folder: FolderSummary) => void;
  onCreateFolderPress?: () => void;
  onUploadPress?: () => void;
}) {
  const { loc } = useLocalization();
  const { theme } = useTheme();
  const hasFolders = folders.length > 0;

  return (
    <View style={hasFolders ? styles.header : styles.headerNoFolders}>
      <View
        style={[styles.quickActions, hasFolders && styles.quickActionsSpaced]}
      >
        {onCreateFolderPress && (
          <Button.utility
            text={loc.homeFolder}
            onPress={onCreateFolderPress}
            icon={
              <Icon
                name="folder_add"
                size={18}
                color={theme.colors.textPrimary}
              />
            }
          />
        )}
        <Button.utility
          text={loc.homeUpload}
          onPress={onUploadPress}
          icon={
            <Icon
              name="document_upload"
              size={18}
              color={theme.colors.textPrimary}
            />
          }
        />
      </View>
      {hasFolders && (
        <>
          <FolderGrid
            folders={folders}
            onFolderPress={onFolderPress}
            onFolderMorePress={onFolderMorePress}
          />
          <Divider />
        </>
      )}
    </View>
  );
});

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
  header: {
    gap: 24,
    marginBottom: 24,
  },
  headerNoFolders: {
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
  },
  quickActionsSpaced: {
    gap: 16,
  },
  jumpButtonOverlay: {
    position: "absolute",
    right: 16,
    zIndex: 200,
    elevation: 200,
  },
});
