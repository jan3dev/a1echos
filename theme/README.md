# Theme System

Complete theme system implementation for the Echos React Native app, converted from Flutter's Aqua design system.

## Structure

```
theme/
├── colors.ts           # Primitive color definitions
├── themeColors.ts      # Light/dark theme color tokens
├── typography.ts       # Text style definitions
├── spacing.ts          # 8px grid spacing system
├── shadows.ts          # React Native shadow utilities
├── useThemeStore.ts    # Zustand theme state management
├── useTheme.ts         # Theme consumption hook
└── index.ts            # Barrel exports
```

## Usage

### Initialize Theme (in App Root)

```typescript
import { useEffect } from 'react';
import { useThemeStore } from './theme';

function App() {
  const initTheme = useThemeStore(state => state.initTheme);
  
  useEffect(() => {
    initTheme();
  }, []);
  
  return <YourApp />;
}
```

### Using Theme in Components

```typescript
import { View, Text } from 'react-native';
import { useTheme } from './theme';

export const MyComponent = () => {
  const { theme, isDark } = useTheme();
  
  return (
    <View style={{ 
      backgroundColor: theme.colors.surfaceBackground,
      padding: theme.spacing.md 
    }}>
      <Text style={{
        ...theme.typography.h4,
        color: theme.colors.textPrimary
      }}>
        Hello World
      </Text>
    </View>
  );
};
```

### Switching Themes

```typescript
import { AppTheme } from '../models/AppTheme';
import { useTheme } from './theme';

export const ThemeSettings = () => {
  const { selectedTheme, setTheme } = useTheme();
  
  return (
    <View>
      <Button onPress={() => setTheme(AppTheme.LIGHT)}>Light</Button>
      <Button onPress={() => setTheme(AppTheme.DARK)}>Dark</Button>
      <Button onPress={() => setTheme(AppTheme.AUTO)}>Auto</Button>
    </View>
  );
};
```

### Using Shadows

```typescript
import { View } from 'react-native';
import { getShadow } from './theme';

export const Card = () => (
  <View style={[
    { backgroundColor: 'white', borderRadius: 8 },
    getShadow('medium')
  ]}>
    <Text>Card Content</Text>
  </View>
);
```

## Color Tokens

### Text Colors
- `textPrimary` - Primary text color
- `textSecondary` - Secondary text color
- `textTertiary` - Tertiary text color
- `textInverse` - Inverse text color (for dark backgrounds)

### Surface Colors
- `surfacePrimary` - Primary surface background
- `surfaceSecondary` - Secondary surface background
- `surfaceTertiary` - Tertiary surface background
- `surfaceBackground` - App background color
- `surfaceSelected` - Selected state background
- `surfaceInverse` - Inverse surface color

### Border Colors
- `surfaceBorderPrimary` - Primary borders
- `surfaceBorderSecondary` - Secondary borders
- `surfaceBorderSelected` - Selected state borders

### Accent Colors
- `accentBrand` - Brand color (neon blue)
- `accentSuccess` - Success color (green)
- `accentWarning` - Warning color (amber)
- `accentDanger` - Danger color (scarlet)
- Each with `Transparent` variant (16% opacity)

### Glass Effect Colors
- `glassSurface` - Glass surface effect
- `glassInverse` - Inverse glass effect
- `glassBackground` - Glass background effect

## Typography

### Fonts
- **Manrope**: Headers (h1-h5, subtitle)
- **PublicSans**: Body text (body1, body2, caption1, caption2)

### Weight Variants
- Regular (400)
- Medium (500)
- SemiBold (600)

### Sizes
- h1: 50px
- h2: 40px
- h3: 30px
- h4: 24px
- h5: 20px
- subtitle: 18px
- body1: 16px
- body2: 14px
- caption1: 12px
- caption2: 10px

## Spacing Scale

Based on 8px grid system:

- `xs`: 4px
- `sm`: 8px
- `md`: 16px
- `lg`: 24px
- `xl`: 32px
- `xxl`: 40px
- `xxxl`: 48px
- `unit` through `unit8`: 8px increments

## Features

- ✅ Auto theme detection (follows system)
- ✅ Theme persistence (AsyncStorage)
- ✅ Light and dark themes
- ✅ Complete color token system
- ✅ Full typography scale
- ✅ 8px grid spacing
- ✅ Cross-platform shadows
- ✅ Type-safe theme access
- ✅ Memoized for performance

## Dependencies

- `zustand`: ^5.0.8 (state management)
- `@react-native-async-storage/async-storage`: ^2.2.0 (persistence)

