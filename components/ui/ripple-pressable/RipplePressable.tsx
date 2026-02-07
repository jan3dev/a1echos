import { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  PressableProps,
  TouchableNativeFeedback,
  View,
} from 'react-native';

type RipplePressableProps = Omit<
  PressableProps,
  'android_ripple' | 'children'
> & {
  rippleColor?: string;
  borderless?: boolean;
  children?: ReactNode;
};

export const RipplePressable = ({
  rippleColor,
  borderless = false,
  children,
  style,
  ...rest
}: RipplePressableProps) => {
  if (Platform.OS === 'android' && rippleColor) {
    const resolvedStyle =
      typeof style === 'function'
        ? style({ pressed: false, hovered: false })
        : style;

    return (
      <TouchableNativeFeedback
        onPress={rest.onPress ?? undefined}
        onLongPress={rest.onLongPress ?? undefined}
        disabled={rest.disabled ?? undefined}
        hitSlop={rest.hitSlop}
        accessibilityRole={rest.accessibilityRole}
        accessibilityState={rest.accessibilityState}
        accessibilityLabel={rest.accessibilityLabel}
        accessibilityHint={rest.accessibilityHint}
        background={TouchableNativeFeedback.Ripple(rippleColor, borderless)}
        useForeground={TouchableNativeFeedback.canUseNativeForeground()}
      >
        <View style={resolvedStyle}>{children}</View>
      </TouchableNativeFeedback>
    );
  }

  return (
    <Pressable style={style} {...rest}>
      {children}
    </Pressable>
  );
};
