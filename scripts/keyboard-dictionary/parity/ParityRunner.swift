import Foundation

/// CLI parity harness for the Swift correction engine: replays the fixtures in
/// `data/keyboard-dictionary/parity-fixtures.json` (generated from decoder.js,
/// the reference implementation) and exits non-zero on any divergence.
/// Compiled straight from `plugins/keyboard/ios/templates/` by
/// `run-swift-parity.sh` — no Xcode project involved, CNG stays untouched.
@main
struct ParityRunner {
    static func main() {
        let args = CommandLine.arguments
        guard args.count == 4 else {
            die("usage: parity <dictionary.echd> <confusables.json> <parity-fixtures.json>", code: 2)
        }
        let engine = CorrectionEngine(userLexicon: UserLexicon())
        engine.load(
            dictionaryURL: URL(fileURLWithPath: args[1]),
            confusablesURL: URL(fileURLWithPath: args[2]),
            verifyChecksum: true
        )
        guard engine.isLoaded else {
            die("engine failed to load dictionary (bad path, header, or CRC)")
        }
        guard
            let data = try? Data(contentsOf: URL(fileURLWithPath: args[3])),
            let fixtures = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let evaluateFixtures = fixtures["evaluate"] as? [[String: Any]],
            let nextWordsFixtures = fixtures["nextWords"] as? [[String: Any]],
            let confusableFixtures = fixtures["confusables"] as? [[String: Any]],
            let nextCharFixtures = fixtures["nextCharWeights"] as? [[String: Any]],
            let lmRerankFixtures = fixtures["lmRerank"] as? [[String: Any]]
        else {
            die("could not parse \(args[3])")
        }
        // A renamed or emptied fixture section must fail, not silently shrink
        // coverage to zero and still exit 0.
        for (name, count) in [
            ("evaluate", evaluateFixtures.count),
            ("nextWords", nextWordsFixtures.count),
            ("confusables", confusableFixtures.count),
            ("nextCharWeights", nextCharFixtures.count),
            ("lmRerank", lmRerankFixtures.count),
        ] where count == 0 {
            die("fixture section '\(name)' is empty")
        }

        var failures = 0
        var checked = 0
        func expect<T: Equatable>(
            _ label: String, _ field: String, expected: T, actual: T
        ) {
            checked += 1
            if expected != actual {
                failures += 1
                print("FAIL \(label) \(field): expected \(expected), got \(actual)")
            }
        }

        for v in evaluateFixtures {
            guard let typed = v["typed"] as? String else { continue }
            let prevWord = v["prevWord"] as? String
            let touches = (v["touches"] as? [Any]).map { list in
                list.map { item -> CorrectionEngine.TouchPoint? in
                    guard
                        let p = item as? [String: Any],
                        let x = p["x"] as? Double,
                        let y = p["y"] as? Double
                    else { return nil }
                    return CorrectionEngine.TouchPoint(x: Float(x), y: Float(y))
                }
            }
            let r = engine.evaluate(
                typedRaw: typed,
                previousWord: prevWord,
                checkerSaysValid: false,
                touchPoints: touches
            )
            let label = "evaluate(\(typed)\(prevWord.map { ", prev=\($0)" } ?? ""))"
            expect(label, "candidates",
                   expected: v["candidates"] as? [String] ?? [],
                   actual: r.candidates)
            expect(label, "topIsCorrection",
                   expected: v["topIsCorrection"] as? Bool ?? false,
                   actual: r.topIsCorrection)
            expect(label, "replacement",
                   expected: v["replacement"] as? String,
                   actual: r.replacement)
            expect(label, "verbatim",
                   expected: v["verbatim"] as? String,
                   actual: r.verbatim)
        }

        for v in nextWordsFixtures {
            guard let prevWord = v["prevWord"] as? String else { continue }
            expect("nextWords(\(prevWord))", "predictions",
                   expected: v["predictions"] as? [String] ?? [],
                   actual: engine.nextWords(after: prevWord))
        }

        for v in confusableFixtures {
            guard
                let prev = v["prevWord"] as? String,
                let next = v["nextWord"] as? String
            else { continue }
            expect("confusable(\(prev) \(next))", "contraction",
                   expected: v["contraction"] as? String,
                   actual: engine.contextualContraction(prevWordRaw: prev, nextWord: next))
        }

        for v in nextCharFixtures {
            guard
                let prefix = v["prefix"] as? String,
                let expected = v["weights"] as? [String: Double]
            else { die("malformed nextCharWeights fixture: \(v)") }
            // Both sides are quantized to 4 decimals by construction, so the
            // comparison is exact once the actual weights are re-quantized out
            // of Float32 — a tolerance here would hide a real off-by-one-quantum
            // rounding divergence (see CorrectionEngine.kt's Math.round note).
            var rendered: [String: Double] = [:]
            for (byte, weight) in engine.nextCharWeights(prefix: prefix) {
                rendered[String(UnicodeScalar(byte))] = (Double(weight) * 10000).rounded() / 10000
            }
            expect("nextCharWeights(\(prefix))", "weights",
                   expected: expected, actual: rendered)
        }

        for v in lmRerankFixtures {
            guard
                let typed = v["typed"] as? String,
                let leftContext = v["leftContext"] as? String,
                let lmStrength = v["lmStrength"] as? Double,
                let stub = v["stub"] as? [String: [String: Double]]
            else { die("malformed lmRerank fixture: \(v)") }
            let prevWord = v["prevWord"] as? String
            let r = engine.evaluate(
                typedRaw: typed,
                previousWord: prevWord,
                checkerSaysValid: false,
                leftContext: leftContext,
                reranker: StubReranker(table: stub),
                lmStrength: Float(lmStrength)
            )
            let label = "lmRerank(\(typed), ctx=\(leftContext), λ=\(lmStrength))"
            expect(label, "candidates",
                   expected: v["candidates"] as? [String] ?? [],
                   actual: r.candidates)
            expect(label, "topIsCorrection",
                   expected: v["topIsCorrection"] as? Bool ?? false,
                   actual: r.topIsCorrection)
            expect(label, "replacement",
                   expected: v["replacement"] as? String,
                   actual: r.replacement)
            expect(label, "verbatim",
                   expected: v["verbatim"] as? String,
                   actual: r.verbatim)
        }

        if failures > 0 {
            die("\(failures)/\(checked) parity checks FAILED")
        }
        print("Swift parity: \(checked) checks passed "
            + "(\(evaluateFixtures.count) evaluate, \(nextWordsFixtures.count) nextWords, "
            + "\(confusableFixtures.count) confusables, "
            + "\(nextCharFixtures.count) nextCharWeights, "
            + "\(lmRerankFixtures.count) lmRerank)")
    }

    static func die(_ message: String, code: Int32 = 1) -> Never {
        FileHandle.standardError.write(Data((message + "\n").utf8))
        exit(code)
    }
}

/// Deterministic stand-in for the llama.cpp reranker, mirroring the stub in
/// generate-parity-fixtures.js: context -> word -> logprob, unknown word -10,
/// unknown context -> nil ("model unavailable").
final class StubReranker: LmRerankerProviding {
    private let table: [String: [String: Double]]

    init(table: [String: [String: Double]]) {
        self.table = table
    }

    func scores(leftContext: String, words: [String]) -> [Float]? {
        guard let row = table[leftContext] else { return nil }
        return words.map { Float(row[$0] ?? -10) }
    }
}
