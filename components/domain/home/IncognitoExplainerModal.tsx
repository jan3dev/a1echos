import React from 'react';
import { useLocalization } from '../../../hooks/useLocalization';
import { lightColors } from '../../../theme/themeColors';
import { Icon } from '../../ui/icon';
import { Modal } from '../../ui/modal';

interface IncognitoExplainerModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const IncognitoExplainerModal = ({
  visible,
  onConfirm,
  onCancel,
}: IncognitoExplainerModalProps) => {
  const { loc } = useLocalization();

  return (
    <Modal
      visible={visible}
      title={loc.incognitoExplainerTitle}
      message={loc.incognitoExplainerBody}
      primaryButton={{
        text: loc.incognitoExplainerCta,
        onTap: onConfirm,
      }}
      icon={<Icon name="ghost" size={24} color={lightColors.textInverse} />}
      iconVariant="info"
      onDismiss={onCancel}
    />
  );
};
