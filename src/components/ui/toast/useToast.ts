import { useCallback, useState } from "react";

import { ToastVariant } from "./Toast";

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
  durationMs?: number;
}

interface ToastState extends ToastOptions {
  visible: boolean;
}

export const useToast = () => {
  const [toastState, setToastState] = useState<ToastState>({
    visible: false,
    title: "",
    message: "",
  });

  const show = useCallback((options: ToastOptions) => {
    setToastState({
      ...options,
      visible: true,
    });
  }, []);

  const hide = useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

  const { onPrimaryButtonTap, onSecondaryButtonTap } = toastState;

  const handlePrimaryButtonTap = useCallback(() => {
    onPrimaryButtonTap?.();
    hide();
  }, [onPrimaryButtonTap, hide]);

  const handleSecondaryButtonTap = useCallback(() => {
    onSecondaryButtonTap?.();
    hide();
  }, [onSecondaryButtonTap, hide]);

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
