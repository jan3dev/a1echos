import Darwin
import Foundation
import llama

/// llama.cpp-backed implementation of `LmRerankerProviding`: scores candidate
/// words as continuations of the left context using the downloaded GGUF
/// (~30M-param decoder), CPU-only.
///
/// Memory contract (the reason this can live inside a keyboard extension at
/// all): weights are mmap'd read-only so they stay clean file-backed pages
/// that jetsam does not charge to the extension; only the KV cache, logits
/// buffer, and tokenizer are dirty (~13MB measured for the 31MB spike model).
/// Metal and runtime weight-repacking must stay off — both would materialize
/// a dirty copy of the model. See scripts/keyboard-lm/ and the M0 spike
/// results in the project plan.
///
/// Scoring runs synchronously on the caller's thread (~3ms p95 on A16 for 8
/// candidates); loading runs once, off-main. Until the model is ready every
/// call returns nil and the classical ranking stands.
final class LmReranker: LmRerankerProviding {
    private static let contextTokenBudget: Int32 = 128

    private let lock = NSLock()
    private var model: OpaquePointer?
    private var ctx: OpaquePointer?
    private var vocab: OpaquePointer?
    private var loadState: LoadState = .idle
    /// Bumped by `unload()` so a load already in flight discards its result
    /// instead of publishing (or latching `.failed` over) it.
    private var loadGeneration: UInt64 = 0

    private enum LoadState {
        case idle, loading, ready, failed
    }

    /// The downloaded model, mirrored into the App Group by the main app;
    /// the bundled copy (dev builds staged by the config plugin when
    /// data/keyboard-lm/keyboard_lm.gguf exists locally) takes precedence.
    static func modelURL() -> URL? {
        if let bundled = Bundle.main.url(
            forResource: "keyboard_lm", withExtension: "gguf")
        {
            return bundled
        }
        guard let container = IPCClient.sharedContainerURL() else { return nil }
        let url = container.appendingPathComponent(
            "keyboard-lm/keyboard_lm.gguf")
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    /// Starts the one-time background load; safe to call repeatedly.
    func loadIfNeeded() {
        lock.lock()
        guard loadState == .idle else {
            lock.unlock()
            return
        }
        loadState = .loading
        let generation = loadGeneration
        lock.unlock()

        DispatchQueue.global(qos: .utility).async { [weak self] in
            self?.loadNow(generation: generation)
        }
    }

    /// Releases the context and model (memory pressure); the next
    /// `loadIfNeeded` reloads. Safe to call mid-load: the in-flight load is
    /// invalidated, so it frees its result rather than leaking it behind our
    /// back (and rather than leaving `.loading` state that blocks a reload).
    func unload() {
        lock.lock()
        defer { lock.unlock() }
        loadGeneration += 1
        if let ctx { llama_free(ctx) }
        if let model { llama_model_free(model) }
        ctx = nil
        model = nil
        vocab = nil
        loadState = .idle
    }

    /// Records a terminal load state unless `unload()` superseded this load.
    private func finishLoad(generation: UInt64, state: LoadState) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard generation == loadGeneration else { return false }
        loadState = state
        return true
    }

    private func loadNow(generation: UInt64) {
        guard let url = Self.modelURL() else {
            kbLog.info("LmReranker: no model file — reranker disabled")
            _ = finishLoad(generation: generation, state: .failed)
            return
        }

        llama_backend_init()
        var modelParams = llama_model_default_params()
        // mmap without mlock keeps weight pages clean/file-backed (not
        // charged to phys_footprint); extra buffer types stay off so no
        // runtime weight-repack copy is allocated.
        modelParams.load_mode = LLAMA_LOAD_MODE_MMAP
        modelParams.use_extra_bufts = false

        let start = DispatchTime.now()
        guard let loadedModel = llama_model_load_from_file(url.path, modelParams)
        else {
            kbLog.error("LmReranker: model load failed")
            _ = finishLoad(generation: generation, state: .failed)
            return
        }

        var ctxParams = llama_context_default_params()
        ctxParams.n_ctx = UInt32(Self.contextTokenBudget)
        // A single decode submits the whole prefix (or every candidate's
        // tokens), so the logical batch must cover the full context budget —
        // anything smaller makes llama_decode reject long contexts outright.
        ctxParams.n_batch = UInt32(Self.contextTokenBudget)
        ctxParams.n_ubatch = UInt32(Self.contextTokenBudget)
        ctxParams.n_seq_max = 12
        ctxParams.n_outputs_max = 48
        ctxParams.n_threads = 2
        ctxParams.n_threads_batch = 2
        ctxParams.kv_unified = true
        guard let loadedCtx = llama_init_from_model(loadedModel, ctxParams) else {
            kbLog.error("LmReranker: context init failed")
            llama_model_free(loadedModel)
            _ = finishLoad(generation: generation, state: .failed)
            return
        }

        let ms = Double(
            DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds)
            / 1_000_000
        kbLog.info("LmReranker: model ready in \(ms, format: .fixed(precision: 0))ms")

        lock.lock()
        guard generation == loadGeneration else {
            // unload() ran while we were loading — drop what we just built
            // instead of publishing it over the released state.
            lock.unlock()
            llama_free(loadedCtx)
            llama_model_free(loadedModel)
            return
        }
        model = loadedModel
        ctx = loadedCtx
        vocab = llama_model_get_vocab(loadedModel)
        loadState = .ready
        lock.unlock()
    }

    // MARK: - LmRerankerProviding

    func scores(leftContext: String, words: [String]) -> [Float]? {
        guard !words.isEmpty else { return nil }
        guard lock.try() else { return nil }
        defer { lock.unlock() }
        guard loadState == .ready, let ctx, let vocab else { return nil }

        let memory = llama_get_memory(ctx)
        llama_memory_clear(memory, true)

        // Prefill the shared context prefix into seq 0. An empty context
        // still needs one BOS-ish anchor token so the first candidate token
        // has a logits row to be scored from.
        var prefix = tokenize(leftContext, vocab: vocab, addSpecial: true)
        if prefix.isEmpty {
            prefix = tokenize(" ", vocab: vocab, addSpecial: true)
        }
        let wordTokens = words.map {
            tokenize(" " + $0, vocab: vocab, addSpecial: false)
        }
        guard wordTokens.allSatisfy({ !$0.isEmpty }) else { return nil }

        // Every candidate continues the same prefix in its own sequence, so
        // the KV cache must hold the prefix plus *all* candidates' tokens.
        // Reserve from the real token counts rather than a fixed guess — a
        // hardcoded margin overflows on long or rare candidates and
        // llama_decode then just fails (silently disabling the reranker).
        let candidateTokens = wordTokens.reduce(0) { $0 + $1.count }
        // Needs room for the candidates plus at least one prefix token to
        // score the first one against. Beyond that the decode could not
        // succeed, so decline instead of submitting an oversized batch.
        guard candidateTokens < Int(Self.contextTokenBudget) else { return nil }
        let prefixBudget = Int(Self.contextTokenBudget) - candidateTokens
        if prefix.count > prefixBudget {
            prefix = Array(prefix.suffix(prefixBudget))
        }

        let maxTokens = max(prefix.count, candidateTokens)
        var batch = llama_batch_init(Int32(maxTokens), 0, 1)
        defer { llama_batch_free(batch) }

        batch.n_tokens = 0
        for (i, token) in prefix.enumerated() {
            append(
                &batch, token: token, pos: Int32(i), seq: 0,
                wantLogits: i == prefix.count - 1)
        }
        guard llama_decode(ctx, batch) == 0,
            let prefillRow = llama_get_logits_ith(ctx, batch.n_tokens - 1)
        else { return nil }
        let nVocab = Int(llama_vocab_n_tokens(vocab))
        let prefillLogSum = logSumExp(row: prefillRow, count: nVocab)

        // One batched decode scores every candidate: each word continues the
        // shared prefix in its own sequence (cells shared via kv_unified).
        batch.n_tokens = 0
        var rowsPerWord: [[Int32]] = []
        for (w, tokens) in wordTokens.enumerated() {
            let seq = llama_seq_id(w + 1)
            llama_memory_seq_cp(memory, 0, seq, -1, -1)
            var rows: [Int32] = []
            for (j, token) in tokens.enumerated() {
                let wantLogits = j < tokens.count - 1
                // `llama_get_logits_ith` indexes by BATCH POSITION (it maps
                // through the context's output_ids), not by compacted output
                // row — a running count of logits-requesting tokens would
                // address the wrong row, or a token that requested none (NULL).
                if wantLogits { rows.append(batch.n_tokens) }
                append(
                    &batch, token: token, pos: Int32(prefix.count + j),
                    seq: seq, wantLogits: wantLogits)
            }
            rowsPerWord.append(rows)
        }

        var result: [Float] = []
        if batch.n_tokens > 0 {
            guard llama_decode(ctx, batch) == 0 else { return nil }
        }
        for (w, tokens) in wordTokens.enumerated() {
            var sum = prefillRow[Int(tokens[0])] - prefillLogSum
            for (j, row) in rowsPerWord[w].enumerated() {
                guard let logits = llama_get_logits_ith(ctx, row) else {
                    return nil
                }
                sum += logProb(row: logits, count: nVocab, token: tokens[j + 1])
            }
            result.append(sum / Float(tokens.count))
        }
        return result
    }

    // MARK: - llama helpers

    private func tokenize(
        _ text: String, vocab: OpaquePointer, addSpecial: Bool
    ) -> [llama_token] {
        let utf8Count = text.utf8.count
        var tokens = [llama_token](repeating: 0, count: utf8Count + 8)
        let n = llama_tokenize(
            vocab, text, Int32(utf8Count), &tokens, Int32(tokens.count),
            addSpecial, false)
        guard n > 0 else { return [] }
        return Array(tokens.prefix(Int(n)))
    }

    private func append(
        _ batch: inout llama_batch, token: llama_token, pos: Int32,
        seq: llama_seq_id, wantLogits: Bool
    ) {
        let i = Int(batch.n_tokens)
        batch.token[i] = token
        batch.pos[i] = pos
        batch.n_seq_id[i] = 1
        batch.seq_id[i]![0] = seq
        batch.logits[i] = wantLogits ? 1 : 0
        batch.n_tokens += 1
    }

    /// `log(sum(exp(row)))`, the normalizer shared by every token in a row.
    /// Only the scalar is computed — materializing the full log-softmax would
    /// allocate an `nVocab`-wide array (~200KB) per row to read one element,
    /// on the per-keystroke path. Mirrors `log_sum_exp` in llama_jni.cpp.
    private func logSumExp(
        row: UnsafeMutablePointer<Float>, count: Int
    ) -> Float {
        var maxLogit: Float = -.infinity
        for i in 0..<count { maxLogit = max(maxLogit, row[i]) }
        var sumExp: Float = 0
        for i in 0..<count { sumExp += expf(row[i] - maxLogit) }
        return logf(sumExp) + maxLogit
    }

    /// Log-probability of a single token in a logits row.
    private func logProb(
        row: UnsafeMutablePointer<Float>, count: Int, token: llama_token
    ) -> Float {
        row[Int(token)] - logSumExp(row: row, count: count)
    }
}
