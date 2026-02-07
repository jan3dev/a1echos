import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { iosPressed } from '@/utils';

import { RipplePressable } from '../ripple-pressable/RipplePressable';

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
    <RipplePressable
      onPress={handlePress}
      disabled={!enabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected, disabled: !enabled }}
      rippleColor={colors.ripple}
      borderless
      style={({ pressed }) => [
        styles.pressable,
        { opacity: enabled ? iosPressed(pressed, 0.8) : 0.5 },
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
    </RipplePressable>
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
