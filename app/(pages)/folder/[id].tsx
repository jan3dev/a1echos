import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  EmptyStateView,
  HomeAppBar,
  HomeContent,
  Icon,
  Screen,
  SessionActionsSheet,
  SessionInputModal,
  SubScreenNavbar,
  Toast,
  TopAppBar,
  useToast,
} from "@/components";
import { RipplePressable } from "@/components/ui/ripple-pressable/RipplePressable";
import { AppConstants, TestID } from "@/constants";
import {
  useFileImport,
  useLocalization,
  useRecordingEntry,
  useScrollSurface,
  useSessionListActions,
} from "@/hooks";
import {
  useFindFolderById,
  useFolderSessions,
  useGlobalTooltip,
  useRenameFolder,
  useSetRecordingControlsVisible,
} from "@/stores";
import { useTheme } from "@/theme";
import { FeatureFlag, logError } from "@/utils";

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { loc } = useLocalization();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);
  const { scrolled, contentBelow, onScroll, onContentSizeChange, onLayout } =
    useScrollSurface();

  const folder = useFindFolderById(id);
  const renameFolder = useRenameFolder();
  const [renameFolderVisible, setRenameFolderVisible] = useState(false);

  const handleRenameFolderSubmit = async (name: string) => {
    try {
      await renameFolder(id, name);
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.session,
        message: "Failed to rename folder",
      });
    }
    setRenameFolderVisible(false);
  };
  const sessions = useFolderSessions(id);
  const globalTooltip = useGlobalTooltip();
  const setRecordingControlsVisible = useSetRecordingControlsVisible();
  const {
    show: showAlertToast,
    hide: hideAlertToast,
    toastState: alertToastState,
  } = useToast();
  const {
    show: showDeleteToast,
    hide: hideDeleteToast,
    toastState: deleteToastState,
  } = useToast();
  const actions = useSessionListActions({
    sessions,
    showToast: showDeleteToast,
    hideToast: hideDeleteToast,
  });
  const { selectionMode } = actions;

  const handleUpload = useFileImport({ showAlertToast, folderId: id });

  useRecordingEntry({
    showAlertToast,
    hideAlertToast,
    folderId: id,
    blurTarget: blurTargetRef,
  });

  useEffect(() => {
    setRecordingControlsVisible(!selectionMode);
  }, [selectionMode, setRecordingControlsVisible]);

  return (
    <Screen>
      <AppBarBlurTarget targetRef={blurTargetRef} style={styles.flex}>
        <HomeContent
          folderId={id}
          selectionMode={selectionMode}
          selectedSessionIds={actions.selectedIdsSet}
          onSessionLongPress={actions.onSessionLongPress}
          onSessionTap={actions.onSessionTap}
          onSessionMorePress={actions.onSessionMorePress}
          onScroll={onScroll}
          onContentSizeChange={onContentSizeChange}
          onLayout={onLayout}
          onUploadPress={handleUpload}
        />
      </AppBarBlurTarget>

      {selectionMode ? (
        <HomeAppBar
          selectionMode
          selectionTitle={actions.selectionTitle}
          onExitSelectionPressed={actions.exitSelection}
          blurTarget={blurTargetRef}
          scrolled={scrolled}
        />
      ) : (
        <TopAppBar
          title={folder?.name ?? ""}
          onTitlePressed={() => setRenameFolderVisible(true)}
          blurTarget={blurTargetRef}
          scrolled={scrolled}
          actions={[
            <RipplePressable
              key="close"
              testID={TestID.FolderCloseButton}
              onPress={() => router.back()}
              hitSlop={10}
              rippleColor={theme.colors.ripple}
              borderless
              accessibilityRole="button"
              accessibilityLabel={loc.close}
            >
              <Icon name="close" size={24} color={theme.colors.textPrimary} />
            </RipplePressable>,
          ]}
        />
      )}

      {sessions.length === 0 && !globalTooltip && (
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

      {folder && (
        <SessionInputModal
          visible={renameFolderVisible}
          title={loc.folderRenameTitle}
          label={loc.folderNameLabel}
          buttonText={loc.save}
          initialValue={folder.name}
          onSubmit={handleRenameFolderSubmit}
          onCancel={() => setRenameFolderVisible(false)}
        />
      )}

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
  flex: {
    flex: 1,
  },
  emptyStateContainer: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
