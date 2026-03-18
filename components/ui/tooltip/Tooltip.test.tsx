import { act, render } from '@testing-library/react-native';
import React from 'react';

import { lightColors } from '@/theme/themeColors';

import { Tooltip } from './Tooltip';

const defaultProps = {
  visible: true,
  message: 'This is a tooltip',
  onDismiss: jest.fn(),
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe('Tooltip', () => {
  it('renders message text when visible', () => {
    const { getByText } = render(<Tooltip {...defaultProps} />);
    act(() => {
      jest.runAllTimers();
    });
    expect(getByText('This is a tooltip')).toBeTruthy();
  });

  it('applies variant background color for success variant', () => {
    const { toJSON } = render(<Tooltip {...defaultProps} variant="success" />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // Success variant uses accentSuccessTransparent as background color
    expect(json).toContain(lightColors.accentSuccessTransparent);
  });

  it('renders SVG pointer when pointerPosition is top', () => {
    const { toJSON } = render(
      <Tooltip {...defaultProps} pointerPosition="top" />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // The pointer renders an Svg (mocked as "Svg" string) and a Path
    // (mocked as "Path" string). The pointer container has marginBottom: -1
    // for top position.
    expect(json).toContain('Svg');
    expect(json).toContain('Path');
    // Top pointer has marginBottom: -1
    expect(json).toContain('"marginBottom":-1');
  });

  it('renders SVG pointer when pointerPosition is bottom', () => {
    const { toJSON } = render(
      <Tooltip {...defaultProps} pointerPosition="bottom" />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain('Svg');
    expect(json).toContain('Path');
    // Bottom pointer has marginTop: -1
    expect(json).toContain('"marginTop":-1');
  });

  it('dismissible tooltip has pointerEvents auto', () => {
    const { toJSON } = render(
      <Tooltip {...defaultProps} isDismissible={true} />,
    );
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // The outermost Animated.View has pointerEvents="auto" when isDismissible
    expect(json).toContain('"pointerEvents":"auto"');
  });

  it('info mode shows leading icon', () => {
    const { toJSON } = render(<Tooltip {...defaultProps} isInfo={true} />);
    act(() => {
      jest.runAllTimers();
    });
    const json = JSON.stringify(toJSON());
    // Info mode renders an Icon component (warning icon by default, size 18).
    // The Icon has a container View with width: 18 and height: 18.
    expect(json).toContain('"width":18');
    expect(json).toContain('"height":18');
  });
});
