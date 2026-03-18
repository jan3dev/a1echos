import { act, renderHook } from '@testing-library/react-native';

import { ToastOptions, useToast } from './useToast';

describe('useToast', () => {
  const makeOptions = (overrides?: Partial<ToastOptions>): ToastOptions => ({
    title: 'Success',
    message: 'Operation completed.',
    ...overrides,
  });

  it('initializes with visible=false', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toastState.visible).toBe(false);
    expect(result.current.toastState.title).toBe('');
    expect(result.current.toastState.message).toBe('');
  });

  it('show() sets visible=true with provided props', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.show(
        makeOptions({
          title: 'Saved',
          message: 'Your session has been saved.',
          variant: 'informative',
          primaryButtonText: 'Undo',
        }),
      );
    });

    expect(result.current.toastState.visible).toBe(true);
    expect(result.current.toastState.title).toBe('Saved');
    expect(result.current.toastState.message).toBe(
      'Your session has been saved.',
    );
    expect(result.current.toastState.variant).toBe('informative');
    expect(result.current.toastState.primaryButtonText).toBe('Undo');
  });

  it('hide() sets visible=false', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.show(makeOptions());
    });
    expect(result.current.toastState.visible).toBe(true);

    act(() => {
      result.current.hide();
    });
    expect(result.current.toastState.visible).toBe(false);
  });

  it('wraps primary button callback to auto-hide on tap', () => {
    const onPrimaryTap = jest.fn();
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.show(
        makeOptions({
          onPrimaryButtonTap: onPrimaryTap,
          primaryButtonText: 'Undo',
        }),
      );
    });
    expect(result.current.toastState.visible).toBe(true);

    act(() => {
      result.current.toastState.onPrimaryButtonTap!();
    });

    expect(onPrimaryTap).toHaveBeenCalledTimes(1);
    expect(result.current.toastState.visible).toBe(false);
  });

  it('wraps secondary button callback to auto-hide on tap', () => {
    const onSecondaryTap = jest.fn();
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.show(
        makeOptions({
          onSecondaryButtonTap: onSecondaryTap,
          secondaryButtonText: 'Dismiss',
        }),
      );
    });
    expect(result.current.toastState.visible).toBe(true);

    act(() => {
      result.current.toastState.onSecondaryButtonTap!();
    });

    expect(onSecondaryTap).toHaveBeenCalledTimes(1);
    expect(result.current.toastState.visible).toBe(false);
  });

  it('onDismiss hides the toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.show(makeOptions());
    });
    expect(result.current.toastState.visible).toBe(true);

    act(() => {
      result.current.toastState.onDismiss();
    });
    expect(result.current.toastState.visible).toBe(false);
  });
});
