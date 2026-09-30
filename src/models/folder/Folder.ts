export interface Folder {
  id: string;
  name: string;
  createdAt: Date;
}

export type FolderSummary = Folder & { sessionCount: number };
