import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { File } from "expo-file-system";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "@/theme";
import { FeatureFlag, iosPressed, logWarn, WAV_HEADER_SIZE } from "@/utils";

import { Icon } from "../icon/Icon";
import { RipplePressable } from "../ripple-pressable/RipplePressable";
import { Text } from "../text/Text";

const BAR_WIDTH = 2;
const BAR_GAP = 1;
const MIN_BAR_HEIGHT = 4;
const MAX_BAR_HEIGHT = 14;
// ponytail: assumes the canonical 16-bit PCM header our recorder and importer
// write; a WAV with extra chunks only skews the first bar.
const PEAK_WINDOW_SAMPLES = 512;

/** Normalized (0–1) peaks of `count` evenly spaced windows of a 16-bit WAV. */
export const readWavPeaks = (uri: string, count: number): number[] => {
  const handle = new File(uri).open();
  try {
    const samples = Math.floor(((handle.size ?? 0) - WAV_HEADER_SIZE) / 2);
    const window = Math.min(PEAK_WINDOW_SAMPLES, Math.floor(samples / count));
    if (window <= 0) return new Array(count).fill(0);
    const peaks = Array.from({ length: count }, (_, i) => {
      handle.offset = WAV_HEADER_SIZE + Math.floor((i * samples) / count) * 2;
      const bytes = handle.readBytes(window * 2);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
      let peak = 0;
      for (let j = 0; j + 1 < bytes.length; j += 2) {
        peak = Math.max(peak, Math.abs(view.getInt16(j, true)));
      }
      return peak;
    });
    const max = Math.max(...peaks);
    return max > 0 ? peaks.map((p) => p / max) : peaks;
  } finally {
    handle.close();
  }
};

export const formatPlaybackTime = (seconds: number) => {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export interface AudioPlayerProps {
  /** Plaintext WAV file URI; null while it's being prepared. */
  uri: string | null;
  onDelete?: () => void;
  playAccessibilityLabel?: string;
  pauseAccessibilityLabel?: string;
  deleteAccessibilityLabel?: string;
  testID?: string;
}

export const AudioPlayer = ({
  uri,
  onDelete,
  playAccessibilityLabel,
  pauseAccessibilityLabel,
  deleteAccessibilityLabel,
  testID,
}: AudioPlayerProps) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const player = useAudioPlayer(uri, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const [wavesWidth, setWavesWidth] = useState(0);

  const barCount = Math.floor((wavesWidth + BAR_GAP) / (BAR_WIDTH + BAR_GAP));
  const peaks = useMemo(() => {
    if (barCount <= 0) return [];
    if (!uri) return new Array(barCount).fill(0);
    try {
      return readWavPeaks(uri, barCount);
    } catch (error) {
      logWarn(`Failed to read waveform: ${error}`, { flag: FeatureFlag.ui });
      return new Array(barCount).fill(0);
    }
  }, [uri, barCount]);

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const togglePlayback = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
    } catch (error) {
      logWarn(`Failed to set playback audio mode: ${error}`, {
        flag: FeatureFlag.ui,
      });
    }
    player.play();
  };

  const progress =
    status.duration > 0 ? status.currentTime / status.duration : 0;
  const shownTime =
    status.playing || status.currentTime > 0
      ? status.currentTime
      : status.duration;
  const enabled = uri !== null && status.isLoaded;

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: colors.surfacePrimary,
          borderColor: colors.surfaceBorderPrimary,
        },
      ]}
    >
      <Pressable
        testID={testID && `${testID}-toggle`}
        onPress={togglePlayback}
        disabled={!enabled}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={
          status.playing ? pauseAccessibilityLabel : playAccessibilityLabel
        }
        accessibilityState={{ disabled: !enabled }}
        style={({ pressed }) => ({
          opacity: enabled ? iosPressed(pressed) : 0.5,
        })}
      >
        <Icon
          name={status.playing ? "pause" : "play"}
          size={18}
          color={colors.accentBrand}
        />
      </Pressable>

      <Pressable
        testID={testID && `${testID}-waves`}
        style={styles.waves}
        onLayout={(e) => setWavesWidth(e.nativeEvent.layout.width)}
        onPress={(e) => {
          if (wavesWidth > 0 && status.duration > 0) {
            player.seekTo(
              (e.nativeEvent.locationX / wavesWidth) * status.duration,
            );
          }
        }}
      >
        {peaks.map((peak, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height:
                  MIN_BAR_HEIGHT + peak * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT),
                backgroundColor:
                  i / peaks.length < progress
                    ? colors.accentBrand
                    : colors.surfaceTertiary,
              },
            ]}
          />
        ))}
      </Pressable>

      <Text variant="caption2" weight="medium" color={colors.textTertiary}>
        {formatPlaybackTime(shownTime)}
      </Text>

      {onDelete && (
        <RipplePressable
          testID={testID && `${testID}-delete`}
          onPress={onDelete}
          hitSlop={10}
          rippleColor={colors.ripple}
          borderless
          accessibilityRole="button"
          accessibilityLabel={deleteAccessibilityLabel}
        >
          <Icon name="trash" size={18} color={colors.accentDanger} />
        </RipplePressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  waves: {
    flex: 1,
    height: MAX_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: BAR_GAP,
    overflow: "hidden",
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: 4,
  },
});
