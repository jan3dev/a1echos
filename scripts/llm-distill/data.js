#!/usr/bin/env node
/**
 * Distillation data for the 0.8B summary/cleanup model, written by the 4B
 * teacher through llama-server (see README.md):
 *
 *   node scripts/llm-distill/data.js gen   --from 0 --count 4000
 *   node scripts/llm-distill/data.js teach
 *   node scripts/llm-distill/data.js export
 *
 * `gen` writes synthetic ASR-style voice-note transcripts plus the facts a
 * summary must keep; `teach` runs the app prompts on them. Both append to
 * ~/.cache/echos-distill/data and skip ids already written, so they resume.
 * `export` keeps teacher answers that pass the bench checks and writes
 * mlx-lm chat data plus the held-out eval set (ids ≥ EVAL_FROM) as bench
 * fixtures.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const { startServer, complete, PORT } = require("../llm-summary/bench");
const { scoreOutput } = require("../llm-summary/score");

const ROOT = path.join(os.homedir(), ".cache", "echos-distill");
const DATA = path.join(ROOT, "data");
const TEACHER =
  process.env.TEACHER ?? path.join(ROOT, "Qwen3.5-4B-Q8_0.gguf");
// Only writes the input transcripts; every answer the student learns comes
// from TEACHER.
const WRITER =
  process.env.WRITER ?? path.join(ROOT, "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf");
const EVAL_FROM = 1_000_000;
const PARALLEL = 12;

const LANGS = [
  ["en", "English", 10],
  ["de", "German", 3],
  ["es", "Spanish", 3],
  ["fr", "French", 3],
  ["pt", "Brazilian Portuguese", 2],
  ["it", "Italian", 2],
  ["nl", "Dutch", 1],
  ["pl", "Polish", 1],
  ["tr", "Turkish", 1],
  ["ru", "Russian", 2],
  ["ar", "Arabic", 2],
  ["hi", "Hindi", 2],
  ["bn", "Bengali", 1],
  ["ur", "Urdu", 1],
  ["id", "Indonesian", 1],
  ["vi", "Vietnamese", 1],
  ["zh", "Simplified Chinese", 2],
  ["ja", "Japanese", 2],
  ["ko", "Korean", 1],
];

const SCENARIOS = [
  "a team stand-up or project sync with several colleagues",
  "a personal to-do list dictated while walking",
  "a recap of a phone call with a client or supplier",
  "brainstorming a product or business idea",
  "planning a trip with dates, bookings and costs",
  "notes after a doctor or vet appointment",
  "a landlord, repair or moving-house arrangement",
  "a lecture or study session summary for an exam",
  "a job interview debrief",
  "a personal journal entry about the day",
  "a recipe being explained while cooking",
  "family logistics: school pick-ups, birthdays, appointments",
  "a sales call with prices, discounts and deadlines",
  "a podcast or book idea outline",
  "a voicemail-style message to a friend",
  "a construction or renovation site walkthrough",
  "a budget review of monthly expenses",
  "a customer support escalation",
  "event planning for a wedding or party",
  "a fitness or training plan",
  "a research interview with a user about an app",
  "a car purchase or repair discussion",
  "a hiring discussion about candidates",
  "notes from a city council or community meeting",
  "a software bug investigation",
  "a gardening or farm work plan",
  "a teacher planning lessons",
  "a sports team coach's notes after a match",
  "an insurance claim after an accident",
  "a startup investor call",
];

const LENGTHS = [
  ["40 to 90 words", 3, false],
  ["120 to 250 words", 5, false],
  ["300 to 500 words", 4, false],
  ["700 to 1000 words", 2, true],
];

const STYLES = [
  "Whisper-style punctuation: sentences end with periods, a few commas, no paragraphs.",
  "Almost no punctuation and no capital letters, one long run-on block.",
  "Normal punctuation but the speaker trails off and restarts sentences.",
];

const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const weighted = (rand, items, weight) => {
  let r = rand() * items.reduce((n, i) => n + weight(i), 0);
  return items.find((i) => (r -= weight(i)) < 0) ?? items.at(-1);
};

const spec = (id) => {
  const rand = rng(id * 7919 + 17);
  const [lang, language] = weighted(rand, LANGS, (l) => l[2]);
  const [words, , long] = weighted(rand, LENGTHS, (l) => l[1]);
  return {
    id,
    lang,
    language,
    long,
    scenario: SCENARIOS[Math.floor(rand() * SCENARIOS.length)],
    words,
    style: STYLES[Math.floor(rand() * STYLES.length)],
    corrections: Math.floor(rand() * 3),
  };
};

const GEN_SYSTEM =
  "You write realistic raw speech-to-text transcripts of voice notes, used to test a note-taking app. " +
  "Write like someone actually talking, not like an essay: hesitation sounds and filler words native to the language, " +
  "false starts, repeated words, digressions, numbers mostly as a speech recognizer writes them (digits). " +
  "Invent concrete specifics: names, dates, times, places, amounts, quantities, decisions. " +
  "Never mix in English unless a native speaker would.";

const genPrompt = (s) =>
  `Language: ${s.language}. Write the whole transcript in ${s.language}, with names typical for speakers of it.\n` +
  `Topic: ${s.scenario}.\nLength: ${s.words}.\nStyle: ${s.style}\n` +
  (s.corrections
    ? `The speaker corrects themselves ${s.corrections} time(s) mid-sentence: a wrong day, time, number or name, then a natural ${s.language} phrase like "no wait" and the right value. ` +
      "Each wrong value appears exactly once in the transcript.\n"
    : "The speaker never corrects a stated fact.\n") +
  "Reply in exactly this format:\n" +
  "TRANSCRIPT:\n<the transcript>\n" +
  "FACTS:\n- <5 to 15 lines, each 1 to 3 words copied exactly from the transcript: a name, a number with its unit, a date, a time, an amount, or the key word of a decision; only corrected values>\n" +
  "WRONG:\n- <each wrong value the speaker corrected, copied exactly; leave empty if none>\n" +
  "FILLERS:\n- <each pure hesitation sound used (like um, uh, äh, euh, eh, 嗯, えーと), copied exactly>";

const SECTION = /^(TRANSCRIPT|FACTS|WRONG|FILLERS):\s*$/m;

const parseGen = (content) => {
  const parts = content.split(SECTION);
  const out = {};
  for (let i = 1; i < parts.length; i += 2) out[parts[i]] = parts[i + 1].trim();
  const list = (k) =>
    (out[k] ?? "")
      .split("\n")
      .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
      .filter((l) => l && !/^<.*>$/.test(l));
  return {
    transcript: out.TRANSCRIPT ?? "",
    facts: list("FACTS"),
    wrong: list("WRONG"),
    fillers: list("FILLERS"),
  };
};

const chat = async (body) => {
  const res = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()).choices[0];
};

const generate = async (s) => {
  const choice = await chat({
    messages: [
      { role: "system", content: GEN_SYSTEM },
      { role: "user", content: genPrompt(s) },
    ],
    // Qwen3.5's recommended non-thinking sampling.
    temperature: 0.7,
    top_p: 0.8,
    top_k: 20,
    presence_penalty: 1.5,
    seed: s.id,
    max_tokens: 4096,
    chat_template_kwargs: { enable_thinking: false },
  });
  if (choice.finish_reason !== "stop") return null;
  const out = parseGen(choice.message.content);
  const t = out.transcript;
  const lower = t.toLowerCase();
  const inT = (x) => lower.includes(x.toLowerCase());
  const wrong = out.wrong.filter(inT);
  // Keep only facts and fillers that really are in the transcript, so the
  // bench scoring stays meaningful.
  const facts = [...new Set(out.facts)].filter(
    (f) => inT(f) && !wrong.some((w) => w.toLowerCase() === f.toLowerCase()),
  );
  if (facts.length < 4 || t.length < 100) return null;
  return {
    id: s.id,
    lang: s.lang,
    scenario: s.scenario,
    long: s.long,
    transcript: t,
    facts: facts.map((f) => [f]),
    forbidden: wrong,
    fillers: [...new Set(out.fillers)].filter(
      (f) => inT(f) && f.split(/\s+/).length <= 2,
    ),
  };
};

const readJsonl = (file) =>
  fs.existsSync(file)
    ? fs
        .readFileSync(file, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];

const pool = async (items, fn) => {
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await fn(item);
      } catch (error) {
        console.error(`✗ ${item.id ?? item}: ${error.message}`);
      }
      if (++done % 50 === 0) console.log(`  ${done}/${items.length}`);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
};

const withServer = async (model, fn) => {
  const server = await startServer(model, {
    ctx: String(PARALLEL * 8192),
    ngl: "99",
    parallel: PARALLEL,
  });
  try {
    await fn();
  } finally {
    server.kill();
    await new Promise((r) => server.once("exit", r));
  }
};

const gen = async (from, count) => {
  fs.mkdirSync(DATA, { recursive: true });
  const file = path.join(DATA, "inputs.jsonl");
  const have = new Set(readJsonl(file).map((r) => r.id));
  const todo = [];
  for (let id = from; id < from + count; id++) {
    if (!have.has(id)) todo.push(spec(id));
  }
  console.log(`gen ${todo.length} transcripts`);
  const out = fs.createWriteStream(file, { flags: "a" });
  await withServer(WRITER, () =>
    pool(todo, async (s) => {
      const row = await generate(s);
      if (row) out.write(JSON.stringify(row) + "\n");
    }),
  );
  out.end();
};

// The app's map-reduce joins partial summaries with a blank line.
const SENTENCE = /[^.!?。！？؟\n]*[.!?。！？؟]+\s*|[^.!?。！？؟\n]+\s*|\n+/g;
const splitParts = (text, parts) => {
  const sentences = text.match(SENTENCE) ?? [text];
  const size = text.length / parts;
  const chunks = [""];
  for (const s of sentences) {
    if (chunks.at(-1).length >= size && chunks.length < parts) chunks.push("");
    chunks[chunks.length - 1] += s;
  }
  return chunks.map((c) => c.trim()).filter(Boolean);
};

const MAX_TOKENS = { summary: 1024, cleanup: 4096, merge: 2048 };

const teach = async () => {
  const inputs = readJsonl(path.join(DATA, "inputs.jsonl"));
  const file = path.join(DATA, "teacher.jsonl");
  const have = new Set(readJsonl(file).map((r) => `${r.id}:${r.task}`));
  const jobs = inputs.flatMap((input) =>
    ["summary", "cleanup", ...(input.long ? ["merge"] : [])]
      .filter((task) => !have.has(`${input.id}:${task}`))
      .map((task) => ({ id: input.id, task, input })),
  );
  console.log(`teach ${jobs.length} jobs`);
  const out = fs.createWriteStream(file, { flags: "a" });
  const run = async (task, text) => {
    const r = await complete(task, text, MAX_TOKENS[task]);
    return r.finishReason === "stop" ? r.text.trim() : null;
  };
  await withServer(TEACHER, () =>
    pool(jobs, async ({ id, task, input }) => {
      let prompt = input.transcript;
      if (task === "merge") {
        const parts = splitParts(input.transcript, 2 + (id % 2));
        const partials = [];
        for (const part of parts) {
          const p = await run("summary", part);
          if (!p) return;
          partials.push(p);
        }
        prompt = partials.join("\n\n");
      }
      const text = await run(task, prompt);
      if (!text) return;
      const score = scoreOutput(
        task === "merge" ? "summary" : task,
        input,
        text,
      );
      out.write(JSON.stringify({ id, task, prompt, text, score }) + "\n");
    }),
  );
  out.end();
};

const PROMPTS = require("../../src/services/llm-service/prompts.json");

// Facts are exact substrings, but the teacher rightly normalizes ("cinq
// kilomètres" → "5 km"), so recall is too noisy to filter on; it's for eval.
const passes = (r) => !r.score.leak && r.score.langOk && r.score.lengthOk;

const exportData = () => {
  const inputs = readJsonl(path.join(DATA, "inputs.jsonl"));
  const teacher = readJsonl(path.join(DATA, "teacher.jsonl"));
  const kept = teacher.filter((r) => r.id < EVAL_FROM && passes(r));
  const toChat = (r) =>
    JSON.stringify({
      messages: [
        { role: "system", content: PROMPTS[r.task] },
        { role: "user", content: r.prompt },
        { role: "assistant", content: r.text },
      ],
    });
  const isValid = (r) => r.id % 20 === 0;
  fs.writeFileSync(
    path.join(DATA, "train.jsonl"),
    kept.filter((r) => !isValid(r)).map(toChat).join("\n") + "\n",
  );
  fs.writeFileSync(
    path.join(DATA, "valid.jsonl"),
    kept.filter(isValid).map(toChat).join("\n") + "\n",
  );
  const evalSet = inputs
    .filter((i) => i.id >= EVAL_FROM)
    .map(({ id, lang, transcript, facts, forbidden, fillers }) => ({
      id: `${lang}-${id}`,
      lang,
      transcript,
      facts,
      forbidden,
      fillers,
    }));
  fs.writeFileSync(path.join(DATA, "eval.json"), JSON.stringify(evalSet, null, 1));
  const byTask = (rs) =>
    Object.fromEntries(
      ["summary", "cleanup", "merge"].map((t) => [t, rs.filter((r) => r.task === t).length]),
    );
  console.log("teacher", byTask(teacher.filter((r) => r.id < EVAL_FROM)));
  console.log("kept   ", byTask(kept));
  console.log("eval   ", evalSet.length);
};

const main = async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < rest.length; i += 2)
    args[rest[i].replace(/^--/, "")] = rest[i + 1];
  if (cmd === "gen")
    await gen(Number(args.from ?? 0), Number(args.count ?? 100));
  else if (cmd === "teach") await teach();
  else if (cmd === "export") exportData();
  else throw new Error("usage: data.js gen|teach|export");
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { parseGen, splitParts };
