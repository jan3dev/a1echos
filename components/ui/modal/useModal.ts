import { ReactNode, useCallback, useState } from "react";

export interface ModalOptions {
  title: string;
  message: string;
  primaryButton: {
    text: string;
    onTap: () => void;
  };
  secondaryButton?: {
    text: string;
    onTap: () => void;
  };
  icon?: ReactNode;
  titleMaxLines?: number;
  messageMaxLines?: number;
}

interface ModalState extends ModalOptions {
  visible: boolean;
}

export const useModal = () => {
  const [modalState, setModalState] = useState<ModalState>({
    visible: false,
    title: "",
    message: "",
    primaryButton: {
      text: "",
      onTap: () => {},
    },
  });

  const show = useCallback((options: ModalOptions) => {
    setModalState({
      ...options,
      visible: true,
    });
  }, []);

  const hide = useCallback(() => {
    setModalState((prev) => ({ ...prev, visible: false }));
  }, []);

  const handlePrimaryButtonTap = useCallback(() => {
    modalState.primaryButton.onTap();
    hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalState.primaryButton.onTap, hide]);

  const handleSecondaryButtonTap = useCallback(() => {
    modalState.secondaryButton?.onTap();
    hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalState.secondaryButton?.onTap, hide]);

  return {
    show,
    hide,
    modalState: {
      ...modalState,
      primaryButton: {
        ...modalState.primaryButton,
        onTap: handlePrimaryButtonTap,
      },
      secondaryButton: modalState.secondaryButton
        ? {
            ...modalState.secondaryButton,
            onTap: handleSecondaryButtonTap,
          }
        : undefined,
      onDismiss: hide,
    },
  };
};
