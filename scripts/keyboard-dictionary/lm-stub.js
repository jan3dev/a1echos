"use strict";

/**
 * Deterministic stand-in for the on-device LM reranker.
 *
 * Shared by the JS unit suite (`__tests__/lm-rerank.test.js`) and the parity
 * fixture generator so both replay identical scores — the Swift
 * (`ParityRunner.StubReranker`) and Kotlin (`CorrectionEngineParityTest`)
 * mirrors implement this same contract. If the unknown-word default or the
 * unknown-context behaviour drifts between the two JS callers, the fixtures
 * stop describing what the unit tests assert, which is exactly the divergence
 * the parity harness exists to catch.
 *
 * Contract: an unknown left context returns `null` ("model has no opinion",
 * leaving the classical ranking untouched); a known context scores each word
 * from its row, defaulting to `UNKNOWN_WORD_LOGPROB` for words absent from it.
 */

/** Length-normalized logprob assigned to words missing from a context's row. */
const UNKNOWN_WORD_LOGPROB = -10;

const makeStubReranker = (table) => ({
  scores: (leftContext, words) => {
    const row = table[leftContext];
    if (!row) return null;
    return words.map((w) => row[w] ?? UNKNOWN_WORD_LOGPROB);
  },
});

module.exports = { makeStubReranker, UNKNOWN_WORD_LOGPROB };
