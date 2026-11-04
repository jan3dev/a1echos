const { parseGen, splitParts } = require("../data");

describe("llm-distill data", () => {
  it("parses the writer's sections and drops placeholder lines", () => {
    const out = parseGen(
      "TRANSCRIPT:\nso um we meet Friday no wait Thursday at 3\n" +
        "FACTS:\n- Thursday\n- 3\n" +
        "WRONG:\n- Friday\n" +
        "FILLERS:\n- <none>\n",
    );
    expect(out).toEqual({
      transcript: "so um we meet Friday no wait Thursday at 3",
      facts: ["Thursday", "3"],
      wrong: ["Friday"],
      fillers: [],
    });
  });

  it("splits at sentence ends into the requested number of parts", () => {
    const text = "One two. Three four. Five six. Seven eight.";
    const parts = splitParts(text, 2);
    expect(parts).toHaveLength(2);
    expect(parts.join(" ")).toBe(text);
  });
});
