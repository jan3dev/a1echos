#!/usr/bin/env node
// Builds src/models/omnilingual/languages.json: the languages Omnilingual ASR
// supports, so search works before the model is downloaded.
// Usage: node scripts/omnilingual/build-languages.js
const fs = require("fs");
const path = require("path");

const LANG_IDS =
  "https://raw.githubusercontent.com/facebookresearch/omnilingual-asr/main/src/omnilingual_asr/models/wav2vec2_llama/lang_ids.py";
const ISO_639_3 =
  "https://iso639-3.sil.org/sites/iso639-3/files/downloads/iso-639-3.tab";
const ISO_639_3_RETIRED =
  "https://iso639-3.sil.org/sites/iso639-3/files/downloads/iso-639-3_Retirements.tab";
const OUT = path.join(__dirname, "../../src/models/omnilingual/languages.json");

// Hans and Hant share one label: the list names the writing system, and
// "Han" is what people search for.
const SCRIPTS = {
  Arab: "Arabic",
  Armn: "Armenian",
  Beng: "Bengali",
  Cans: "Canadian Syllabics",
  Cyrl: "Cyrillic",
  Deva: "Devanagari",
  Ethi: "Ethiopic",
  Geor: "Georgian",
  Grek: "Greek",
  Gujr: "Gujarati",
  Guru: "Gurmukhi",
  Hang: "Hangul",
  Hans: "Han",
  Hant: "Han",
  Hebr: "Hebrew",
  Jpan: "Japanese",
  Kali: "Kayah Li",
  Khmr: "Khmer",
  Knda: "Kannada",
  Laoo: "Lao",
  Latn: "Latin",
  Lisu: "Lisu",
  Mlym: "Malayalam",
  Mymr: "Myanmar",
  Orya: "Odia",
  Sinh: "Sinhala",
  Taml: "Tamil",
  Telu: "Telugu",
  Tfng: "Tifinagh",
  Thaa: "Thaana",
  Thai: "Thai",
  Tibt: "Tibetan",
};

const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
};

const tsv = (text) =>
  text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split("\t"));

const main = async () => {
  const [ids, iso, retired] = await Promise.all([
    get(LANG_IDS),
    get(ISO_639_3),
    get(ISO_639_3_RETIRED),
  ]);
  const isoNames = new Map(tsv(retired).map((r) => [r[0], r[1]]));
  for (const r of tsv(iso)) isoNames.set(r[0], r[6]);

  const scriptsByCode = new Map();
  for (const [, code, script] of ids.matchAll(/"([a-z]{3})_([A-Z][a-z]{3})/g)) {
    const name = SCRIPTS[script];
    if (!name) throw new Error(`No name for script ${script}`);
    const set = scriptsByCode.get(code) ?? new Set();
    set.add(name);
    scriptsByCode.set(code, set);
  }

  const cldr = new Intl.DisplayNames("en", { type: "language" });
  const rows = [...scriptsByCode].map(([code, scripts]) => {
    const isoName = isoNames.get(code);
    if (!isoName) throw new Error(`No ISO 639-3 name for ${code}`);
    const common = cldr.of(code);
    return {
      code,
      isoName,
      name: common && common !== code ? common : isoName,
      script: [...scripts].sort().join(", "),
    };
  });

  // CLDR folds individual languages into their macrolanguage (cmn and
  // yue_Hans are both "Chinese"); those take the ISO name instead.
  const counts = new Map();
  for (const r of rows) counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
  for (const r of rows) if (counts.get(r.name) > 1) r.name = r.isoName;

  const out = rows
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map((r) =>
      r.isoName === r.name
        ? [r.code, r.name, r.script]
        : [r.code, r.name, r.script, r.isoName],
    );
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(out).replace(/\],\[/g, "],\n[")}\n`);
  console.log(`${out.length} languages → ${path.relative(process.cwd(), OUT)}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
