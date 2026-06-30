import { ReactNode } from "react";
import { View } from "react-native";

import { Divider, Text } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

const DividerWrapper = ({ children }: { children: ReactNode }) => (
  <View>
    <Text style={{ marginBottom: 8 }}>Content Above</Text>
    {children}
    <Text style={{ marginTop: 8 }}>Content Below</Text>
  </View>
);

export const Default = () => (
  <DividerWrapper>
    <Divider height={1} />
  </DividerWrapper>
);

export const CustomHeight = () => (
  <DividerWrapper>
    <Divider height={4} />
  </DividerWrapper>
);

export const CustomColor = () => (
  <DividerWrapper>
    <Divider color="#FF3B13" height={2} />
  </DividerWrapper>
);

const gallery: GalleryEntry = {
  slug: "divider",
  title: "Divider",
  group: "UI",
  demos: [
    { name: "Default", render: Default },
    { name: "CustomHeight", render: CustomHeight },
    { name: "CustomColor", render: CustomColor },
  ],
};

export default gallery;
