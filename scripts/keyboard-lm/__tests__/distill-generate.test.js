"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "../distill-generate.py");

describe("keyboard-lm distill-generate.py", () => {
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

  test("--dry-run prints a filled prompt", () => {
    const result = spawnSync(
      "python3",
      [SCRIPT, "--dry-run", "1", "--only", "literal", "--seed", "1"],
      { encoding: "utf8" },
    );
    if (result.status !== 0) {
      throw new Error(
        `dry-run failed (status ${result.status}):\n${result.stderr || result.stdout}`,
      );
    }
    expect(result.stdout).toMatch(/task=literal/);
    expect(result.stdout).toMatch(/LITERAL word/);
    expect(result.stdout).not.toMatch(/\{n\}/);
  });
});
