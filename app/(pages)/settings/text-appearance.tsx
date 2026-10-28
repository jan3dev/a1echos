import { Stack } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type HostInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  FloatingCTAModule,
  FontOptionGrid,
  FontSizeSlider,
  ListItem,
  PRIMARY_BUTTON_HEIGHT,
  Screen,
  Text,
  TextPreviewCard,
  Toggle,
  TopAppBar,
} from "@/components";
import { AppConstants, TestID } from "@/constants";
import { useLocalization, useScrollSurface } from "@/hooks";
import { DEFAULT_TEXT_APPEARANCE } from "@/models";
import { useSetTextAppearance, useTextAppearance } from "@/stores";
import { spacing, useTheme } from "@/theme";

export default function TextAppearanceSettingsScreen() {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<HostInstance>(null);
  const { scrolled, onScroll } = useScrollSurface();
  const [sliding, setSliding] = useState(false);

  const appearance = useTextAppearance();
  const setAppearance = useSetTextAppearance();

  const toggleBold = (bold: boolean) => {
    void setAppearance({ bold });
  };

  const isDefault =
    appearance.font === DEFAULT_TEXT_APPEARANCE.font &&
    appearance.size === DEFAULT_TEXT_APPEARANCE.size &&
    appearance.bold === DEFAULT_TEXT_APPEARANCE.bold;

  return (
    <Screen>
      {/* iOS 26's full-screen back swipe claims the touch at touch-down, before
          JS can react, so horizontal slider drags would pop the screen. The
          edge swipe still works. */}
      <Stack.Screen options={{ fullScreenGestureEnabled: false }} />
      {/* Bars render after content so Android's blur target ref is populated
          before the bar's BlurView mounts and resolves its `blurTarget`. */}
      <AppBarBlurTarget targetRef={blurTargetRef} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
              paddingBottom:
                insets.bottom + PRIMARY_BUTTON_HEIGHT + 2 * spacing.md,
              backgroundColor: theme.colors.surfaceBackground,
            },
          ]}
          scrollEnabled={!sliding}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <TextPreviewCard
            text={loc.textAppearancePreview}
            appearance={appearance}
          />

          <View style={styles.section}>
            <Text
              variant="body2"
              weight="medium"
              color={theme.colors.textSecondary}
            >
              {loc.fontSize}
            </Text>
            <FontSizeSlider
              value={appearance.size}
              onChange={(size) => void setAppearance({ size })}
              onSlidingChange={setSliding}
              accessibilityLabel={loc.fontSize}
            />
          </View>

          <FontOptionGrid
            value={appearance.font}
            onChange={(font) => void setAppearance({ font })}
          />

          <View style={styles.section}>
            <Text
              variant="body2"
              weight="medium"
              color={theme.colors.textSecondary}
            >
              {loc.fontWeight}
            </Text>
            <ListItem
              testID={TestID.TextAppearanceBoldToggle}
              title={loc.boldText}
              iconTrailing={
                <Toggle
                  value={appearance.bold}
                  onValueChange={toggleBold}
                  accessibilityLabel={loc.boldText}
                />
              }
              onPress={() => toggleBold(!appearance.bold)}
            />
          </View>
        </ScrollView>
      </AppBarBlurTarget>

      <FloatingCTAModule
        blurTarget={blurTargetRef}
        secondary={{
          testID: TestID.TextAppearanceReset,
          text: loc.resetDefaults,
          enabled: !isDefault,
          onPress: () => void setAppearance(DEFAULT_TEXT_APPEARANCE),
        }}
      />

      <TopAppBar
        title={loc.textAppearanceTitle}
        blurTarget={blurTargetRef}
        scrolled={scrolled}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    gap: 24,
  },
  section: {
    gap: 16,
  },
});
