import { OptionPickerScreen } from "@/components";
import { TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import {
  KEYBOARD_LM_STRENGTH_OPTIONS,
  useKeyboardLmStrength,
  useSetKeyboardLmStrength,
} from "@/stores";
import {
  lmStrengthExampleKey,
  lmStrengthLabelKey,
} from "@/utils/keyboard-settings/lmStrengthLabel";

export default function LmStrengthSettingsScreen() {
  const { loc } = useLocalization();
  const selected = useKeyboardLmStrength();
  const setLmStrength = useSetKeyboardLmStrength();

  return (
    <OptionPickerScreen<number>
      title={loc.lmStrengthTitle}
      options={KEYBOARD_LM_STRENGTH_OPTIONS}
      selected={selected}
      onSelect={setLmStrength}
      labelFor={(strength) => loc[lmStrengthLabelKey(strength)]}
      descriptionFor={(strength) => loc[lmStrengthExampleKey(strength)]}
      testIDPrefix={TestID.LmStrengthOption}
      errorMessage="Failed to set keyboard LM strength"
    />
  );
}
