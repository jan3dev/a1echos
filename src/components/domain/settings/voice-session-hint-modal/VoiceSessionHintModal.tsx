import { TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { useTheme } from "@/theme";

import { Icon } from "../../../ui/icon/Icon";
import { Modal } from "../../../ui/modal/Modal";

interface VoiceSessionHintModalProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Shown when Echos is opened from the iOS keyboard's mic button. iOS can't
 * return the user to the app they were typing in, so this sheet tells them to
 * swipe back — the hot mic stays armed in the background while they do.
 */
export const VoiceSessionHintModal = ({
  visible,
  onDismiss,
}: VoiceSessionHintModalProps) => {
  const { loc } = useLocalization();
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      testID={TestID.VoiceSessionHintModal}
      title={loc.voiceSessionHintTitle}
      message={loc.voiceSessionHintBody}
      primaryButton={{ text: loc.voiceSessionHintCta, onTap: onDismiss }}
      onDismiss={onDismiss}
      icon={
        <Icon name="voice_circle" size={32} color={theme.colors.textPrimary} />
      }
    />
  );
};
