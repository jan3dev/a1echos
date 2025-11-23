import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgProps } from 'react-native-svg';
import ArrowRightIcon from '../../assets/icons/arrow_right.svg';
import CheckIcon from '../../assets/icons/check.svg';
import ChevronUpIcon from '../../assets/icons/chevron_up.svg';
import CircularProgressIcon from '../../assets/icons/circular_progress.svg';
import CloseIcon from '../../assets/icons/close.svg';
import LockIcon from '../../assets/icons/lock.svg';
import MicIcon from '../../assets/icons/mic.svg';
import RectangleIcon from '../../assets/icons/rectangle.svg';
import SettingsIcon from '../../assets/icons/settings.svg';

export const iconNames = [
  'mic',
  'rectangle',
  'lock',
  'chevron-up',
  'settings',
  'close',
  'check',
  'arrow-right',
  'circular-progress',
] as const;

export type IconName = (typeof iconNames)[number];

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

const iconComponents: Record<IconName, React.ComponentType<SvgProps>> = {
  mic: MicIcon,
  rectangle: RectangleIcon,
  lock: LockIcon,
  'chevron-up': ChevronUpIcon,
  settings: SettingsIcon,
  close: CloseIcon,
  check: CheckIcon,
  'arrow-right': ArrowRightIcon,
  'circular-progress': CircularProgressIcon,
};

export const Icon = ({ name, size = 24, color = '#090A0B' }: IconProps) => {
  const IconComponent = iconComponents[name];

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
