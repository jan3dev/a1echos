import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  EmptyStateView,
  HomeAppBar,
  HomeContent,
  Screen,
  SessionActionsSheet,
  SessionInputModal,
  SubScreenNavbar,
  Toast,
  useToast,
} from "@/components";
import { AppConstants, Routes, TestID } from "@/constants";
import {
  useFileImport,
  useFolderActions,
  useLocalization,
  useRecordingEntry,
  useScrollSurface,
  useSessionListActions,
} from "@/hooks";
import { FolderSummary, Session } from "@/models";
import {
  useCreateFolder,
  useFolderSessions,
  useFolderSummaries,
  useGlobalTooltip,
  useHasSeenWelcome,
  useIncognitoSession,
  useIsIncognitoMode,
  useSetRecordingControlsVisible,
} from "@/stores";
import { FeatureFlag, logError } from "@/utils";

// First-launch gate. Kept as a thin wrapper so the home screen and its
// recording-control side effects never mount for fresh installs: `useFocusEffect`
// and the controls-visibility effect below would otherwise register against the
// global ui store before the redirect resolves. The flag is loaded during boot
// (before the splash hides), so this resolves synchronously; `Redirect` leaves
// no home entry to swipe back to.
export default function HomeScreen() {
  const hasSeenWelcome = useHasSeenWelcome();

  if (!hasSeenWelcome) {
    return <Redirect href={Routes.welcome} />;
  }

  return <HomeScreenContent />;
}

function HomeScreenContent() {
  const router = useRouter();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<FlatList<Session>>(null);
  const blurTargetRef = useRef<View>(null);
  const {
    scrolled,
    contentBelow,
    onScroll,
    onContentSizeChange,
    onLayout,
    reset,
  } = useScrollSurface();

  const sessions = useFolderSessions(null);
  const folderSummaries = useFolderSummaries();
  const createFolder = useCreateFolder();
  const incognitoSession = useIncognitoSession();
  const isIncognitoMode = useIsIncognitoMode();
  const setRecordingControlsVisible = useSetRecordingControlsVisible();
  const {
    show: showDeleteToast,
    hide: hideDeleteToast,
    toastState: deleteToastState,
  } = useToast();

  const [createFolderVisible, setCreateFolderVisible] = useState(false);

  const {
    show: showAlertToast,
    hide: hideAlertToast,
    toastState: alertToastState,
  } = useToast();

  const actions = useSessionListActions({
    sessions,
    showToast: showDeleteToast,
    hideToast: hideDeleteToast,
  });
  const { selectionMode } = actions;
  const folderActions = useFolderActions({
    showToast: showDeleteToast,
    hideToast: hideDeleteToast,
  });

  // Hold the empty-state label back while a global tooltip is showing so it
  // doesn't paint over (and visually beneath) the tooltip — the label appears
  // once the tooltip has dismissed.
  const globalTooltip = useGlobalTooltip();

  // Incognito sessions live outside `sessions`; treat them as non-empty so the
  // empty-state label unmounts during the record→session-screen transition. In
  // incognito mode, IncognitoEmptyState owns the empty-state messaging instead.
  const isListEmpty = sessions.length === 0 && folderSummaries.length === 0;
  const effectivelyEmpty =
    isListEmpty && !incognitoSession && !isIncognitoMode && !globalTooltip;

  // Clear stale app-bar glass when the session list isn't a populated,
  // scrollable surface (incognito empty state, or no sessions or folders): no
  // scroll event fires to reset it.
  useEffect(() => {
    if (isIncognitoMode || isListEmpty) reset();
  }, [isIncognitoMode, isListEmpty, reset]);

  const scrollToTop = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  const handleUpload = useFileImport({ showAlertToast });

  useRecordingEntry({
    showAlertToast,
    hideAlertToast,
    onStarted: scrollToTop,
  });

  const handleFolderPress = useCallback(
    (folder: FolderSummary) => router.push(Routes.folder(folder.id)),
    [router],
  );
  const openCreateFolder = useCallback(() => setCreateFolderVisible(true), []);

  const handleCreateFolderSubmit = useCallback(
    async (name: string) => {
      try {
        const folderId = await createFolder(name);
        setCreateFolderVisible(false);
        router.push(Routes.folder(folderId));
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.session,
          message: "Failed to create folder",
        });
      }
    },
    [createFolder, router],
  );

  useEffect(() => {
    setRecordingControlsVisible(!selectionMode);
  }, [selectionMode, setRecordingControlsVisible]);

  return (
    <Screen>
      {/* Content (and its blur target) renders before the bars so the Android
          BlurTargetView ref is populated by the time the bars' BlurView mounts
          and resolves its `blurTarget`. The bars float on top via absolute
          positioning + zIndex, so JSX order doesn't affect what paints above. */}
      <AppBarBlurTarget targetRef={blurTargetRef} style={{ flex: 1 }}>
        <HomeContent
          selectionMode={selectionMode}
          selectedSessionIds={actions.selectedIdsSet}
          onSessionLongPress={actions.onSessionLongPress}
          onSessionTap={actions.onSessionTap}
          onSessionMorePress={actions.onSessionMorePress}
          scrollRef={scrollRef}
          onScroll={onScroll}
          onContentSizeChange={onContentSizeChange}
          onLayout={onLayout}
          onUploadPress={handleUpload}
          folders={folderSummaries}
          onFolderPress={handleFolderPress}
          onFolderMorePress={folderActions.onFolderMorePress}
          onCreateFolderPress={openCreateFolder}
        />
      </AppBarBlurTarget>

      <HomeAppBar
        selectionMode={selectionMode}
        selectionTitle={actions.selectionTitle}
        onExitSelectionPressed={actions.exitSelection}
        blurTarget={blurTargetRef}
        scrolled={scrolled}
      />

      {effectivelyEmpty && (
        <View
          style={[
            styles.emptyStateContainer,
            {
              bottom: insets.bottom + AppConstants.RECORDING_FOOTER_HEIGHT + 16,
            },
          ]}
        >
          <EmptyStateView message={loc.emptySessionsMessage} />
        </View>
      )}

      {actions.actionsSheet.session && (
        <SessionActionsSheet
          testID={TestID.SessionActionsSheet}
          visible={actions.actionsSheet.visible}
          header={{
            title: actions.actionsSheet.session.name,
            createdAt: actions.actionsSheet.session.timestamp,
            modifiedAt: actions.actionsSheet.session.lastModified,
          }}
          onRename={actions.actionsSheet.onRename}
          onAddToFolder={actions.actionsSheet.onAddToFolder}
          onCopy={actions.actionsSheet.onCopy}
          onDownload={actions.actionsSheet.onDownload}
          onShare={actions.actionsSheet.onShare}
          onDelete={actions.actionsSheet.onDelete}
          onDismiss={actions.actionsSheet.onDismiss}
        />
      )}

      <SessionActionsSheet
        testID={TestID.SessionShareSheet}
        {...actions.shareSheet}
      />

      {actions.rename.target && (
        <SessionInputModal
          visible={actions.rename.visible}
          title={loc.sessionRenameTitle}
          buttonText={loc.save}
          initialValue={actions.rename.target.name}
          onSubmit={actions.rename.onSubmit}
          onCancel={actions.rename.onCancel}
        />
      )}

      {folderActions.target && (
        <>
          <SessionActionsSheet
            testID={TestID.FolderActionsSheet}
            visible={folderActions.actionsSheet.visible}
            header={{
              title: folderActions.target.folder.name,
              createdAt: folderActions.target.folder.createdAt,
              modifiedAt: folderActions.target.modifiedAt,
            }}
            onRename={folderActions.actionsSheet.onRename}
            onDelete={folderActions.actionsSheet.onDelete}
            onDismiss={folderActions.actionsSheet.onDismiss}
          />
          <SessionInputModal
            visible={folderActions.rename.visible}
            title={loc.folderRenameTitle}
            label={loc.folderNameLabel}
            buttonText={loc.save}
            initialValue={folderActions.target.folder.name}
            onSubmit={folderActions.rename.onSubmit}
            onCancel={folderActions.rename.onCancel}
          />
        </>
      )}

      <SessionInputModal
        visible={createFolderVisible}
        title={loc.folderCreateTitle}
        label={loc.folderNameLabel}
        buttonText={loc.save}
        onSubmit={handleCreateFolderSubmit}
        onCancel={() => setCreateFolderVisible(false)}
      />

      <SubScreenNavbar
        visible={selectionMode}
        actions={actions.navbarActions}
        blurTarget={blurTargetRef}
        scrolled={contentBelow}
      />

      <Toast {...deleteToastState} />
      <Toast {...alertToastState} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyStateContainer: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
