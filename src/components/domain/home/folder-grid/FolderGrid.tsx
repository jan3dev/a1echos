import { StyleSheet, View } from "react-native";

import { FolderGroupItem, type FolderSummary } from "./FolderGroupItem";

interface FolderGridProps {
  folders: FolderSummary[];
  onFolderPress?: (folder: FolderSummary) => void;
  onFolderMorePress?: (folder: FolderSummary) => void;
}

export const FolderGrid = ({
  folders,
  onFolderPress,
  onFolderMorePress,
}: FolderGridProps) => {
  const rows: FolderSummary[][] = [];
  for (let i = 0; i < folders.length; i += 2)
    rows.push(folders.slice(i, i + 2));

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((folder) => (
            <FolderGroupItem
              key={folder.id}
              folder={folder}
              onPress={() => onFolderPress?.(folder)}
              onMorePress={() => onFolderMorePress?.(folder)}
            />
          ))}
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
