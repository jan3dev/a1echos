import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppConstants } from "@/constants";
import { useScrollSurface } from "@/hooks";
import { useTheme } from "@/theme";
import { delay, FeatureFlag, logError } from "@/utils";

import { ListItem } from "../list-item";
import { Screen } from "../screen";
import { AppBarBlurTarget, Radio, TopAppBar } from "../../ui";

/** How long the chosen row stays visibly selected before navigating back, so
 *  the tap registers even when persistence resolves immediately. */
const SELECTION_FEEDBACK_MS = 400;

export interface OptionPickerScreenProps<T extends string | number> {
  /** Title for the top app bar. */
  title: string;
  /** The selectable values, in display order. */
  options: readonly T[];
  /** The currently persisted value. */
  selected: T;
  /** Persists the chosen value. Rejecting restores the previous selection. */
  onSelect: (value: T) => Promise<void>;
  /** Row label for a value. */
  labelFor: (value: T) => string;
  /** Optional one-line explanation under the label, for pickers whose option
   *  names don't speak for themselves. Omit for self-evident lists. */
  descriptionFor?: (value: T) => string;
  /** Row testIDs are `${testIDPrefix}-${value}`. */
  testIDPrefix: string;
  /** Logged if `onSelect` rejects. */
  errorMessage: string;
}

/**
 * Single-select settings picker: a list of radio rows that persists on tap and
 * navigates back. Shared by the theme / mic-timeout / LM-strength style
 * screens, which differ only in their options, labels and setter.
 *
 * Taps are ignored while a save is in flight, and the chosen row shows as
 * selected immediately (optimistically) so the picker never looks unresponsive.
 */
export const OptionPickerScreen = <T extends string | number>({
  title,
  options,
  selected,
  onSelect,
  labelFor,
  descriptionFor,
  testIDPrefix,
  errorMessage,
}: OptionPickerScreenProps<T>) => {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);
  const { scrolled, onScroll } = useScrollSurface();

  // Non-null exactly while a save is in flight, doubling as the optimistic
  // selection — so there is no separate `isSaving` flag to keep in step.
  const [pending, setPending] = useState<T | null>(null);
  const isSaving = pending !== null;
  const effective = pending ?? selected;

  const handleSelect = async (value: T) => {
    if (value === selected) {
      router.back();
      return;
    }
    if (isSaving) return;

    setPending(value);

    const feedback = delay(SELECTION_FEEDBACK_MS);
    try {
      await onSelect(value);
      await feedback;
      router.back();
    } catch (error) {
      setPending(null);
      logError(error, {
        flag: FeatureFlag.settings,
        message: errorMessage,
      });
    }
  };

  return (
    <Screen>
      {/* Bars render after content so Android's blur target ref is populated
          before the bar's BlurView mounts and resolves its `blurTarget`. */}
      <AppBarBlurTarget targetRef={blurTargetRef} style={styles.fill}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
              paddingBottom: insets.bottom + 16,
              backgroundColor: theme.colors.surfaceBackground,
            },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.list}>
            {options.map((value) => (
              <ListItem
                key={value}
                testID={`${testIDPrefix}-${value}`}
                title={labelFor(value)}
                subtitle={descriptionFor?.(value)}
                iconTrailing={
                  <Radio<T>
                    value={value}
                    size="small"
                    groupValue={effective}
                    onValueChange={
                      isSaving ? undefined : () => handleSelect(value)
                    }
                    enabled={!isSaving}
                  />
                }
                onPress={isSaving ? undefined : () => handleSelect(value)}
              />
            ))}
          </View>
        </ScrollView>
      </AppBarBlurTarget>

      <TopAppBar title={title} blurTarget={blurTargetRef} scrolled={scrolled} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  list: {
    gap: 16,
  },
});
