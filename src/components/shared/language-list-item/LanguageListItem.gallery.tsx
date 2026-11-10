import { useState } from "react";
import { View } from "react-native";

import { LanguageListItem } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";
import { darkColors } from "@/theme";

const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
];

const Picker = ({ pinnedDark = false }: { pinnedDark?: boolean }) => {
  const [selected, setSelected] = useState("en");
  return (
    <View style={{ gap: 16 }}>
      {languages.map((language) => (
        <LanguageListItem
          key={language.code}
          language={language}
          selected={language.code === selected}
          onSelect={(l) => setSelected(l.code)}
          colors={pinnedDark ? darkColors : undefined}
        />
      ))}
    </View>
  );
};

export const Default = () => <Picker />;

export const Disabled = () => (
  <LanguageListItem
    language={languages[1]}
    selected={false}
    enabled={false}
    onSelect={() => {}}
  />
);

export const PinnedDark = () => <Picker pinnedDark />;

const gallery: GalleryEntry = {
  slug: "language-list-item",
  title: "Language List Item",
  group: "Shared",
  demos: [
    { name: "Default", render: Default },
    { name: "Disabled", render: Disabled },
    { name: "PinnedDark", render: PinnedDark },
  ],
};

export default gallery;
