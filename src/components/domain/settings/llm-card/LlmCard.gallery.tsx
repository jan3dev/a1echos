import { View } from "react-native";

import { LlmCard } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";
import type { DownloadProgress } from "@/services";

const DESCRIPTION =
  "A well-rounded AI model that can summarize, rewrite, and analyze transcripts efficiently on-device.";

const progress = (
  status: DownloadProgress["status"],
  ratio: number,
): DownloadProgress => ({
  modelId: "gallery" as DownloadProgress["modelId"],
  totalBytes: 250_000_000,
  downloadedBytes: 250_000_000 * ratio,
  progressRatio: ratio,
  status,
  currentFileIndex: 0,
  totalFiles: 1,
});

const noop = () => {};

const Card = (props: Partial<Parameters<typeof LlmCard>[0]>) => (
  <LlmCard
    name="LLaMA"
    description={DESCRIPTION}
    sizeLabel="250 MB"
    isSelected={false}
    isDownloaded={false}
    onSelect={noop}
    onDownload={noop}
    onCancelDownload={noop}
    onDelete={noop}
    onRetry={noop}
    {...props}
  />
);

export const Selected = () => <Card isDownloaded isSelected />;
export const Downloaded = () => <Card isDownloaded />;
export const Available = () => <Card />;
export const Downloading = () => (
  <Card downloadProgress={progress("downloading", 0.75)} />
);
export const Warning = () => (
  <Card
    isDownloaded
    isSelected
    warning="Your transcription language isn't English. This model only works well in English."
  />
);
export const Failed = () => <Card downloadProgress={progress("error", 0)} />;

export const AllStates = () => (
  <View style={{ gap: 16 }}>
    <Selected />
    <Downloaded />
    <Available />
    <Downloading />
    <Failed />
    <Warning />
  </View>
);

const gallery: GalleryEntry = {
  slug: "llm-card",
  title: "LLM Card",
  group: "Domain",
  demos: [
    { name: "AllStates", render: AllStates },
    { name: "Selected", render: Selected },
    { name: "Downloaded", render: Downloaded },
    { name: "Available", render: Available },
    { name: "Downloading", render: Downloading },
    { name: "Failed", render: Failed },
    { name: "Warning", render: Warning },
  ],
};

export default gallery;
