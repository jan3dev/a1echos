"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "../extract-sms-tatoeba.py");

describe("keyboard-lm extract-sms-tatoeba.py", () => {
  test("--self-test", () => {
    const result = spawnSync("python3", [SCRIPT, "--self-test"], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(
        `self-test failed (status ${result.status}):\n${result.stderr || result.stdout}`,
      );
    }
    expect(result.stderr).toMatch(/self-test ok/);
  });
});
