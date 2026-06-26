import { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View, ViewStyle } from "react-native";

import { Transcription } from "@/models";
import { useTheme } from "@/theme";
import { iosPressed } from "@/utils";

import { Checkbox } from "../../../ui/checkbox/Checkbox";
import { Icon } from "../../../ui/icon/Icon";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { Skeleton } from "../../../ui/skeleton/Skeleton";
import { Text } from "../../../ui/text/Text";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const DATE_FORMAT_WITH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "numeric",
  hour12: true,
});

interface TranscriptionItemProps {
  transcription: Transcription;
  selectionMode?: boolean;
  isSelected?: boolean;
  isLivePreviewItem?: boolean;
  isLoadingWhisperResult?: boolean;
  isWhisperRecording?: boolean;
  onTap?: () => void;
  onLongPress?: () => void;
  isEditing?: boolean;
  isAnyEditing?: boolean;
  isCancelling?: boolean;
  onStartEdit?: () => void;
  onEndEdit?: () => void;
  onTranscriptionUpdate?: (updated: Transcription) => void;
  style?: ViewStyle;
}

export const TranscriptionItem = ({
  transcription,
  selectionMode = false,
  isSelected = false,
  isLivePreviewItem = false,
  isLoadingWhisperResult = false,
  isWhisperRecording = false,
  onTap,
  onLongPress,
  isEditing = false,
  isAnyEditing = false,
  onStartEdit,
  onEndEdit,
  onTranscriptionUpdate,
  isCancelling = false,
  style,
}: TranscriptionItemProps) => {
  const { theme } = useTheme();
  const [editText, setEditText] = useState(transcription.text);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isEditing) {
      setEditText(transcription.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  useEffect(() => {
    if (isCancelling && isEditing) {
      setEditText(transcription.text);
      onEndEdit?.();
    }
  }, [isCancelling, isEditing, transcription.text, onEndEdit]);

  const handleSaveEdit = () => {
    const newText = editText.trim();
    if (newText) {
      if (newText !== transcription.text) {
        onTranscriptionUpdate?.({
          ...transcription,
          text: newText,
        });
      }
    } else {
      setEditText(transcription.text);
    }
    onEndEdit?.();
  };

  const isOlderThanCurrentYear =
    transcription.timestamp.getFullYear() < new Date().getFullYear();

  const dateFormat = isOlderThanCurrentYear
    ? DATE_FORMAT_WITH_YEAR
    : DATE_FORMAT;

  const showSkeleton = isLoadingWhisperResult || isWhisperRecording;

  const enableInteractions = !isLivePreviewItem && !showSkeleton;
  const showEditIcon = !isLivePreviewItem && !selectionMode;
  const showCheckbox = selectionMode && !isLivePreviewItem;
  const disableIcons = showSkeleton || (isAnyEditing && !isEditing);

  const isSelectedItem = selectionMode && isSelected;

  const innerBackgroundColor = isSelectedItem
    ? theme.colors.surfaceSelected
    : theme.colors.surfacePrimary;

  const borderColor = isEditing
    ? theme.colors.accentBrand
    : isSelectedItem
      ? theme.colors.surfaceBorderSelected
      : theme.colors.surfaceBorderPrimary;

  return (
    <View
      style={[
        styles.cardContainer,
        { backgroundColor: theme.colors.surfacePrimary },
        style,
      ]}
    >
      <RipplePressable
        onPress={() => {
          if (!isEditing && enableInteractions) {
            onTap?.();
          }
        }}
        onLongPress={() => {
          if (enableInteractions) {
            onLongPress?.();
          }
        }}
        rippleColor={theme.colors.ripple}
        disabled={!enableInteractions && !isEditing}
        style={({ pressed }) => [
          styles.container,
          {
            backgroundColor: innerBackgroundColor,
            borderColor,
            borderWidth: 1,
            opacity: enableInteractions ? iosPressed(pressed) : 1,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.timestampContainer}>
            {(showSkeleton ||
              !(isLivePreviewItem && transcription.text === "")) && (
              <Text variant="caption1" color={theme.colors.textSecondary}>
                {dateFormat.format(transcription.timestamp)}
                {"  "}
                <Text variant="caption1" color={theme.colors.textTertiary}>
                  {TIME_FORMAT.format(transcription.timestamp)}
                </Text>
              </Text>
            )}
          </View>

          <View style={styles.actionsContainer}>
            {showCheckbox && (
              <Checkbox
                size="small"
                value={isSelected}
                onValueChange={() => {}}
                enabled={true}
              />
            )}

            {showEditIcon && (
              <RipplePressable
                onPress={onStartEdit}
                disabled={disableIcons}
                hitSlop={10}
                rippleColor={theme.colors.ripple}
                borderless
                style={[styles.iconButton, { opacity: disableIcons ? 0.5 : 1 }]}
              >
                <Icon
                  name="edit"
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </RipplePressable>
            )}
          </View>
        </View>

        <View style={styles.contentContainer}>
          {isEditing ? (
            <TextInput
              ref={inputRef}
              value={editText}
              onChangeText={setEditText}
              onBlur={handleSaveEdit}
              multiline
              autoFocus
              disableFullscreenUI
              style={[
                styles.input,
                {
                  color: theme.colors.textPrimary,
                  ...theme.typography.body1,
                },
              ]}
            />
          ) : showSkeleton ? (
            <View style={styles.skeletonContainer}>
              <Skeleton borderRadius={8} width="100%" height={16} />
              <Skeleton
                borderRadius={8}
                width="60%"
                height={16}
                style={{ marginTop: 6 }}
              />
            </View>
          ) : (
            <Text variant="body1" color={theme.colors.textSecondary}>
              {transcription.text}
            </Text>
          )}
        </View>
      </RipplePressable>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 16,
    marginBottom: 16,
  },
  container: {
    borderRadius: 16,
    padding: 16,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  timestampContainer: {
    flex: 1,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    minHeight: 24,
  },
  skeletonContainer: {
    minHeight: 38,
  },
  input: {
    padding: 0,
    textAlignVertical: "top",
  },
});
