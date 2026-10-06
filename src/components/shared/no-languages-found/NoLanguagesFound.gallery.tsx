import { NoLanguagesFound } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";
import { darkColors } from "@/theme";

export const Default = () => <NoLanguagesFound query="Klingon" />;

export const PinnedDark = () => (
  <NoLanguagesFound query="Klingon" colors={darkColors} />
);

const gallery: GalleryEntry = {
  slug: "no-languages-found",
  title: "No Languages Found",
  group: "Shared",
  demos: [
    { name: "Default", render: Default },
    { name: "PinnedDark", render: PinnedDark },
  ],
};

export default gallery;
