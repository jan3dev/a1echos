import { StyleSheet, View } from 'react-native';

import { lightColors, useTheme } from '@/theme';
import { iosPressed } from '@/utils';

import { Icon } from '../icon/Icon';
import { RipplePressable } from '../ripple-pressable/RipplePressable';

export type CheckboxSize = 'large' | 'small';

interface CheckboxProps {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  enabled?: boolean;
  size?: CheckboxSize;
}

export const Checkbox = ({
  value,
  onValueChange,
  enabled = true,
  size = 'large',
}: CheckboxProps) => {
  const { theme, isDark } = useTheme();
  const colors = theme.colors;

  const boxSize = size === 'large' ? 24 : 18;
  const checkSize = size === 'large' ? 18 : 16;
  const borderWidth = size === 'large' ? 2 : 1.5;
  const borderRadius = size === 'large' ? 4 : 3;

  const handlePress = () => {
    if (enabled && onValueChange) {
      onValueChange(!value);
    }
  };

  return (
    <RipplePressable
      onPress={handlePress}
      disabled={!enabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled: !enabled }}
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
            borderRadius,
            backgroundColor: value
              ? colors.accentBrand
              : isDark
              ? colors.surfaceTertiary
              : '#F4F5F6',
            borderWidth: value ? 0 : borderWidth,
            borderColor: colors.surfaceBorderSecondary,
          },
        ]}
      >
        {value && (
          <Icon name="check" size={checkSize} color={lightColors.textInverse} />
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
