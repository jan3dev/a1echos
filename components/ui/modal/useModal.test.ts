import { act, renderHook } from '@testing-library/react-native';

import { ModalOptions, useModal } from './useModal';

describe('useModal', () => {
  const makeOptions = (overrides?: Partial<ModalOptions>): ModalOptions => ({
    title: 'Confirm',
    message: 'Are you sure?',
    primaryButton: {
      text: 'OK',
      onTap: jest.fn(),
    },
    ...overrides,
  });

  it('initializes with visible=false', () => {
    const { result } = renderHook(() => useModal());

    expect(result.current.modalState.visible).toBe(false);
  });

  it('show() sets visible=true', () => {
    const { result } = renderHook(() => useModal());

    act(() => {
      result.current.show(makeOptions());
    });

    expect(result.current.modalState.visible).toBe(true);
    expect(result.current.modalState.title).toBe('Confirm');
    expect(result.current.modalState.message).toBe('Are you sure?');
  });

  it('hide() sets visible=false', () => {
    const { result } = renderHook(() => useModal());

    act(() => {
      result.current.show(makeOptions());
    });
    expect(result.current.modalState.visible).toBe(true);

    act(() => {
      result.current.hide();
    });
    expect(result.current.modalState.visible).toBe(false);
  });

  it('provides modalProps with title, message, buttons, and onDismiss', () => {
    const primaryOnTap = jest.fn();
    const secondaryOnTap = jest.fn();
    const { result } = renderHook(() => useModal());

    act(() => {
      result.current.show(
        makeOptions({
          title: 'Delete',
          message: 'This cannot be undone.',
          messageTertiary: 'All data will be lost.',
          primaryButton: {
            text: 'Delete',
            onTap: primaryOnTap,
            variant: 'error',
          },
          secondaryButton: {
            text: 'Cancel',
            onTap: secondaryOnTap,
            variant: 'normal',
          },
        }),
      );
    });

    const { modalState } = result.current;
    expect(modalState.title).toBe('Delete');
    expect(modalState.message).toBe('This cannot be undone.');
    expect(modalState.messageTertiary).toBe('All data will be lost.');
    expect(modalState.primaryButton.text).toBe('Delete');
    expect(modalState.primaryButton.variant).toBe('error');
    expect(modalState.secondaryButton).toBeDefined();
    expect(modalState.secondaryButton!.text).toBe('Cancel');
    expect(modalState.secondaryButton!.variant).toBe('normal');
    expect(typeof modalState.onDismiss).toBe('function');
  });

  it('primary button tap calls callback and hides modal (auto-dismiss)', () => {
    const primaryOnTap = jest.fn();
    const { result } = renderHook(() => useModal());

    act(() => {
      result.current.show(
        makeOptions({ primaryButton: { text: 'OK', onTap: primaryOnTap } }),
      );
    });
    expect(result.current.modalState.visible).toBe(true);

    act(() => {
      result.current.modalState.primaryButton.onTap();
    });

    expect(primaryOnTap).toHaveBeenCalledTimes(1);
    expect(result.current.modalState.visible).toBe(false);
  });

  it('secondary button tap calls callback and hides modal (auto-dismiss)', () => {
    const secondaryOnTap = jest.fn();
    const { result } = renderHook(() => useModal());

    act(() => {
      result.current.show(
        makeOptions({
          secondaryButton: { text: 'Cancel', onTap: secondaryOnTap },
        }),
      );
    });
    expect(result.current.modalState.visible).toBe(true);

    act(() => {
      result.current.modalState.secondaryButton!.onTap();
    });

    expect(secondaryOnTap).toHaveBeenCalledTimes(1);
    expect(result.current.modalState.visible).toBe(false);
  });

  it('onDismiss hides the modal', () => {
    const { result } = renderHook(() => useModal());

    act(() => {
      result.current.show(makeOptions());
    });
    expect(result.current.modalState.visible).toBe(true);

    act(() => {
      result.current.modalState.onDismiss();
    });
    expect(result.current.modalState.visible).toBe(false);
  });

  it('returns undefined for secondaryButton when none is provided', () => {
    const { result } = renderHook(() => useModal());

    act(() => {
      result.current.show(makeOptions());
    });

    expect(result.current.modalState.secondaryButton).toBeUndefined();
  });

  it('does not crash when buttons are tapped in initial state before show()', () => {
    const { result } = renderHook(() => useModal());

    // Tapping buttons before show() should invoke the default no-op callbacks without error
    act(() => {
      result.current.modalState.primaryButton.onTap();
    });
    expect(result.current.modalState.visible).toBe(false);

    // Secondary button exists in the initial state with a default handler
    act(() => {
      result.current.modalState.secondaryButton?.onTap();
    });
    expect(result.current.modalState.visible).toBe(false);
  });
});
