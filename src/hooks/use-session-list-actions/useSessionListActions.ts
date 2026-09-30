import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler } from "react-native";

import type { SubScreenNavbarAction, ToastOptions } from "@/components";
import { Routes } from "@/constants";
import { Session } from "@/models";
import {
  useExitSessionSelection,
  useIsSessionSelectionMode,
  useRenameSession,
  useSelectedSessionIds,
  useSelectedSessionIdsSet,
  useShowGlobalTooltip,
  useToggleSessionSelection,
} from "@/stores";
import { useTheme } from "@/theme";
import { FeatureFlag, logError } from "@/utils";

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

  useEffect(() => {
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
  }, [selectionMode, exitSelection]);

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
    ],
    [
      confirmDelete,
      handleRenameSelected,
      loc.delete,
      loc.rename,
      selectedIds,
      theme.colors.accentDanger,
    ],
  );

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
      onDismiss: () => setActionsSheetVisible(false),
    },
    rename: {
      target: renameTarget,
      visible: renameVisible,
      onSubmit: handleRenameSubmit,
      onCancel: () => setRenameVisible(false),
    },
  };
};
