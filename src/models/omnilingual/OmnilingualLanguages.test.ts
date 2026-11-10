import { OmnilingualLanguages } from "./OmnilingualLanguages";

describe("OmnilingualLanguages", () => {
  const codes = (query: string) =>
    OmnilingualLanguages.search(query).map((l) => l.code);

  it("lists 1,650 languages once each, A to Z", () => {
    const { all } = OmnilingualLanguages;
    expect(all).toHaveLength(1650);
    expect(new Set(all.map((l) => l.code)).size).toBe(all.length);
    const names = all.map((l) => l.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("names the language and its script", () => {
    expect(OmnilingualLanguages.all.find((l) => l.code === "yue")).toEqual({
      code: "yue",
      name: "Cantonese",
      script: "Han",
    });
  });

  it("matches word starts in the name or ISO name, ignoring case and accents", () => {
    expect(codes("canto")).toEqual(["yue"]);
    expect(codes("yue chinese")).toEqual(["yue"]);
    expect(codes("antonese")).toEqual([]);
    expect(codes("Klingon")).toEqual([]);
    expect(codes("ARBËRESHË")).toEqual(["aae"]);
  });

  it("falls back only when no other model covers a match", () => {
    expect(
      OmnilingualLanguages.fallback("Cantonese").map((l) => l.code),
    ).toEqual(["yue"]);
    expect(OmnilingualLanguages.fallback("Japanese")).toEqual([]);
    expect(OmnilingualLanguages.fallback("")).toEqual([]);
  });

  it("returns everything for a blank query", () => {
    expect(OmnilingualLanguages.search("  ")).toBe(OmnilingualLanguages.all);
  });
});
