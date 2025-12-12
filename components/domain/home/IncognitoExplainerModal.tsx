import { Icon, Modal } from '@/components';
import { useLocalization } from '@/hooks';
import { lightColors } from '@/theme';

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
