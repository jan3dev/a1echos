import { StyleSheet, View, ViewStyle } from 'react-native';

import { logWarn } from '@/utils';

import { iconMap, IconName } from './iconMap';

export type { IconName };

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export const Icon = ({
  name,
  size = 24,
  color = '#090A0B',
  style,
}: IconProps) => {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    logWarn(`Icon not found: ${name}`);
    return null;
  }

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <IconComponent width={size} height={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
