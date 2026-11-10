import { memo } from "react";

import type { OmnilingualLanguage } from "@/models";
import { AquaColors, useTheme } from "@/theme";

import { Icon } from "../../ui/icon/Icon";
import { ListItem } from "../list-item/ListItem";

interface OmnilingualLanguageListItemProps {
  language: OmnilingualLanguage;
  /** Without it the row is for reference only: no chevron, no tap. */
  onPress?: () => void;
  /** Pins colors on screens that ignore the app theme. */
  colors?: AquaColors;
  testID?: string;
}

/** An Omnilingual language and its script. Memoized like LanguageListItem:
 *  the list holds 1,650 rows and re-renders on every search keystroke. */
export const OmnilingualLanguageListItem = memo(
  function OmnilingualLanguageListItem({
    language,
    onPress,
    colors: colorsOverride,
    testID,
  }: OmnilingualLanguageListItemProps) {
    const { theme } = useTheme();
    const colors = colorsOverride ?? theme.colors;
    return (
      <ListItem
        testID={testID}
        title={language.name}
        subtitle={language.script}
        colors={colorsOverride}
        iconTrailing={
          onPress && (
            <Icon name="chevron_right" size={18} color={colors.textSecondary} />
          )
        }
        onPress={onPress}
      />
    );
  },
);
