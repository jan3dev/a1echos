import React from 'react';
import { useLocalization } from '../../../hooks/useLocalization';
import { useTheme } from '../../../theme';
import { Icon } from '../../ui/icon';
import { Modal } from '../../ui/modal';

interface IncognitoExplainerModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export const IncognitoExplainerModal = ({
  visible,
  onDismiss,
}: IncognitoExplainerModalProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();

  return (
    <Modal
      visible={visible}
      title={loc.incognitoExplainerTitle}
      message={loc.incognitoExplainerBody}
      primaryButton={{
        text: loc.incognitoExplainerCta,
        onTap: onDismiss,
      }}
      icon={<Icon name="ghost" size={24} color={theme.colors.textInverse} />}
      iconVariant="info"
      onDismiss={onDismiss}
    />
  );
};
