/**
 * Reference-free scoring for the LLM benchmark: bench.js on desktop and
 * app/(dev)/llm-bench.tsx on device. The prompts are the ones the app ships
 * (src/services/llm-service/prompts.json); re-run the bench after editing.
 */

const SCRIPTS = {
  ar: /[؀-ۿ]/g,
  ur: /[؀-ۿ]/g,
  ru: /[Ѐ-ӿ]/g,
  hi: /[ऀ-ॿ]/g,
  bn: /[ঀ-৿]/g,
  zh: /[一-鿿]/g,
  ja: /[぀-ヿ一-鿿]/g,
  ko: /[가-힯]/g,
};

const STOPWORDS = {
  en: ["the", "and", "to", "is", "for", "on", "with", "of"],
  de: ["der", "die", "und", "das", "ist", "mit", "für", "von"],
  es: ["el", "la", "que", "y", "los", "para", "con", "del"],
  fr: ["le", "la", "et", "les", "des", "pour", "est", "du"],
  pt: ["o", "a", "que", "e", "os", "para", "com", "do"],
  it: ["il", "di", "che", "non", "per", "una", "sono", "anche"],
  nl: ["het", "een", "en", "van", "niet", "dat", "ik", "op"],
  pl: ["nie", "się", "że", "na", "jest", "w", "i", "jak"],
  tr: ["ve", "bir", "bu", "için", "ile", "çok", "da", "ama"],
  id: ["yang", "dan", "di", "ini", "itu", "untuk", "dengan", "tidak"],
  vi: ["và", "của", "là", "có", "không", "được", "cho", "những"],
};

const CJK = new Set(["zh", "ja"]);
const THINK = /<\/?think>/;
const PREAMBLE = /^\s*(here('s| is| are)\b|sure[,!]|certainly\b|summary:)/i;

const normalize = (s) =>
  s.toLowerCase().normalize("NFKC").replace(/[’']/g, "'");

const letters = (s) => (s.match(/\p{L}/gu) ?? []).length;

const languageMatches = (lang, text) => {
  const script = SCRIPTS[lang];
  if (script) {
    const share = (text.match(script) ?? []).length / (letters(text) || 1);
    // Japanese keeps its kana; Chinese output in Japanese kana is wrong.
    if (lang === "ja" && !/[぀-ヿ]/.test(text)) return false;
    return share >= 0.5;
  }
  const words = normalize(text).match(/\p{L}+/gu) ?? [];
  const hits = (l) => words.filter((w) => STOPWORDS[l].includes(w)).length;
  const best = Object.keys(STOPWORDS).reduce((a, b) =>
    hits(b) > hits(a) ? b : a,
  );
  return best === lang;
};

const size = (lang, text) =>
  CJK.has(lang) ? letters(text) : (text.match(/\S+/g) ?? []).length;

const countWord = (lang, text, word) => {
  if (CJK.has(lang)) return text.split(word).length - 1;
  const re = new RegExp(`(^|[^\\p{L}])${word}(?=[^\\p{L}]|$)`, "giu");
  return (normalize(text).match(re) ?? []).length;
};

/**
 * Score one model output. `total` (0–100) is recall minus penalties; the raw
 * parts are returned too so a regression can be traced to its cause.
 */
const scoreOutput = (task, fixture, rawText) => {
  const leak = THINK.test(rawText) || PREAMBLE.test(rawText);
  const text = rawText.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // CJK output often spaces digits from characters ("2 万"); fixtures don't.
  const squash = (str) =>
    CJK.has(fixture.lang) ? normalize(str).replace(/\s+/g, "") : normalize(str);
  const haystack = squash(text);

  const missing = fixture.facts
    .filter((alts) => !alts.some((alt) => haystack.includes(squash(alt))))
    .map((alts) => alts[0]);
  const recall = 1 - missing.length / fixture.facts.length;
  const forbiddenHits = fixture.forbidden.filter((w) =>
    haystack.includes(normalize(w)),
  );
  const fillersLeft =
    task === "cleanup"
      ? fixture.fillers.reduce(
          (n, f) => n + countWord(fixture.lang, text, f),
          0,
        )
      : 0;
  const langOk = text.length > 0 && languageMatches(fixture.lang, text);
  const lengthRatio =
    size(fixture.lang, text) / size(fixture.lang, fixture.transcript);
  // Summaries should condense; cleanups should keep nearly everything.
  const lengthOk =
    task === "summary"
      ? lengthRatio > 0.05 && lengthRatio <= 1
      : lengthRatio >= 0.6 && lengthRatio <= 1.15;

  const total = Math.max(
    0,
    Math.round(
      recall * 100 -
        15 * forbiddenHits.length -
        5 * fillersLeft -
        (langOk ? 0 : 30) -
        (lengthOk ? 0 : 15) -
        (leak ? 10 : 0),
    ),
  );

  return {
    total,
    recall,
    missing,
    forbiddenHits,
    fillersLeft,
    langOk,
    lengthRatio,
    lengthOk,
    leak,
  };
};

module.exports = { scoreOutput, languageMatches };
