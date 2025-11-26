import { useCallback, useRef, useState } from 'react';
import { ToastVariant } from './Toast';

export interface ToastOptions {
  title: string;
  message: string;
  primaryButtonText?: string;
  onPrimaryButtonTap?: () => void;
  secondaryButtonText?: string;
  onSecondaryButtonTap?: () => void;
  variant?: ToastVariant;
  titleMaxLines?: number;
  messageMaxLines?: number;
}

interface ToastState extends ToastOptions {
  visible: boolean;
}

export const useToast = () => {
  const [toastState, setToastState] = useState<ToastState>({
    visible: false,
    title: '',
    message: '',
  });

  const primaryCallbackRef = useRef<(() => void) | undefined>(undefined);
  const secondaryCallbackRef = useRef<(() => void) | undefined>(undefined);

  // Update refs when state changes
  primaryCallbackRef.current = toastState.onPrimaryButtonTap;
  secondaryCallbackRef.current = toastState.onSecondaryButtonTap;

  const show = useCallback((options: ToastOptions) => {
    setToastState({
      ...options,
      visible: true,
    });
  }, []);

  const hide = useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

  const handlePrimaryButtonTap = useCallback(() => {
    primaryCallbackRef.current?.();
    hide();
  }, [hide]);

  const handleSecondaryButtonTap = useCallback(() => {
    secondaryCallbackRef.current?.();
    hide();
  }, [hide]);

  return {
    show,
    hide,
    toastState: {
      ...toastState,
      onPrimaryButtonTap: handlePrimaryButtonTap,
      onSecondaryButtonTap: handleSecondaryButtonTap,
      onDismiss: hide,
    },
  };
};
