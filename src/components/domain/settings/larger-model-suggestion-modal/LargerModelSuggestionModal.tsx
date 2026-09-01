import { TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { useTheme } from "@/theme";

import { Icon } from "../../../ui/icon/Icon";
import { Modal } from "../../../ui/modal/Modal";

interface LargerModelSuggestionModalProps {
  visible: boolean;
  /** Name of the language the user just picked, e.g. "German". */
  languageName: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * Offered once, the first time a non-English language is selected while still
 * on the small bundled model. Whisper Tiny nominally handles 99 languages but
 * is noticeably weaker outside English, and nothing else in the app tells the
 * user a bigger model would transcribe them better.
 *
 * Deliberately doesn't name a model: Parakeet only covers 25 European
 * languages, so the right upgrade depends on the language. The CTA sends the
 * user to the model screen to choose.
 */
export const LargerModelSuggestionModal = ({
  visible,
  languageName,
  onConfirm,
  onDismiss,
}: LargerModelSuggestionModalProps) => {
  const { loc } = useLocalization();
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      testID={TestID.LargerModelSuggestionModal}
      title={loc.largerModelSuggestionTitle}
      message={loc.largerModelSuggestionBody(languageName)}
      primaryButton={{ text: loc.largerModelSuggestionCta, onTap: onConfirm }}
      secondaryButton={{
        text: loc.largerModelSuggestionDismiss,
        onTap: onDismiss,
      }}
      onDismiss={onDismiss}
      icon={<Icon name="language" size={32} color={theme.colors.textPrimary} />}
    />
  );
};
