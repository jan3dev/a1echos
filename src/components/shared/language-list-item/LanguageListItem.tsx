import { memo } from "react";

import { getCountryCode, SpokenLanguage } from "@/models";
import { AquaColors } from "@/theme";

import { FlagIcon } from "../../ui/icon/FlagIcon";
import { Radio } from "../../ui/radio/Radio";
import { ListItem } from "../list-item/ListItem";

interface LanguageListItemProps {
  language: SpokenLanguage;
  selected: boolean;
  onSelect: (language: SpokenLanguage) => void;
  enabled?: boolean;
  /** Pins colors on screens that ignore the app theme. */
  colors?: AquaColors;
  testID?: string;
}

/**
 * A spoken-language picker row. Memoized: language lists re-render their
 * cells on every search keystroke and toggle, which is slow on Android.
 */
export const LanguageListItem = memo(function LanguageListItem({
  language,
  selected,
  onSelect,
  enabled = true,
  colors,
  testID,
}: LanguageListItemProps) {
  const select = () => onSelect(language);
  return (
    <ListItem
      testID={testID}
      title={language.name}
      colors={colors}
      iconLeading={<FlagIcon name={getCountryCode(language)} size={24} />}
      iconTrailing={
        <Radio<string>
          value={language.code}
          size="small"
          groupValue={selected ? language.code : undefined}
          onValueChange={select}
          enabled={enabled}
          colors={colors}
        />
      }
      onPress={enabled ? select : undefined}
    />
  );
});
