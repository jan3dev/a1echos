import type { TextStyle } from "react-native";

/** Transcript typefaces. Keys are persisted; values are the `useFonts` names
 *  registered in `app/_layout.tsx`. */
export const TRANSCRIPT_FONTS = {
  inter: { label: "Inter", regular: "Inter", bold: "Inter-Bold" },
  nunitoSans: {
    label: "Nunito Sans",
    regular: "NunitoSans-Regular",
    bold: "NunitoSans-Bold",
  },
  literata: {
    label: "Literata",
    regular: "Literata-Regular",
    bold: "Literata-Bold",
  },
  ebGaramond: {
    label: "EB Garamond",
    regular: "EBGaramond-Regular",
    bold: "EBGaramond-Bold",
  },
  ibmPlexMono: {
    label: "IBM Plex Mono",
    regular: "IBMPlexMono-Regular",
    bold: "IBMPlexMono-Bold",
  },
  bitter: { label: "Bitter", regular: "Bitter-Regular", bold: "Bitter-Bold" },
} as const;

export type TranscriptFont = keyof typeof TRANSCRIPT_FONTS;

export const TRANSCRIPT_FONT_KEYS = Object.keys(
  TRANSCRIPT_FONTS,
) as TranscriptFont[];

export const TRANSCRIPT_FONT_SIZES = [10, 12, 14, 16, 18, 20, 22, 24, 26];

export interface TextAppearance {
  font: TranscriptFont;
  size: number;
  bold: boolean;
}

export const DEFAULT_TEXT_APPEARANCE: TextAppearance = {
  font: "inter",
  size: 16,
  bold: false,
};

export const parseTextAppearance = (raw: string | null): TextAppearance => {
  if (!raw) return DEFAULT_TEXT_APPEARANCE;
  try {
    const { font, size, bold } = JSON.parse(raw) ?? {};
    return {
      font: TRANSCRIPT_FONT_KEYS.includes(font)
        ? font
        : DEFAULT_TEXT_APPEARANCE.font,
      size: TRANSCRIPT_FONT_SIZES.includes(size)
        ? size
        : DEFAULT_TEXT_APPEARANCE.size,
      bold: bold === true,
    };
  } catch {
    return DEFAULT_TEXT_APPEARANCE;
  }
};

export const transcriptTextStyle = ({
  font,
  size,
  bold,
}: TextAppearance): TextStyle => ({
  fontFamily: TRANSCRIPT_FONTS[font][bold ? "bold" : "regular"],
  fontSize: size,
  letterSpacing: size * -0.01,
});
