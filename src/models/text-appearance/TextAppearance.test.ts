import {
  DEFAULT_TEXT_APPEARANCE,
  parseTextAppearance,
  transcriptTextStyle,
} from "./TextAppearance";

describe("parseTextAppearance", () => {
  it("returns the default for missing or malformed input", () => {
    expect(parseTextAppearance(null)).toEqual(DEFAULT_TEXT_APPEARANCE);
    expect(parseTextAppearance("{nope")).toEqual(DEFAULT_TEXT_APPEARANCE);
  });

  it("keeps valid fields and resets invalid ones", () => {
    expect(
      parseTextAppearance(
        JSON.stringify({ font: "literata", size: 13, bold: true }),
      ),
    ).toEqual({ font: "literata", size: 16, bold: true });
    expect(
      parseTextAppearance(JSON.stringify({ font: "comic", size: 26 })),
    ).toEqual({ font: "inter", size: 26, bold: false });
  });
});

describe("transcriptTextStyle", () => {
  it("maps font + weight to the registered font name", () => {
    expect(
      transcriptTextStyle({ font: "ibmPlexMono", size: 20, bold: true }),
    ).toEqual({
      fontFamily: "IBMPlexMono-Bold",
      fontSize: 20,
      letterSpacing: -0.2,
    });
    expect(transcriptTextStyle(DEFAULT_TEXT_APPEARANCE).fontFamily).toBe(
      "Inter",
    );
  });
});
