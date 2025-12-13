import { View } from 'react-native';

import { logWarn } from '@/utils';

import { flagIcons } from './flagIcons';

interface FlagIconProps {
  name: string;
  size?: number;
}

export const FlagIcon = ({ name, size = 24 }: FlagIconProps) => {
  const Flag = flagIcons[name];

  if (!Flag) {
    logWarn(`Flag icon not found for: ${name}`);
    return <View style={{ width: size, height: size }} />;
  }

  return <Flag width={size} height={size} />;
};
