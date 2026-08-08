import { OptionPickerScreen } from "@/components";
import { TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import {
  KEYBOARD_MIC_TIMEOUT_OPTIONS,
  useKeyboardMicTimeout,
  useSetKeyboardMicTimeout,
} from "@/stores";
import { micTimeoutLabelKey } from "@/utils/keyboard-settings/micTimeoutLabel";

export default function MicrophoneTimeoutSettingsScreen() {
  const { loc } = useLocalization();
  const selected = useKeyboardMicTimeout();
  const setMicTimeout = useSetKeyboardMicTimeout();

  return (
    <OptionPickerScreen<number>
      title={loc.micTimeoutTitle}
      options={KEYBOARD_MIC_TIMEOUT_OPTIONS}
      selected={selected}
      onSelect={setMicTimeout}
      labelFor={(seconds) => loc[micTimeoutLabelKey(seconds)]}
      testIDPrefix={TestID.MicTimeoutOption}
      errorMessage="Failed to set microphone timeout"
    />
  );
}
