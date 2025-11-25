import { useCallback, useState } from 'react';
import { ButtonVariant } from '../button';
import { ModalVariant } from './Modal';

export interface ModalOptions {
  title: string;
  message: string;
  messageTertiary?: string;
  primaryButton: {
    text: string;
    onTap: () => void;
    variant?: ButtonVariant;
  };
  secondaryButton?: {
    text: string;
    onTap: () => void;
    variant?: ButtonVariant;
  };
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  iconVariant?: ModalVariant;
  titleMaxLines?: number;
  messageMaxLines?: number;
}

interface ModalState extends ModalOptions {
  visible: boolean;
}

export const useModal = () => {
  const [modalState, setModalState] = useState<ModalState>({
    visible: false,
    title: '',
    message: '',
    primaryButton: {
      text: '',
      onTap: () => {},
      variant: 'normal',
    },
    secondaryButton: {
      text: '',
      onTap: () => {},
      variant: 'normal',
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
