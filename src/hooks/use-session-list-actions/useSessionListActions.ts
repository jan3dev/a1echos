import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Platform } from "react-native";

import type { SubScreenNavbarAction, ToastOptions } from "@/components";
import { AppConstants, Routes } from "@/constants";
import { Session } from "@/models";
import { shareService } from "@/services";
import {
  useExitSessionSelection,
  useIsSessionSelectionMode,
  useRenameSession,
  useSelectedSessionIds,
  useSelectedSessionIdsSet,
  useShowGlobalTooltip,
  useToggleSessionSelection,
  useTranscriptionStore,
} from "@/stores";
import { useTheme } from "@/theme";
import { delay, FeatureFlag, logError } from "@/utils";

import { useLocalization } from "../use-localization/useLocalization";
import { useSessionOperations } from "../use-session-operations/useSessionOperations";

interface UseSessionListActionsParams {
  sessions: Session[];
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
}

export const useSessionListActions = ({
  sessions,
  showToast,
  hideToast,
}: UseSessionListActionsParams) => {
  const router = useRouter();
  const { loc } = useLocalization();
  const { theme } = useTheme();
  const { deleteSession } = useSessionOperations();
  const renameSession = useRenameSession();
  const selectionMode = useIsSessionSelectionMode();
  const selectedIdsSet = useSelectedSessionIdsSet();
  const selectedIds = useSelectedSessionIds();
  const toggleSelection = useToggleSessionSelection();
  const exitSelection = useExitSessionSelection();
  const showGlobalTooltip = useShowGlobalTooltip();

  const [actionsSession, setActionsSession] = useState<Session | null>(null);
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Session | null>(null);
  const [renameVisible, setRenameVisible] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

  // Focus-scoped: a pushed screen (add-to-folder) must get the back press.
  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (selectionMode) {
            exitSelection();
            return true;
          }
          return false;
        },
      );
      return () => backHandler.remove();
    }, [selectionMode, exitSelection]),
  );

  // Selection is global store state: leaving a screen mid-selection must not
  // carry it over to the screen underneath.
  useEffect(() => exitSelection, [exitSelection]);

  const onSessionLongPress = useCallback(
    async (session: Session) => {
      if (selectionMode) return;
      toggleSelection(session.id);
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {
        // Haptics not supported
      }
    },
    [selectionMode, toggleSelection],
  );

  const onSessionTap = useCallback(
    (sessionId: string) => {
      if (selectionMode) {
        toggleSelection(sessionId);
      } else {
        router.push(Routes.session(sessionId));
      }
    },
    [selectionMode, toggleSelection, router],
  );

  const performDelete = useCallback(
    async (sessionIds: string[]) => {
      hideToast();
      try {
        await Promise.all(sessionIds.map((id) => deleteSession(id)));
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.session,
          message: "Failed to delete sessions",
        });
      }
      exitSelection();
      showGlobalTooltip(loc.homeSessionsDeleted(sessionIds.length));
    },
    [deleteSession, exitSelection, hideToast, showGlobalTooltip, loc],
  );

  const confirmDelete = useCallback(
    (sessionIds: string[]) => {
      if (sessionIds.length === 0) return;
      showToast({
        title: loc.homeDeleteSelectedSessionsTitle,
        message: loc.homeDeleteSelectedSessionsMessage(sessionIds.length),
        primaryButtonText: loc.delete,
        onPrimaryButtonTap: () => performDelete(sessionIds),
        secondaryButtonText: loc.cancel,
        onSecondaryButtonTap: hideToast,
        variant: "info",
      });
    },
    [showToast, hideToast, performDelete, loc],
  );

  const openRename = useCallback((session: Session) => {
    setRenameTarget(session);
    setRenameVisible(true);
  }, []);

  const handleRenameSelected = useCallback(() => {
    if (selectedIds.length !== 1) return;
    const target = sessions.find((s) => s.id === selectedIds[0]);
    if (target) openRename(target);
  }, [selectedIds, sessions, openRename]);

  const onSessionMorePress = useCallback((session: Session) => {
    setActionsSession(session);
    setActionsSheetVisible(true);
  }, []);

  const handleActionsRename = useCallback(() => {
    if (!actionsSession) return;
    setActionsSheetVisible(false);
    openRename(actionsSession);
  }, [actionsSession, openRename]);

  const handleActionsDelete = useCallback(() => {
    if (!actionsSession) return;
    setActionsSheetVisible(false);
    confirmDelete([actionsSession.id]);
  }, [actionsSession, confirmDelete]);

  const handleRenameSubmit = useCallback(
    async (newName: string) => {
      if (!renameTarget) return;
      try {
        await renameSession(renameTarget.id, newName);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.session,
          message: "Failed to rename session",
        });
      }
      setRenameVisible(false);
      if (selectionMode) exitSelection();
    },
    [renameTarget, renameSession, selectionMode, exitSelection],
  );

  const sessionContents = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      const { sessionTranscriptions } = useTranscriptionStore.getState();
      return sessions
        .filter((session) => idSet.has(session.id))
        .map((session) => ({
          session,
          transcriptions: sessionTranscriptions(session.id),
        }));
    },
    [sessions],
  );

  const runShareAction = useCallback(
    async (
      ids: string[],
      kind: "copy" | "download" | "share",
    ): Promise<void> => {
      setActionsSheetVisible(false);
      setShareSheetVisible(false);
      const contents = sessionContents(ids);
      if (contents.length === 0) return;
      if (kind !== "copy") await delay(AppConstants.SHEET_DISMISS_MS);
      try {
        if (kind === "copy") {
          await shareService.copySessions(contents);
          // Android 12+ shows its own clipboard confirmation.
          if (Platform.OS === "ios" || Number(Platform.Version) < 31) {
            showGlobalTooltip(loc.copiedToClipboard);
          }
        } else if (kind === "download") {
          if (!(await shareService.saveSessionsMarkdown(contents))) return;
          showGlobalTooltip(loc.markdownSaved);
        } else {
          await shareService.shareSessions(contents);
        }
        if (selectionMode) exitSelection();
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.session,
          message: `Failed to ${kind} sessions`,
        });
        if (kind === "download") showGlobalTooltip(loc.markdownSaveFailed);
      }
    },
    [sessionContents, showGlobalTooltip, selectionMode, exitSelection, loc],
  );

  const openAddToFolder = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      setActionsSheetVisible(false);
      router.push(Routes.addToFolder(ids));
    },
    [router],
  );

  const navbarActions = useMemo<SubScreenNavbarAction[]>(
    () => [
      {
        key: "delete",
        icon: "trash",
        label: loc.delete,
        color: theme.colors.accentDanger,
        disabled: selectedIds.length === 0,
        onPress: () => confirmDelete(selectedIds),
      },
      {
        key: "rename",
        icon: "edit",
        label: loc.rename,
        disabled: selectedIds.length !== 1,
        onPress: handleRenameSelected,
      },
      {
        key: "addToFolder",
        icon: "folder_move_to",
        label: loc.addToFolder,
        disabled: selectedIds.length === 0,
        onPress: () => openAddToFolder(selectedIds),
      },
      {
        key: "share",
        icon: "export",
        label: loc.share,
        disabled: selectedIds.length === 0,
        onPress: () => setShareSheetVisible(true),
      },
    ],
    [
      confirmDelete,
      handleRenameSelected,
      openAddToFolder,
      loc.delete,
      loc.rename,
      loc.addToFolder,
      loc.share,
      selectedIds,
      theme.colors.accentDanger,
    ],
  );

  const actionsIds = actionsSession ? [actionsSession.id] : [];

  return {
    selectionMode,
    selectedIdsSet,
    selectionTitle: loc.selectedCount(selectedIds.length),
    onSessionTap,
    onSessionLongPress,
    onSessionMorePress,
    toggleSelection,
    exitSelection,
    navbarActions,
    actionsSheet: {
      session: actionsSession,
      visible: actionsSheetVisible,
      onRename: handleActionsRename,
      onDelete: handleActionsDelete,
      onAddToFolder: () => openAddToFolder(actionsIds),
      onCopy: () => runShareAction(actionsIds, "copy"),
      onDownload: () => runShareAction(actionsIds, "download"),
      onShare: () => runShareAction(actionsIds, "share"),
      onDismiss: () => setActionsSheetVisible(false),
    },
    shareSheet: {
      visible: shareSheetVisible,
      onCopy: () => runShareAction(selectedIds, "copy"),
      onDownload: () => runShareAction(selectedIds, "download"),
      onShare: () => runShareAction(selectedIds, "share"),
      onDismiss: () => setShareSheetVisible(false),
    },
    rename: {
      target: renameTarget,
      visible: renameVisible,
      onSubmit: handleRenameSubmit,
      onCancel: () => setRenameVisible(false),
    },
  };
};
