import React from 'react';
import { View } from 'react-native';
import { flagIcons } from './flagIcons';

interface FlagIconProps {
  name: string;
  size?: number;
}

export const FlagIcon = ({ name, size = 24 }: FlagIconProps) => {
  const Flag = flagIcons[name];

  if (!Flag) {
    console.warn(`Flag icon not found for: ${name}`);
    return <View style={{ width: size, height: size }} />;
  }

  return <Flag width={size} height={size} />;
};
