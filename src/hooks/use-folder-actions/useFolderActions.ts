import { useCallback, useState } from "react";

import type { ToastOptions } from "@/components";
import type { FolderSummary } from "@/models";
import {
  useDeleteFolder,
  useRenameFolder,
  useSessionStore,
  useShowGlobalTooltip,
} from "@/stores";
import { FeatureFlag, logError } from "@/utils";

import { useLocalization } from "../use-localization/useLocalization";
import { useSessionOperations } from "../use-session-operations/useSessionOperations";

interface UseFolderActionsParams {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
}

const folderSessions = (folderId: string) =>
  useSessionStore.getState().sessions.filter((s) => s.folderId === folderId);

export const useFolderActions = ({
  showToast,
  hideToast,
}: UseFolderActionsParams) => {
  const { loc } = useLocalization();
  const { deleteSession } = useSessionOperations();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const showGlobalTooltip = useShowGlobalTooltip();

  const [target, setTarget] = useState<{
    folder: FolderSummary;
    modifiedAt: Date;
  } | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);

  const onFolderMorePress = useCallback((folder: FolderSummary) => {
    const latest = useSessionStore
      .getState()
      .getSessions()
      .find((s) => s.folderId === folder.id)?.lastModified;
    setTarget({
      folder,
      modifiedAt:
        latest && latest > folder.createdAt ? latest : folder.createdAt,
    });
    setSheetVisible(true);
  }, []);

  const performDelete = useCallback(
    async (folderId: string) => {
      hideToast();
      try {
        await Promise.all(
          folderSessions(folderId).map((s) => deleteSession(s.id)),
        );
        await deleteFolder(folderId);
        showGlobalTooltip(loc.folderDeleted);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.session,
          message: "Failed to delete folder",
        });
      }
    },
    [deleteFolder, deleteSession, hideToast, showGlobalTooltip, loc],
  );

  const handleDelete = useCallback(() => {
    if (!target) return;
    setSheetVisible(false);
    const { id, sessionCount: count } = target.folder;
    showToast({
      title:
        count > 0
          ? loc.folderDeleteWithSessionsTitle(count)
          : loc.homeDeleteSelectedSessionsTitle,
      message: loc.homeDeleteSelectedSessionsMessage(count),
      primaryButtonText: loc.delete,
      onPrimaryButtonTap: () => performDelete(id),
      secondaryButtonText: loc.cancel,
      onSecondaryButtonTap: hideToast,
      variant: "info",
    });
  }, [target, showToast, hideToast, performDelete, loc]);

  const handleRename = useCallback(() => {
    setSheetVisible(false);
    setRenameVisible(true);
  }, []);

  const handleRenameSubmit = useCallback(
    async (newName: string) => {
      if (!target) return;
      try {
        await renameFolder(target.folder.id, newName);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.session,
          message: "Failed to rename folder",
        });
      }
      setRenameVisible(false);
    },
    [target, renameFolder],
  );

  return {
    target,
    onFolderMorePress,
    actionsSheet: {
      visible: sheetVisible,
      onRename: handleRename,
      onDelete: handleDelete,
      onDismiss: () => setSheetVisible(false),
    },
    rename: {
      visible: renameVisible,
      onSubmit: handleRenameSubmit,
      onCancel: () => setRenameVisible(false),
    },
  };
};
