import type { Decorator, Preview } from '@storybook/react-native';
import React from 'react';
import { Switch, Text, View } from 'react-native';
import { AppTheme } from '../models/AppTheme';
import { useTheme } from '../theme/useTheme';

const ThemeDecorator: Decorator = (Story) => {
  const { theme, selectedTheme, setTheme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePrimary }}>
      <View
        style={{
          padding: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          backgroundColor: theme.colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.surfaceBorderPrimary,
        }}
      >
        <Text style={{ marginRight: 8, color: theme.colors.textPrimary }}>
          Dark Mode
        </Text>
        <Switch
          accessibilityLabel="Toggle dark mode"
          value={selectedTheme === AppTheme.DARK}
          onValueChange={(value) =>
            setTheme(value ? AppTheme.DARK : AppTheme.LIGHT)
          }
        />
      </View>
      <View style={{ flex: 1 }}>
        <Story />
      </View>
    </View>
  );
};

const preview: Preview = {
  decorators: [ThemeDecorator],
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#F4F5F6' },
        { name: 'dark', value: '#090A0B' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};

export default preview;
