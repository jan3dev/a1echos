import { formatTranscriptionText } from "./TranscriptionFormatter";

describe("formatTranscriptionText", () => {
  describe("empty/null input", () => {
    it("returns empty string as-is", () => {
      expect(formatTranscriptionText("")).toBe("");
    });

    it("returns falsy values as-is", () => {
      expect(formatTranscriptionText(undefined as any)).toBeUndefined();
      expect(formatTranscriptionText(null as any)).toBeNull();
    });
  });

  describe("whitespace normalization", () => {
    it("trims leading and trailing whitespace", () => {
      expect(formatTranscriptionText("  hello  ")).toBe("hello");
    });

    it("collapses multiple spaces", () => {
      expect(formatTranscriptionText("hello    world")).toBe("hello world");
    });

    it("collapses tabs to spaces within a single run", () => {
      expect(formatTranscriptionText("hello\tworld")).toBe("hello world");
    });

    it("preserves newlines as paragraph breaks (pause markers)", () => {
      expect(formatTranscriptionText("hello\nworld")).toBe("hello\n\nworld");
    });

    it("collapses multiple consecutive newlines into a single paragraph break", () => {
      expect(formatTranscriptionText("hello\n\n\nworld")).toBe(
        "hello\n\nworld",
      );
    });

    it("formats each pause-separated segment independently", () => {
      const text = "One. Two. Three. Four.\nFive. Six. Seven.";
      const result = formatTranscriptionText(text);
      // First segment: 4 sentences → group into 3 + 1 with \n\n; joined with \n\n
      // to the second segment which groups into 3.
      expect(result).toBe("One. Two. Three.\n\nFour.\n\nFive. Six. Seven.");
    });
  });

  describe("no-punctuation path (word-count splitting)", () => {
    it("returns single word as-is", () => {
      expect(formatTranscriptionText("hello")).toBe("hello");
    });

    it("does not split text under 30 words", () => {
      const words = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ");
      const result = formatTranscriptionText(words);
      expect(result).not.toContain("\n\n");
      expect(result.split(" ")).toHaveLength(20);
    });

    it("splits at 30-word boundary", () => {
      const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
      const result = formatTranscriptionText(words);
      const paragraphs = result.split("\n\n");
      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0].split(" ")).toHaveLength(30);
      expect(paragraphs[1].split(" ")).toHaveLength(30);
    });

    it("handles remainder words in last paragraph", () => {
      const words = Array.from({ length: 35 }, (_, i) => `word${i}`).join(" ");
      const result = formatTranscriptionText(words);
      const paragraphs = result.split("\n\n");
      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0].split(" ")).toHaveLength(30);
      expect(paragraphs[1].split(" ")).toHaveLength(5);
    });
  });

  describe("punctuation path (sentence grouping)", () => {
    it("groups 3 sentences into one paragraph", () => {
      const text = "First sentence. Second sentence. Third sentence.";
      const result = formatTranscriptionText(text);
      expect(result).not.toContain("\n\n");
      expect(result).toBe("First sentence. Second sentence. Third sentence.");
    });

    it("splits after every 3 sentences", () => {
      const text = "One. Two. Three. Four. Five. Six.";
      const result = formatTranscriptionText(text);
      const paragraphs = result.split("\n\n");
      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0]).toBe("One. Two. Three.");
      expect(paragraphs[1]).toBe("Four. Five. Six.");
    });

    it("handles mixed punctuation marks", () => {
      const text = "Question? Exclamation! Statement.";
      const result = formatTranscriptionText(text);
      expect(result).toBe("Question? Exclamation! Statement.");
    });

    it("handles trailing text without punctuation", () => {
      const text = "First. Second. Third. Trailing text without ending";
      const result = formatTranscriptionText(text);
      const paragraphs = result.split("\n\n");
      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0]).toBe("First. Second. Third.");
      expect(paragraphs[1]).toBe("Trailing text without ending");
    });

    it("handles single sentence", () => {
      const text = "Just one sentence.";
      const result = formatTranscriptionText(text);
      expect(result).toBe("Just one sentence.");
    });
  });
});
