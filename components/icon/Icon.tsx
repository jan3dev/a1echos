import React from 'react';
import { StyleSheet, View } from 'react-native';
import ChevronUpIcon from '../../assets/icons/chevron_up.svg';
import LockIcon from '../../assets/icons/lock.svg';
import MicIcon from '../../assets/icons/mic.svg';
import RectangleIcon from '../../assets/icons/rectangle.svg';
import SettingsIcon from '../../assets/icons/settings.svg';

export type IconName = 'mic' | 'rectangle' | 'lock' | 'chevron-up' | 'settings';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

const iconComponents = {
  mic: MicIcon,
  rectangle: RectangleIcon,
  lock: LockIcon,
  'chevron-up': ChevronUpIcon,
  settings: SettingsIcon,
};

export const Icon = ({ name, size = 24, color = '#090A0B' }: IconProps) => {
  const IconComponent = iconComponents[name];

  if (!IconComponent) {
    return null;
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
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
