import { ErrorView } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

export const Default = () => <ErrorView errorMessage="Something went wrong" />;

export const WithRetry = () => (
  <ErrorView
    errorMessage="Failed to load data"
    onRetry={() => console.log("Retry pressed")}
  />
);

export const LongErrorMessage = () => (
  <ErrorView
    errorMessage="The transcription service is currently unavailable. Please check your internet connection and try again."
    onRetry={() => console.log("Retry pressed")}
  />
);

const gallery: GalleryEntry = {
  slug: "error-view",
  title: "Error View",
  group: "Shared",
  demos: [
    { name: "Default", render: Default },
    { name: "WithRetry", render: WithRetry },
    { name: "LongErrorMessage", render: LongErrorMessage },
  ],
};

export default gallery;
