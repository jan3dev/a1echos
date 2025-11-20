import { withBackgrounds } from '@storybook/addon-ondevice-backgrounds';
import type { Preview } from '@storybook/react-native';

const preview: Preview = {
  decorators: [withBackgrounds],
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#F4F5F6' },
        { name: 'dark', value: '#090A0B' },
        { name: 'white', value: '#FFFFFF' },
        { name: 'brand', value: '#4361EE' },
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
