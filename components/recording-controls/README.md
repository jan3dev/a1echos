# Recording Controls Components

React Native implementation of the Flutter recording controls components, migrated from `temp/echos-flutter/packages/ui_components/lib/components/recording_controls/`.

## Components

### RecordingControlsView
Main container component with glass morphism backdrop that manages the recording interface layout.

**Features:**
- Fixed height: 96px (64px button + 32px padding)
- Glass backdrop using expo-blur
- Stack layout: Backdrop → Wave lines → Recording button (centered)
- Four states: ready, recording, transcribing, loading

**Usage:**
```tsx
import { RecordingControlsView } from './components/recording-controls';
import { useTheme } from './theme';

<RecordingControlsView
  state="recording"
  audioLevel={0.7}
  onRecordingStart={handleStart}
  onRecordingStop={handleStop}
  colors={colors}
/>
```

### RecordingButton
Animated circular button with multiple states and visual feedback.

**States:**
- `ready`: Glass morphism circle with mic icon
- `recording`: Solid brand color with pulsing glow and stop icon
- `transcribing`: Disabled glass circle with mic icon
- `loading`: Same as transcribing

**Features:**
- Scale animation (1.0 → 1.15) with 250ms duration
- Pulsing glow animation (2000ms cycle) during recording
- Debouncing (800ms) and gesture isolation (2000ms)
- Haptic feedback on press
- Platform-specific shadow effects

### ThreeWaveLines
Complex audio-reactive wave visualization with 3 simultaneous sine waves.

**Technical Details:**
- 120 data points per wave
- 60fps updates via requestAnimationFrame
- Three wave profiles with different colors, frequencies, and reactivity
- State-dependent behavior (idle/reactive/oscillating)
- Smooth interpolation between targets

**Wave Colors:**
- Wave 1: Orange (#F7931A) - 0.8 audio reactivity
- Wave 2: Brand Blue (#4361EE) - 1.0 audio reactivity (most reactive)
- Wave 3: Cyan (#16BAC5) - 0.5 audio reactivity

### LockIndicator
Lock indicator with animated slide-in and opacity transitions.

**Features:**
- Animated progress controls opacity and vertical translation
- Glass morphism rounded container
- Stack of icons: Settings (optional) → Lock → ChevronUp
- Two variants: standard (32x72) and with settings (40x104)

**Usage:**
```tsx
import { LockIndicator, LockIndicatorWithSettings } from './components/recording-controls';
import { useSharedValue } from 'react-native-reanimated';

const progress = useSharedValue(0);

<LockIndicator
  progress={progress}
  isLocked={false}
  colors={colors}
/>
```

## Icon System

All icons are centralized in `components/icon/Icon.tsx` with raw SVG assets in `assets/icons/`.

**Available Icons:**
- `mic`: Microphone icon (24x24)
- `rectangle`: Stop recording square (18x18)
- `lock`: Lock icon (24x24)
- `chevron-up`: Up chevron (24x24)
- `settings`: Settings gear icon (24x24)

**Usage:**
```tsx
import { Icon } from './components/icon';

<Icon name="mic" size={24} color="#090A0B" />
```

## Dependencies

The following packages are required:

```json
{
  "expo-blur": "~13.0.2",
  "react-native-reanimated": "~3.10.1",
  "react-native-svg": "15.2.0",
  "expo-haptics": "~13.0.1"
}
```

## Migration Notes

### From Flutter to React Native

1. **Glass Morphism**: Flutter's `BackdropFilter` → expo-blur's `BlurView`
   - Blur intensity may differ slightly, tuned for visual match

2. **Animations**: Flutter's `AnimationController` → react-native-reanimated
   - Using `useSharedValue` and `withTiming` for smooth animations
   - Scale, glow, and wave animations at 60fps

3. **Canvas Drawing**: Flutter's `CustomPaint` → react-native-svg
   - SVG Path generation for wave visualization
   - Refs used to avoid re-renders for performance

4. **Haptic Feedback**: Flutter's `HapticFeedback` → expo-haptics
   - Medium impact for start, light impact for stop

5. **State Management**: Props-based, no internal state management library
   - Compatible with any React state management solution

## Performance Considerations

- **ThreeWaveLines**: Uses refs to store wave data, avoiding React state updates for 60fps performance
- **RecordingButton**: Debouncing and gesture isolation prevent rapid state changes
- **Animations**: Hardware-accelerated via react-native-reanimated
- **SVG Rendering**: Optimized path generation with cubic bezier interpolation

## Testing Recommendations

1. **Visual**: Compare side-by-side with Flutter app
2. **Animation**: Verify 60fps wave rendering, no jank
3. **Audio Reactivity**: Test wave response at levels 0, 0.5, 1.0
4. **State Transitions**: Test all state changes (ready→recording→transcribing→ready)
5. **Haptics**: Verify tactile feedback on button presses
6. **Debouncing**: Verify rapid taps are throttled
7. **Themes**: Test with light/dark theme colors
8. **Platform**: Test on both iOS and Android for visual consistency

