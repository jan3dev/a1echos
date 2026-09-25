import { Text as RNText, StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import KeyDelete from "@/assets/icons/kb_delete.svg";
import KeyEmoji from "@/assets/icons/kb_emoji.svg";
import KeyShift from "@/assets/icons/kb_shift.svg";
import { useLocalization } from "@/hooks";
import { darkColors, spacing } from "@/theme";

import { Button } from "../../../ui/button/Button";
import { Icon } from "../../../ui/icon/Icon";
import { Text } from "../../../ui/text/Text";
import { OnboardingHeader } from "../header/OnboardingHeader";

const TUTORIAL_STEP = 2;
const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const KEY_SIZE = 29.7;

// iOS dark system keyboard, not app palette.
const KEYBOARD_BG = "#1c1c1e";
const KEY_BG = "#707171";
const KEY_BG_SPECIAL = "#4d4d4e";
const KEY_TEXT = "#fefefe";
const PILL_BG = "rgba(255, 255, 255, 0.22)";

export interface AutocorrectScreenProps {
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
  testID?: string;
}

const Key = ({ label }: { label: string }) => (
  <View style={[styles.key, styles.letterKey]}>
    <RNText style={styles.keyLabel}>{label}</RNText>
  </View>
);

const letterKeys = (row: string) =>
  [...row].map((k) => <Key key={k} label={k} />);

/** Static iOS-keyboard mock showing a highlighted autocorrect suggestion. */
const KeyboardPreview = () => (
  <View
    style={styles.keyboard}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
  >
    <View style={styles.inputBar}>
      <View style={styles.field}>
        <RNText style={styles.fieldText}>Accurage</RNText>
      </View>
    </View>
    <View style={styles.suggestions}>
      <View style={styles.words}>
        <RNText style={styles.word}>“Accurage”</RNText>
        <View style={styles.suggested}>
          <RNText style={[styles.word, styles.suggestedWord]}>Accurate</RNText>
        </View>
        <RNText style={styles.word}>Ajutage</RNText>
      </View>
      <View style={styles.micPill}>
        <Icon name="mic" size={14} color={darkColors.textPrimary} />
      </View>
    </View>
    <View style={styles.keys}>
      <View style={styles.row}>{letterKeys(ROWS[0])}</View>
      <View style={[styles.row, styles.middleRow]}>{letterKeys(ROWS[1])}</View>
      <View style={styles.row}>
        <View style={[styles.key, styles.specialKey]}>
          <KeyShift width={KEY_SIZE} height={KEY_SIZE} color={KEY_TEXT} />
        </View>
        <View style={[styles.row, styles.bottomLetters]}>
          {letterKeys(ROWS[2])}
        </View>
        <View style={[styles.key, styles.specialKey]}>
          <KeyDelete width={KEY_SIZE} height={KEY_SIZE} color={KEY_TEXT} />
        </View>
      </View>
      <View style={[styles.row, styles.bottomRow]}>
        <View style={[styles.key, styles.specialKey, styles.smallKey]}>
          <RNText style={styles.smallKeyLabel}>123</RNText>
        </View>
        <View style={[styles.key, styles.specialKey, styles.smallKey]}>
          <KeyEmoji width={29} height={KEY_SIZE} color={KEY_TEXT} />
        </View>
        <View style={[styles.key, styles.letterKey, styles.spaceKey]}>
          <RNText style={styles.spaceLabel}>ECHOS</RNText>
        </View>
        <View style={[styles.key, styles.specialKey, styles.returnKey]}>
          <RNText style={styles.keyLabel}>↵</RNText>
        </View>
      </View>
    </View>
  </View>
);

export const AutocorrectScreen = ({
  onBack,
  onSkip,
  onNext,
  testID,
}: AutocorrectScreenProps) => {
  const insets = useSafeAreaInsets();
  const { loc } = useLocalization();

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />
      <OnboardingHeader
        step={TUTORIAL_STEP}
        onBack={onBack}
        onSkip={onSkip}
        testID={testID}
      />

      <View
        style={[
          styles.content,
          {
            paddingBottom: insets.bottom + spacing.md,
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
      >
        <View style={styles.top}>
          <View style={styles.copy}>
            <Text
              variant="h4"
              weight="medium"
              align="center"
              color={darkColors.textPrimary}
            >
              {loc.onboardingAutocorrectTitle}
            </Text>
            <Text
              variant="body1"
              weight="medium"
              align="center"
              color={darkColors.textSecondary}
            >
              {loc.onboardingAutocorrectSubtitle}
            </Text>
          </View>
          <KeyboardPreview />
        </View>

        <Button.primary
          testID={testID ? `${testID}-next` : undefined}
          text={loc.onboardingNext}
          onPress={onNext}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: darkColors.surfaceBackground,
  },
  content: {
    flex: 1,
    minHeight: 0,
    justifyContent: "space-between",
    paddingTop: spacing.xl,
  },
  top: {
    alignItems: "center",
    gap: spacing.xl,
  },
  copy: {
    alignSelf: "stretch",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  keyboard: {
    width: 265,
    overflow: "hidden",
    backgroundColor: KEYBOARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  inputBar: {
    padding: 9.3,
    backgroundColor: darkColors.surfacePrimary,
  },
  field: {
    paddingHorizontal: 12.4,
    paddingVertical: 7.7,
    borderRadius: 15.5,
    backgroundColor: darkColors.surfaceTertiary,
  },
  fieldText: {
    fontFamily: "Inter",
    fontSize: 12.4,
    color: darkColors.textPrimary,
  },
  suggestions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7.7,
    paddingTop: 6.2,
    paddingHorizontal: 9.3,
  },
  words: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7.7,
  },
  word: {
    fontFamily: "Inter",
    fontSize: 10.8,
    color: darkColors.textSecondary,
  },
  suggested: {
    paddingHorizontal: 9.3,
    paddingVertical: 3.9,
    borderRadius: 10.8,
    backgroundColor: PILL_BG,
  },
  suggestedWord: {
    fontFamily: "Inter-Medium",
    color: darkColors.textPrimary,
  },
  micPill: {
    paddingHorizontal: 10.8,
    paddingVertical: 3.1,
    borderRadius: 10.8,
    backgroundColor: PILL_BG,
  },
  keys: {
    height: 163.2,
    gap: 8.5,
    paddingTop: 11.3,
    paddingHorizontal: 7.8,
  },
  row: {
    flexDirection: "row",
    gap: 3.5,
  },
  middleRow: {
    paddingHorizontal: 12.7,
  },
  bottomLetters: {
    flex: 1,
    paddingHorizontal: 9.2,
  },
  bottomRow: {
    gap: 4.25,
  },
  key: {
    height: KEY_SIZE,
    borderRadius: 4.6,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  letterKey: {
    flex: 1,
    backgroundColor: KEY_BG,
    borderBottomWidth: 0.7,
    borderBottomColor: "#898a8d",
  },
  specialKey: {
    width: KEY_SIZE,
    backgroundColor: KEY_BG_SPECIAL,
    borderBottomWidth: 0.7,
    borderBottomColor: "#333333",
  },
  smallKey: {
    width: 29,
  },
  spaceKey: {
    flex: 0,
    width: 116.7,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    paddingRight: 7.8,
    paddingBottom: 5.5,
  },
  returnKey: {
    width: 62.3,
  },
  keyLabel: {
    fontSize: 15.5,
    lineHeight: 19.8,
    color: KEY_TEXT,
    textAlign: "center",
  },
  smallKeyLabel: {
    fontSize: 11.3,
    color: KEY_TEXT,
  },
  spaceLabel: {
    fontFamily: "Inter-Medium",
    fontSize: 7,
    letterSpacing: 1.2,
    color: "rgba(255, 255, 255, 0.45)",
  },
});
