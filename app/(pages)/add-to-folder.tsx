import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  Button,
  FolderGrid,
  Icon,
  Screen,
  SessionInputModal,
  TopAppBar,
} from "@/components";
import { RipplePressable } from "@/components/ui/ripple-pressable/RipplePressable";
import { AppConstants, TestID } from "@/constants";
import { useLocalization, useScrollSurface } from "@/hooks";
import type { FolderSummary } from "@/models";
import {
  useCreateFolder,
  useExitSessionSelection,
  useFolderSummaries,
  useMoveSessionsToFolder,
  useShowGlobalTooltip,
} from "@/stores";
import { useTheme } from "@/theme";
import { FeatureFlag, logError } from "@/utils";

export default function AddToFolderScreen() {
  const { sessionIds } = useLocalSearchParams<{ sessionIds: string }>();
  const router = useRouter();
  const { loc } = useLocalization();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);
  const { scrolled, onScroll } = useScrollSurface();

  const folders = useFolderSummaries();
  const createFolder = useCreateFolder();
  const moveSessionsToFolder = useMoveSessionsToFolder();
  const exitSelection = useExitSessionSelection();
  const showGlobalTooltip = useShowGlobalTooltip();

  const [selected, setSelected] = useState<FolderSummary | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const moveTo = async (folderId: string, name: string) => {
    setIsSaving(true);
    try {
      await moveSessionsToFolder(sessionIds?.split(",") ?? [], folderId);
      exitSelection();
      router.back();
      showGlobalTooltip(loc.sessionsAddedToFolder(name));
    } catch (error) {
      setIsSaving(false);
      logError(error, {
        flag: FeatureFlag.session,
        message: "Failed to add sessions to folder",
      });
    }
  };

  const handleCreateSubmit = async (name: string) => {
    try {
      const folderId = await createFolder(name);
      setCreateVisible(false);
      await moveTo(folderId, name.trim());
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.session,
        message: "Failed to create folder",
      });
    }
  };

  return (
    <Screen>
      <AppBarBlurTarget targetRef={blurTargetRef} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
              backgroundColor: theme.colors.surfaceBackground,
            },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <FolderGrid
            folders={folders}
            selectedId={selected?.id ?? null}
            onFolderPress={setSelected}
            onCreatePress={() => setCreateVisible(true)}
          />
        </ScrollView>
      </AppBarBlurTarget>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button.primary
          testID={TestID.AddToFolderSave}
          text={loc.save}
          enabled={selected !== null && !isSaving}
          onPress={() => selected && moveTo(selected.id, selected.name)}
        />
      </View>

      <TopAppBar
        title={loc.selectFolder}
        blurTarget={blurTargetRef}
        scrolled={scrolled}
        actions={[
          <RipplePressable
            key="close"
            testID={TestID.AddToFolderClose}
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

      <SessionInputModal
        visible={createVisible}
        title={loc.folderCreateTitle}
        label={loc.folderNameLabel}
        buttonText={loc.folderCreateAndAdd}
        onSubmit={handleCreateSubmit}
        onCancel={() => setCreateVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});
