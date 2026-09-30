import { StyleSheet, View } from "react-native";

import type { GalleryEntry } from "@/design-system/manifest";

import { FolderGrid } from "./FolderGrid";
import { FolderGroupItem, type FolderSummary } from "./FolderGroupItem";

const folders: FolderSummary[] = [
  { id: "1", name: "AQUA", createdAt: new Date(2025, 3, 1), sessionCount: 2 },
  { id: "2", name: "JAN3", createdAt: new Date(2025, 2, 23), sessionCount: 4 },
  { id: "3", name: "PR", createdAt: new Date(2025, 0, 17), sessionCount: 4 },
  {
    id: "4",
    name: "BitcoinPro",
    createdAt: new Date(2025, 0, 8),
    sessionCount: 2,
  },
];

const log = (label: string) => () => console.log(label);

export const Items = () => (
  <View style={styles.row}>
    <FolderGroupItem folder={folders[0]} onMorePress={log("More")} />
    <FolderGroupItem variant="addNew" onPress={log("Add new")} />
  </View>
);

export const Grid = () => (
  <View style={styles.stage}>
    <FolderGrid
      folders={folders}
      onFolderPress={(f) => console.log("Folder", f.id)}
      onFolderMorePress={(f) => console.log("More", f.id)}
    />
  </View>
);

const styles = StyleSheet.create({
  row: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 16,
    padding: 16,
  },
  stage: {
    alignSelf: "stretch",
    padding: 16,
  },
});

const gallery: GalleryEntry = {
  slug: "folder-grid",
  title: "Folder Grid",
  group: "Domain",
  demos: [
    { name: "Items", render: Items },
    { name: "Grid", render: Grid },
  ],
};

export default gallery;
