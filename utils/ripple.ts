import { Platform } from 'react-native';

export const iosPressed = (pressed: boolean, opacity = 0.7): number =>
  Platform.OS === 'ios' && pressed ? opacity : 1;
