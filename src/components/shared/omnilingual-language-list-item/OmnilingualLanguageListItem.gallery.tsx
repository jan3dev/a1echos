import { View } from "react-native";

import { OmnilingualLanguageListItem } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";
import { darkColors } from "@/theme";

const cantonese = { code: "yue", name: "Cantonese", script: "Han" };
const abadi = { code: "kbt", name: "Abadi", script: "Latin" };

export const Default = () => (
  <OmnilingualLanguageListItem language={cantonese} onPress={() => {}} />
);

export const ReferenceOnly = () => (
  <View style={{ gap: 16 }}>
    <OmnilingualLanguageListItem language={abadi} />
    <OmnilingualLanguageListItem language={cantonese} />
  </View>
);

export const PinnedDark = () => (
  <OmnilingualLanguageListItem
    language={cantonese}
    onPress={() => {}}
    colors={darkColors}
  />
);

const gallery: GalleryEntry = {
  slug: "omnilingual-language-list-item",
  title: "Omnilingual Language List Item",
  group: "Shared",
  demos: [
    { name: "Default", render: Default },
    { name: "ReferenceOnly", render: ReferenceOnly },
    { name: "PinnedDark", render: PinnedDark },
  ],
};

export default gallery;
