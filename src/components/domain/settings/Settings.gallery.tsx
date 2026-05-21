import { ScrollView, StyleSheet, View } from "react-native";

import { InAppBanner, SettingsFooter } from "@/components";

import type { GalleryEntry } from "@/design-system/manifest";

// --- SettingsFooter ---

export const Footer = () => <SettingsFooter />;

// --- InAppBanner ---

export const Banner = () => (
  <View style={styles.bannerContainer}>
    <InAppBanner />
  </View>
);

// --- Combined View (as it would appear in Settings Screen) ---

export const SettingsPagePreview = () => (
  <View style={styles.fullContainer}>
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Settings content would go here */}
      <View style={[styles.placeholder]} />

      {/* Banner */}
      <View style={styles.bannerSection}>
        <InAppBanner />
      </View>
    </ScrollView>

    {/* Footer at bottom */}
    <SettingsFooter />
  </View>
);

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  bannerContainer: {
    padding: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 64,
  },
  placeholder: {
    height: 200,
    borderRadius: 8,
    marginBottom: 24,
  },
  bannerSection: {
    marginBottom: 24,
  },
});

const gallery: GalleryEntry = {
  slug: "settings",
  title: "Settings",
  group: "Domain",
  demos: [
    { name: "Footer", render: Footer },
    { name: "Banner", render: Banner },
    { name: "SettingsPagePreview", render: SettingsPagePreview },
  ],
};

export default gallery;
