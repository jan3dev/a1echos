#!/usr/bin/env node
/**
 * On-device LLM benchmark for session summaries and transcript cleanup.
 *
 * Runs each candidate GGUF through a local llama-server (Homebrew
 * `llama.cpp`) with the prompts the app will use, then scores the output
 * against fixtures.json: fact recall, self-correction traps, output language,
 * leftover fillers, length, and leaks (thinking blocks, chatty preambles).
 * Same GGUF + same quant + greedy decoding = same text as on the phone; the
 * tokens/s columns are desktop numbers and only useful relative to each other.
 *
 *   npm run bench:llm
 *   npm run bench:llm -- --models qwen35_0_8b,qwen35_2b --tasks summary
 *   npm run bench:llm -- --fixtures en-meeting,de-call --ngl 0
 *   npm run bench:llm -- --gguf path/to/model.gguf --fixtures-file eval.json
 *
 * Models are cached in ~/.cache/echos-llm-bench (SHA-256 checked); results
 * land in scripts/llm-summary/results/ (git-ignored).
 */
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PROMPTS = require("../../src/services/llm-service/prompts.json");

const { scoreOutput } = require("./score");

// Mirrors LLM_REGISTRY (src/models/model-registry/LlmRegistry.ts).
const CANDIDATES = [
  {
    id: "qwen35_0_8b_en",
    repo: "jan3com/Qwen3.5-0.8B-English-GGUF",
    commit: "d374efe92d37a3e29c3b9f36ec0cb0ded0ffe0df",
    file: "Qwen3.5-0.8B-English-Q4_K_M.gguf",
    sha256: "da4fabdac1d4dc3d6ad98c870c9aef644ca8cf7b53ca33a31b85f7e2d027c0cf",
  },
  {
    id: "qwen35_0_8b",
    repo: "unsloth/Qwen3.5-0.8B-GGUF",
    commit: "6ab461498e2023f6e3c1baea90a8f0fe38ab64d0",
    file: "Qwen3.5-0.8B-Q4_K_M.gguf",
    sha256: "bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517",
  },
  {
    id: "qwen35_2b",
    repo: "unsloth/Qwen3.5-2B-GGUF",
    commit: "f6d5376be1edb4d416d56da11e5397a961aca8ae",
    file: "Qwen3.5-2B-Q4_K_M.gguf",
    sha256: "aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223",
  },
  {
    id: "qwen35_4b",
    repo: "unsloth/Qwen3.5-4B-GGUF",
    commit: "e87f176479d0855a907a41277aca2f8ee7a09523",
    file: "Qwen3.5-4B-Q4_0.gguf",
    sha256: "298fcb5fe7a77ccc79745ae24751560c5ac56874caff4bb39b1f2055bd72b8bb",
  },
];

const CACHE_DIR = path.join(os.homedir(), ".cache", "echos-llm-bench");
const RESULTS_DIR = path.join(__dirname, "results");
const PORT = 8089;

const parseArgs = () => {
  const args = { ngl: "99", ctx: "8192", maxTokens: 1024 };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    args[key] = argv[i + 1];
  }
  const list = (v) => (v ? v.split(",") : undefined);
  return {
    models: list(args.models),
    fixtures: list(args.fixtures),
    tasks: list(args.tasks) ?? ["summary", "cleanup"],
    gguf: args.gguf,
    fixturesFile: args["fixtures-file"] ?? path.join(__dirname, "fixtures.json"),
    ngl: args.ngl,
    ctx: args.ctx,
    maxTokens: Number(args.maxTokens),
  };
};

const sha256 = (file) =>
  execFileSync("shasum", ["-a", "256", file]).toString().split(" ")[0];

const ensureModel = (c) => {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const dest = path.join(CACHE_DIR, c.file);
  if (fs.existsSync(dest)) return dest;
  const url = `https://huggingface.co/${c.repo}/resolve/${c.commit}/${c.file}`;
  console.log(`↓ ${c.file}`);
  const tmp = `${dest}.part`;
  execFileSync("curl", ["-fL", "--progress-bar", "-C", "-", "-o", tmp, url], {
    stdio: "inherit",
  });
  const actual = sha256(tmp);
  if (actual !== c.sha256) {
    fs.rmSync(tmp);
    throw new Error(`${c.file}: sha256 ${actual} ≠ ${c.sha256}`);
  }
  fs.renameSync(tmp, dest);
  return dest;
};

const startServer = async (modelPath, opts) => {
  const server = spawn(
    "llama-server",
    [
      ["-m", modelPath],
      ["--port", String(PORT)],
      ["-c", opts.ctx],
      ["-ngl", opts.ngl],
      ["-np", String(opts.parallel ?? 1)],
      ["--jinja"],
      ["--no-webui"],
    ].flat(),
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let log = "";
  server.stderr.on("data", (d) => (log = (log + d).slice(-4000)));
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`llama-server exited:\n${log}`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (res.ok) return server;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  server.kill();
  throw new Error(`llama-server did not become healthy:\n${log}`);
};

const complete = async (task, transcript, maxTokens, sampling = {}) => {
  const started = Date.now();
  const res = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: PROMPTS[task] },
        { role: "user", content: transcript },
      ],
      temperature: 0,
      max_tokens: maxTokens,
      // Qwen3.5 4B thinks by default; the app disables it too.
      chat_template_kwargs: { enable_thinking: false },
      ...sampling,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return {
    text: json.choices[0].message.content ?? "",
    finishReason: json.choices[0].finish_reason,
    promptTokens: json.usage?.prompt_tokens,
    completionTokens: json.usage?.completion_tokens,
    promptTps: json.timings?.prompt_per_second,
    genTps: json.timings?.predicted_per_second,
    ms: Date.now() - started,
  };
};

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const pct = (x) => `${Math.round(x * 100)}%`;

const summarize = (rows) => {
  const byKey = new Map();
  for (const r of rows) {
    const key = `${r.model}\t${r.task}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }
  return [...byKey.entries()].map(([key, rs]) => {
    const [model, task] = key.split("\t");
    return {
      model,
      task,
      score: Math.round(mean(rs.map((r) => r.score.total))),
      recall: pct(mean(rs.map((r) => r.score.recall))),
      lang: pct(mean(rs.map((r) => (r.score.langOk ? 1 : 0)))),
      traps: rs.reduce((n, r) => n + r.score.forbiddenHits.length, 0),
      fillers: rs.reduce((n, r) => n + r.score.fillersLeft, 0),
      leaks: rs.filter((r) => r.score.leak).length,
      truncated: rs.filter((r) => r.finishReason === "length").length,
      ratio: mean(rs.map((r) => r.score.lengthRatio)).toFixed(2),
      genTps: Math.round(mean(rs.map((r) => r.genTps ?? 0))),
      sec: (mean(rs.map((r) => r.ms)) / 1000).toFixed(1),
    };
  });
};

const writeReport = (rows, table) => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = path.join(RESULTS_DIR, stamp);
  fs.writeFileSync(`${base}.json`, JSON.stringify({ table, rows }, null, 2));
  const md = rows
    .map(
      (r) =>
        `## ${r.model} · ${r.task} · ${r.fixture}\n\n` +
        `score ${r.score.total} · recall ${pct(r.score.recall)}` +
        (r.score.missing.length
          ? ` · missing: ${r.score.missing.join(", ")}`
          : "") +
        (r.score.forbiddenHits.length
          ? ` · traps: ${r.score.forbiddenHits.join(", ")}`
          : "") +
        `\n\n${r.text}\n`,
    )
    .join("\n");
  fs.writeFileSync(`${base}.md`, md);
  return base;
};

const main = async () => {
  const opts = parseArgs();
  const fixtures = JSON.parse(fs.readFileSync(opts.fixturesFile, "utf8")).filter(
    (f) => !opts.fixtures || opts.fixtures.includes(f.id),
  );
  const models = opts.gguf
    ? opts.gguf.split(",").map((file) => ({ id: path.basename(file), file }))
    : CANDIDATES.filter((c) => !opts.models || opts.models.includes(c.id));

  const rows = [];
  for (const model of models) {
    const modelPath = opts.gguf ? model.file : ensureModel(model);
    console.log(`▶ ${model.id}`);
    let server;
    try {
      server = await startServer(modelPath, opts);
    } catch (error) {
      console.error(`✗ ${model.id}: ${error.message}`);
      continue;
    }
    try {
      for (const task of opts.tasks) {
        for (const fixture of fixtures) {
          const out = await complete(task, fixture.transcript, opts.maxTokens);
          const score = scoreOutput(task, fixture, out.text);
          rows.push({
            model: model.id,
            task,
            fixture: fixture.id,
            ...out,
            score,
          });
          console.log(
            `  ${task.padEnd(8)} ${fixture.id.padEnd(14)} ${String(score.total).padStart(4)}  ${(out.ms / 1000).toFixed(1)}s`,
          );
        }
      }
    } finally {
      server.kill();
      await new Promise((r) => server.once("exit", r));
    }
  }

  const table = summarize(rows);
  console.log();
  console.table(table);
  console.log(`\nOutputs: ${writeReport(rows, table)}.md`);
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { startServer, complete, summarize, PORT };
