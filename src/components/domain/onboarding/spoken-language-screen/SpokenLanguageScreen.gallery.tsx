import { useState } from "react";
import { View } from "react-native";

import { SpokenLanguageScreen } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";
import { SupportedLanguages } from "@/models";

const Screen = () => {
  const [code, setCode] = useState("en");
  return (
    <SpokenLanguageScreen
      languages={SupportedLanguages.forCodes(["en", "zh", "pt", "de", "es"])}
      selectedCode={code}
      onSelect={(language) => setCode(language.code)}
      onBack={() => console.log("Back")}
      onSkip={() => console.log("Skip")}
      onNext={() => console.log("Next")}
    />
  );
};

export const Default = () => (
  <View style={{ height: 720, borderRadius: 16, overflow: "hidden" }}>
    <Screen />
  </View>
);

export const Landscape = () => (
  <View
    style={{ width: 720, height: 360, borderRadius: 16, overflow: "hidden" }}
  >
    <Screen />
  </View>
);

const gallery: GalleryEntry = {
  slug: "spoken-language-screen",
  title: "Spoken Language Screen",
  group: "Domain",
  demos: [
    { name: "Default", render: Default },
    { name: "Landscape", render: Landscape },
  ],
};

export default gallery;
