import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View, ViewStyle } from 'react-native';

import { useLocalization } from '@/hooks';
import { Transcription } from '@/models';
import { useUIStore } from '@/stores';
import { getShadow, useTheme } from '@/theme';
import { FeatureFlag, iosPressed, logError } from '@/utils';

import { Checkbox } from '../../ui/checkbox/Checkbox';
import { Icon } from '../../ui/icon/Icon';
import { RipplePressable } from '../../ui/ripple-pressable/RipplePressable';
import { Skeleton } from '../../ui/skeleton/Skeleton';
import { Text } from '../../ui/text/Text';

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
  const { loc } = useLocalization();
  const showGlobalTooltip = useUIStore((state) => state.showGlobalTooltip);
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

  const handleCopyToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(transcription.text);
      await Haptics.selectionAsync();

      // Show tooltip on iOS or Android < 12 (API 31 has native clipboard feedback)
      if (
        Platform.OS === 'ios' ||
        (Platform.OS === 'android' && Number(Platform.Version) < 31)
      ) {
        showGlobalTooltip(loc.copiedToClipboard);
      }
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: 'Failed to copy to clipboard',
      });
      showGlobalTooltip(
        loc.copyFailed(error instanceof Error ? error.message : String(error)),
        'normal',
        undefined,
        true,
      );
    }
  };

  const now = new Date();
  const isOlderThanCurrentYear =
    transcription.timestamp.getFullYear() < now.getFullYear();

  const dateFormat = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: isOlderThanCurrentYear ? 'numeric' : undefined,
  });

  const timeFormat = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });

  const showSkeleton = isLoadingWhisperResult || isWhisperRecording;

  const enableInteractions = !isLivePreviewItem && !showSkeleton;
  const showCopyIcon = !isLivePreviewItem && !selectionMode;
  const showEditIcon = !isLivePreviewItem && !selectionMode;
  const showCheckbox = selectionMode && !isLivePreviewItem;
  const disableIcons = showSkeleton || (isAnyEditing && !isEditing);

  const backgroundColor =
    selectionMode && isSelected
      ? theme.colors.surfaceSelected
      : theme.colors.surfacePrimary;

  return (
    <View
      style={[
        styles.shadowContainer,
        getShadow('cardElevated'),
        { backgroundColor },
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
            backgroundColor,
            borderColor: isEditing ? theme.colors.accentBrand : 'transparent',
            borderWidth: isEditing ? 1 : 0,
            opacity: enableInteractions ? iosPressed(pressed) : 1,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.timestampContainer}>
            {(showSkeleton ||
              !(isLivePreviewItem && transcription.text === '')) && (
              <Text variant="caption1" color={theme.colors.textSecondary}>
                {dateFormat.format(transcription.timestamp)}
                {'  '}
                <Text variant="caption1" color={theme.colors.textTertiary}>
                  {timeFormat.format(transcription.timestamp)}
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

            {showEditIcon && showCopyIcon && <View style={{ width: 16 }} />}

            {showCopyIcon && (
              <RipplePressable
                onPress={handleCopyToClipboard}
                disabled={disableIcons}
                hitSlop={10}
                rippleColor={theme.colors.ripple}
                borderless
                style={[styles.iconButton, { opacity: disableIcons ? 0.5 : 1 }]}
              >
                <Icon
                  name="copy"
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
  shadowContainer: {
    borderRadius: 8,
    marginBottom: 16,
  },
  container: {
    borderRadius: 8,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timestampContainer: {
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    minHeight: 24,
  },
  skeletonContainer: {
    minHeight: 38,
  },
  input: {
    padding: 0,
    textAlignVertical: 'top',
  },
});
