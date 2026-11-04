const fixtures = require("../fixtures.json");
const { languageMatches, scoreOutput } = require("../score");

const meeting = fixtures.find((f) => f.id === "en-meeting");

describe("llm-summary scoring", () => {
  it("gives a faithful summary full marks", () => {
    const summary = [
      "- Ship version 2.4 on Wednesday the 12th; QA needs one more day.",
      "- Maria owns the release notes; Daniel the App Store screenshots.",
      "- Launch ad budget: 4,500 euros, no overrun.",
      "- Risk: Samsung audio crash, Priya on it; if unfixed by Monday, launch iOS only.",
      "- Legal must sign off on the privacy text.",
    ].join("\n");
    const score = scoreOutput("summary", meeting, summary);
    expect(score.missing).toEqual([]);
    expect(score.total).toBe(100);
  });

  it("penalizes the self-corrected date, thinking leaks and wrong language", () => {
    const score = scoreOutput(
      "summary",
      meeting,
      "<think>hmm</think>- Lanzamiento el martes (Tuesday).",
    );
    expect(score.forbiddenHits).toEqual(["tuesday"]);
    expect(score.leak).toBe(true);
    expect(score.langOk).toBe(false);
    expect(score.total).toBe(0);
  });

  // A cleanup that changes nothing must still find every fact, or the fixture
  // asks for wording the speaker never used.
  it.each(fixtures.map((f) => [f.id, f]))(
    "%s facts are all present in its own transcript",
    (_id, fixture) => {
      const score = scoreOutput("cleanup", fixture, fixture.transcript);
      expect(score.missing).toEqual([]);
      expect(score.langOk).toBe(true);
    },
  );

  it("ignores spacing between digits and CJK characters", () => {
    const zh = fixtures.find((f) => f.id === "zh-meeting");
    const score = scoreOutput("summary", zh, "- 市场预算为 2 万元");
    expect(score.missing).not.toContain("两万");
  });

  it("counts fillers left in a cleanup", () => {
    const score = scoreOutput("cleanup", meeting, meeting.transcript);
    expect(score.fillersLeft).toBeGreaterThan(0);
    expect(score.recall).toBe(1);
  });

  it("detects output language by script and stopwords", () => {
    expect(
      languageMatches("de", "Der Techniker kommt am Donnerstag und ist da."),
    ).toBe(true);
    expect(
      languageMatches("de", "The technician comes on Thursday and is there."),
    ).toBe(false);
    expect(languageMatches("ja", "来週の出張は大阪です。")).toBe(true);
    expect(languageMatches("ja", "下周出差去大阪")).toBe(false);
    expect(languageMatches("ar", "الاجتماع يوم الأحد")).toBe(true);
  });
});
