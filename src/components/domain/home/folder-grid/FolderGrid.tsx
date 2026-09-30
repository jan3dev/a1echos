import { StyleSheet, View } from "react-native";

import { FolderGroupItem, type FolderSummary } from "./FolderGroupItem";

interface FolderGridProps {
  folders: FolderSummary[];
  onFolderPress?: (folder: FolderSummary) => void;
  onFolderMorePress?: (folder: FolderSummary) => void;
  /** Pick mode: every folder shows a radio, checked for this id. */
  selectedId?: string | null;
  /** Appends a "New Folder" tile. */
  onCreatePress?: () => void;
}

export const FolderGrid = ({
  folders,
  onFolderPress,
  onFolderMorePress,
  selectedId,
  onCreatePress,
}: FolderGridProps) => {
  const items: (FolderSummary | null)[] = onCreatePress
    ? [...folders, null]
    : folders;
  const rows: (FolderSummary | null)[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((folder) =>
            folder ? (
              <FolderGroupItem
                key={folder.id}
                folder={folder}
                selected={
                  selectedId === undefined
                    ? undefined
                    : selectedId === folder.id
                }
                onPress={() => onFolderPress?.(folder)}
                onMorePress={
                  onFolderMorePress && (() => onFolderMorePress(folder))
                }
              />
            ) : (
              <FolderGroupItem
                key="add-new"
                variant="addNew"
                onPress={onCreatePress}
              />
            ),
          )}
          {row.length === 1 && <View style={styles.spacer} />}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    gap: 24,
  },
  row: {
    flexDirection: "row",
    gap: 16,
  },
  spacer: {
    flex: 1,
  },
});
