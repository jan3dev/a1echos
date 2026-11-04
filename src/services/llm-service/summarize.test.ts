import {
  splitByTokens,
  summarize,
  SummaryCancelledError,
  type SummarizeDeps,
} from "./summarize";

// One token per word keeps the arithmetic readable.
const countWords = async (text: string) => (text.match(/\S+/g) ?? []).length;

const words = (n: number, word = "word") =>
  Array.from({ length: n }, () => word).join(" ");

const deps = (patch: Partial<SummarizeDeps> = {}): SummarizeDeps => ({
  budget: 100,
  finalBudget: 60,
  finalOutputTokens: (tokens) => 1000 - tokens,
  countTokens: countWords,
  complete: jest.fn(async (task, text) => `${task}(${countWordsSync(text)})`),
  isCancelled: () => false,
  ...patch,
});

const countWordsSync = (text: string) => (text.match(/\S+/g) ?? []).length;

describe("splitByTokens", () => {
  it("keeps every word and stays within budget", async () => {
    const text = Array.from(
      { length: 30 },
      (_, i) => `Sentence ${i} has six words.`,
    ).join(" ");
    const chunks = await splitByTokens(text, 40, countWords);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(countWordsSync(chunk)).toBeLessThanOrEqual(40);
    }
    expect(chunks.join(" ").split(/\s+/)).toEqual(text.split(/\s+/));
  });

  it("cuts an unpunctuated run by characters", async () => {
    const text = words(250);
    const chunks = await splitByTokens(text, 100, countWords);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const chunk of chunks) {
      expect(countWordsSync(chunk)).toBeLessThanOrEqual(100);
    }
  });

  it("splits CJK and Arabic at their own sentence enders", async () => {
    const perChar = async (t: string) => t.replace(/\s/g, "").length;
    const zh =
      "新版本下周五上线。测试那边还剩三个问题要修。小王负责安卓的崩溃问题。";
    const chunks = await splitByTokens(zh, 15, perChar);
    expect(chunks).toEqual([
      "新版本下周五上线。",
      "测试那边还剩三个问题要修。",
      "小王负责安卓的崩溃问题。",
    ]);
    const ar = "الاجتماع يوم الأحد؟ سارة ستراجع العقد.";
    expect(await splitByTokens(ar, 3, countWords)).toEqual([
      "الاجتماع يوم الأحد؟",
      "سارة ستراجع العقد.",
    ]);
  });

  it("returns nothing for blank text", async () => {
    expect(await splitByTokens("  \n ", 10, countWords)).toEqual([]);
  });
});

describe("summarize", () => {
  it("summarizes text that fits in one streamed pass", async () => {
    const onText = jest.fn();
    const d = deps({ onText });
    await expect(summarize(`  ${words(50)}  `, d)).resolves.toBe("summary(50)");
    expect(d.complete).toHaveBeenCalledTimes(1);
    expect(d.complete).toHaveBeenCalledWith("summary", words(50), {
      onText,
      maxOutputTokens: 950,
    });
  });

  it("summarizes chunks, then merges the partial summaries", async () => {
    const onProgress = jest.fn();
    const d = deps({ onProgress });
    const text = Array.from({ length: 30 }, () => `${words(9)}.`).join(" ");
    const result = await summarize(text, d);

    const calls = (d.complete as jest.Mock).mock.calls;
    const chunkCalls = calls.filter(([task]) => task === "summary");
    expect(chunkCalls.length).toBe(3);
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
    // Chunk passes don't stream; only the final merge does.
    expect(chunkCalls.every((c) => c[2] === undefined)).toBe(true);
    expect(calls.at(-1)![0]).toBe("merge");
    expect(result).toMatch(/^merge\(/);
  });

  it("splits text that fits one chunk but not the final pass in two", async () => {
    const d = deps();
    const text = Array.from({ length: 8 }, () => `${words(9)}.`).join(" ");
    await summarize(text, d);
    const calls = (d.complete as jest.Mock).mock.calls;
    const chunkCalls = calls.filter(([task]) => task === "summary");
    expect(chunkCalls.length).toBeGreaterThanOrEqual(2);
    const [task, , options] = calls.at(-1)!;
    expect(task).toBe("merge");
    expect(options.maxOutputTokens).toBeGreaterThan(900);
  });

  it("merges in more rounds when the partial summaries are still too long", async () => {
    // Each chunk "summary" is a third of its input, so one round isn't enough.
    const complete = jest.fn(async (task: string, text: string) =>
      words(Math.ceil(countWordsSync(text) / 3), task),
    );
    const d = deps({ complete });
    await summarize(
      Array.from({ length: 80 }, () => `${words(9)}.`).join(" "),
      d,
    );
    const tasks = complete.mock.calls.map(([task]) => task);
    expect(tasks.filter((t) => t === "merge").length).toBeGreaterThan(1);
  });

  it("drops empty partial summaries", async () => {
    const complete = jest.fn(async (task: string, text: string) =>
      task === "merge" ? text : text.startsWith("skip") ? "" : "kept",
    );
    const text = `${words(60, "skip")}. ${words(60)}.`;
    await expect(summarize(text, deps({ complete }))).resolves.toBe("kept");
  });

  it("doesn't merge when every partial summary is empty", async () => {
    const complete = jest.fn(async (_task: string) => "");
    await expect(
      summarize(`${words(60)}. ${words(60)}.`, deps({ complete })),
    ).resolves.toBe("");
    expect(complete.mock.calls.map(([task]) => task)).not.toContain("merge");
  });

  it("gives up when the text never shrinks", async () => {
    const complete = jest.fn(async (_task: string, text: string) => text);
    await expect(
      summarize(
        Array.from({ length: 30 }, () => `${words(9)}.`).join(" "),
        deps({ complete }),
      ),
    ).rejects.toThrow("did not converge");
  });

  it("stops between chunks once cancelled", async () => {
    let cancelled = false;
    const complete = jest.fn(async () => {
      cancelled = true;
      return "partial";
    });
    const text = Array.from({ length: 30 }, () => `${words(9)}.`).join(" ");
    await expect(
      summarize(text, deps({ complete, isCancelled: () => cancelled })),
    ).rejects.toBeInstanceOf(SummaryCancelledError);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("discards a final pass that was stopped early", async () => {
    let cancelled = false;
    const complete = jest.fn(async () => {
      cancelled = true;
      return "- half a";
    });
    await expect(
      summarize(words(10), deps({ complete, isCancelled: () => cancelled })),
    ).rejects.toBeInstanceOf(SummaryCancelledError);
  });
});
