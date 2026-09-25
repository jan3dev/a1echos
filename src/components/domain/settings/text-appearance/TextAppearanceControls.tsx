import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import {
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  PanResponder,
  StyleSheet,
  View,
} from "react-native";

import { TestID, dynamicTestID } from "@/constants";
import {
  type TextAppearance,
  TRANSCRIPT_FONT_KEYS,
  TRANSCRIPT_FONT_SIZES,
  TRANSCRIPT_FONTS,
  type TranscriptFont,
  transcriptTextStyle,
} from "@/models";
import { AquaPrimitiveColors, useTheme } from "@/theme";
import { iosPressed } from "@/utils";

import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { Text } from "../../../ui/text/Text";

const THUMB_SIZE = 24;
const LAST_INDEX = TRANSCRIPT_FONT_SIZES.length - 1;
const LONG_PRESS_MS = 300;

export const TextPreviewCard = ({
  text,
  appearance,
}: {
  text: string;
  appearance: TextAppearance;
}) => {
  const { theme } = useTheme();
  return (
    <View
      testID={TestID.TextAppearancePreview}
      style={[
        styles.previewCard,
        {
          backgroundColor: theme.colors.accentBrandTransparent,
          borderColor: theme.colors.accentBrand,
        },
      ]}
    >
      <Text
        color={theme.colors.textPrimary}
        style={transcriptTextStyle(appearance)}
      >
        {text}
      </Text>
    </View>
  );
};

export const FontSizeSlider = ({
  value,
  onChange,
  onSlidingChange,
  accessibilityLabel,
}: {
  value: number;
  onChange: (size: number) => void;
  /** Fires true on touch-down and false on release, so the screen can pause
   *  scrolling while the user drags. */
  onSlidingChange?: (sliding: boolean) => void;
  accessibilityLabel?: string;
}) => {
  const { theme } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(0, TRANSCRIPT_FONT_SIZES.indexOf(value));
  // Drag events can outrun re-renders; track the latest index locally so a
  // tick is reported (and felt) exactly once.
  const indexRef = useRef(index);
  indexRef.current = index;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // locationX is relative to whatever view is under the finger, so it jumps
  // once a drag leaves the track; derive position from pageX instead.
  const trackPageX = useRef(0);

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const selectIndex = (next: number) => {
    const clamped = Math.min(LAST_INDEX, Math.max(0, next));
    if (clamped === indexRef.current) return;
    indexRef.current = clamped;
    void Haptics.selectionAsync();
    onChange(TRANSCRIPT_FONT_SIZES[clamped]);
  };

  const selectAt = (event: GestureResponderEvent) => {
    if (!trackWidth) return;
    const x = event.nativeEvent.pageX - trackPageX.current;
    selectIndex(Math.round((x / trackWidth) * LAST_INDEX));
  };

  const endSlide = () => {
    cancelLongPress();
    onSlidingChange?.(false);
  };

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      trackPageX.current =
        event.nativeEvent.pageX - event.nativeEvent.locationX;
      onSlidingChange?.(true);
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, LONG_PRESS_MS);
      selectAt(event);
    },
    onPanResponderMove: selectAt,
    onPanResponderRelease: endSlide,
    onPanResponderTerminate: endSlide,
  });

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") selectIndex(index + 1);
    if (event.nativeEvent.actionName === "decrement") selectIndex(index - 1);
  };

  const tickColor = theme.colors.textTertiary;

  return (
    <View
      style={[
        styles.sliderCard,
        {
          backgroundColor: theme.colors.surfacePrimary,
          borderColor: theme.colors.surfaceBorderPrimary,
        },
      ]}
    >
      <Text variant="caption2" weight="medium" color={theme.colors.textPrimary}>
        A
      </Text>
      <View
        testID={TestID.TextAppearanceSizeSlider}
        style={styles.track}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: `${value}` }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={handleAccessibilityAction}
        {...responder.panHandlers}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.line, { backgroundColor: tickColor }]} />
          <View style={styles.ticks}>
            {TRANSCRIPT_FONT_SIZES.map((size) => (
              <View
                key={size}
                style={[styles.tick, { backgroundColor: tickColor }]}
              />
            ))}
          </View>
          {trackWidth > 0 && (
            <View
              style={[
                styles.thumb,
                { left: (index / LAST_INDEX) * trackWidth - THUMB_SIZE / 2 },
              ]}
            />
          )}
        </View>
      </View>
      <Text variant="h5" weight="semibold" color={theme.colors.textPrimary}>
        A
      </Text>
    </View>
  );
};

export const FontOptionGrid = ({
  value,
  onChange,
}: {
  value: TranscriptFont;
  onChange: (font: TranscriptFont) => void;
}) => {
  const { theme } = useTheme();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {TRANSCRIPT_FONT_KEYS.map((font) => {
        const selected = font === value;
        return (
          <RipplePressable
            key={font}
            testID={dynamicTestID.fontOption(font)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(font)}
            rippleColor={theme.colors.ripple}
            style={({ pressed }) => [
              styles.option,
              { opacity: iosPressed(pressed) },
              selected
                ? {
                    backgroundColor: theme.colors.surfaceSelected,
                    borderColor: theme.colors.surfaceBorderSelected,
                    borderWidth: 1.5,
                  }
                : {
                    backgroundColor: theme.colors.surfacePrimary,
                    borderColor: theme.colors.surfaceBorderPrimary,
                    borderWidth: 1,
                  },
            ]}
          >
            <Text
              color={theme.colors.textPrimary}
              numberOfLines={1}
              style={{
                fontFamily: TRANSCRIPT_FONTS[font].regular,
                letterSpacing: 0,
              }}
            >
              {TRANSCRIPT_FONTS[font].label}
            </Text>
          </RipplePressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  previewCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  sliderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
  },
  track: {
    flex: 1,
    height: THUMB_SIZE,
  },
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    top: THUMB_SIZE / 2 - 0.5,
    height: 1,
  },
  ticks: {
    position: "absolute",
    left: 0,
    right: 0,
    top: THUMB_SIZE / 2 - 2.5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tick: {
    width: 1,
    height: 5,
  },
  thumb: {
    position: "absolute",
    top: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: AquaPrimitiveColors.white,
    shadowColor: AquaPrimitiveColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    flexBasis: "45%",
    flexGrow: 1,
    height: 58,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
