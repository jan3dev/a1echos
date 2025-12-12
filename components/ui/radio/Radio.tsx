import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

export type RadioSize = 'large' | 'small';

interface RadioProps<T> {
  value: T;
  groupValue?: T;
  onValueChange?: (value: T) => void;
  enabled?: boolean;
  size?: RadioSize;
}

export const Radio = <T,>({
  value,
  groupValue,
  onValueChange,
  enabled = true,
  size = 'large',
}: RadioProps<T>) => {
  const { theme } = useTheme();
  const colors = theme.colors;

  const isSelected = value === groupValue;
  const boxSize = size === 'large' ? 24 : 18;
  const dotSize = size === 'large' ? 10 : 7.5;

  const handlePress = () => {
    if (enabled && onValueChange) {
      onValueChange(value);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={!enabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected, disabled: !enabled }}
      style={({ pressed }) => [
        styles.pressable,
        { opacity: enabled ? (pressed ? 0.8 : 1) : 0.5 },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            width: boxSize,
            height: boxSize,
            backgroundColor: isSelected
              ? colors.accentBrand
              : colors.surfaceTertiary,
            borderWidth: isSelected ? 0 : 2,
            borderColor: colors.surfaceBorderSecondary,
          },
        ]}
      >
        {isSelected && (
          <View
            style={[
              styles.dot,
              {
                width: dotSize,
                height: dotSize,
                backgroundColor: colors.surfaceTertiary,
              },
            ]}
          />
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'flex-start',
  },
  container: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    borderRadius: 999,
  },
});
