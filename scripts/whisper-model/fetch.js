#!/usr/bin/env node
// Fetches the bundled Whisper Base model into assets/models/sherpa-whisper/.
// The files are gitignored (the decoder exceeds GitHub's 100 MB limit), so
// run this before building.
// Usage: node scripts/whisper-model/fetch.js
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

const REVISION = "bb53ee204431c90d314c1cc08d28d23e5b7927cc";
const BASE_URL = `https://huggingface.co/csukuangfj/sherpa-onnx-whisper-base/resolve/${REVISION}`;
const OUT_DIR = path.join(__dirname, "../../assets/models/sherpa-whisper");
const FILES = {
  "base-encoder.int8.onnx":
    "0b8fb1304b6109976038efff5ace81720e00386f3ff6b54ee8c75291ca0a1e11",
  "base-decoder.int8.onnx":
    "9759d217388a01b3a4c7c15533201067b48ae819c4daafc8624e64b9409dc02d",
  "base-tokens.txt":
    "b34b360dbb493e781e479794586d661700670d65564001f23024971d1f2fa126",
};

const sha256OfFile = async (file) => {
  const hash = crypto.createHash("sha256");
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
};

const download = async (name, expected) => {
  const dest = path.join(OUT_DIR, name);
  const part = `${dest}.part`;
  const res = await fetch(`${BASE_URL}/${name}`);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  try {
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(part));
    const actual = await sha256OfFile(part);
    if (actual !== expected) {
      throw new Error(`sha256 mismatch: expected ${expected}, got ${actual}`);
    }
    fs.renameSync(part, dest);
  } finally {
    fs.rmSync(part, { force: true });
  }
};

const main = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, expected] of Object.entries(FILES)) {
    const dest = path.join(OUT_DIR, name);
    if (fs.existsSync(dest) && (await sha256OfFile(dest)) === expected) {
      console.log(`ok       ${name}`);
      continue;
    }
    console.log(`fetching ${name}`);
    try {
      await download(name, expected);
    } catch (error) {
      console.error(`Failed to fetch ${name}: ${error.message}`);
      process.exit(1);
    }
    console.log(`ok       ${name}`);
  }
};

main();
