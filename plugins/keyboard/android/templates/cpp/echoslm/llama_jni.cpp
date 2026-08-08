// JNI backend of LmReranker.kt — llama.cpp scoring of candidate words as
// continuations of the left context. Mirrors LmReranker.swift; see there and
// decoder.js `applyLmRerank` for the scoring contract (one length-normalized
// logprob per word).
//
// Compiled with ECHOS_LM_STUB (no vendor libs for this ABI) every entry point
// degrades to "model unavailable" and the classical engine stands.
#include <jni.h>

#ifdef ECHOS_LM_STUB

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_a1lab_echos_ime_LmReranker_nativeInit(JNIEnv*, jobject, jstring) {
    return 0;
}

JNIEXPORT jfloatArray JNICALL
Java_com_a1lab_echos_ime_LmReranker_nativeScores(
    JNIEnv*, jobject, jlong, jstring, jobjectArray) {
    return nullptr;
}

JNIEXPORT void JNICALL
Java_com_a1lab_echos_ime_LmReranker_nativeFree(JNIEnv*, jobject, jlong) {}

}  // extern "C"

#else  // !ECHOS_LM_STUB

#include <android/log.h>
#include <llama.h>

#include <algorithm>
#include <cmath>
#include <string>
#include <vector>

namespace {

constexpr const char* kTag = "EchosLmReranker";
constexpr int32_t kContextTokenBudget = 128;

struct Runtime {
    llama_model* model = nullptr;
    llama_context* ctx = nullptr;
    const llama_vocab* vocab = nullptr;
};

std::vector<llama_token> tokenize(
    const llama_vocab* vocab, const std::string& text, bool add_special) {
    std::vector<llama_token> tokens(text.size() + 8);
    const int32_t n = llama_tokenize(
        vocab, text.c_str(), static_cast<int32_t>(text.size()), tokens.data(),
        static_cast<int32_t>(tokens.size()), add_special, false);
    if (n <= 0) return {};
    tokens.resize(n);
    return tokens;
}

void append_to_batch(
    llama_batch& batch, llama_token token, llama_pos pos, llama_seq_id seq,
    bool want_logits) {
    const int i = batch.n_tokens;
    batch.token[i] = token;
    batch.pos[i] = pos;
    batch.n_seq_id[i] = 1;
    batch.seq_id[i][0] = seq;
    batch.logits[i] = want_logits ? 1 : 0;
    batch.n_tokens += 1;
}

// log(sum(exp(row))) — the normalizer shared by every token in a row.
float log_sum_exp(const float* row, int count) {
    float max_logit = row[0];
    for (int i = 1; i < count; i++) max_logit = std::max(max_logit, row[i]);
    float sum_exp = 0;
    for (int i = 0; i < count; i++) sum_exp += std::exp(row[i] - max_logit);
    return std::log(sum_exp) + max_logit;
}

// log softmax evaluated at a single index (avoids materializing the whole
// distribution per row).
float log_prob_at(const float* row, int count, int index) {
    return row[index] - log_sum_exp(row, count);
}

std::string jstring_to_utf8(JNIEnv* env, jstring s) {
    if (s == nullptr) return "";
    const char* chars = env->GetStringUTFChars(s, nullptr);
    std::string out(chars ? chars : "");
    env->ReleaseStringUTFChars(s, chars);
    return out;
}

}  // namespace

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_a1lab_echos_ime_LmReranker_nativeInit(
    JNIEnv* env, jobject, jstring model_path) {
    const std::string path = jstring_to_utf8(env, model_path);

    llama_backend_init();
    llama_model_params model_params = llama_model_default_params();
    // mmap without mlock keeps weight pages clean/file-backed; extra buffer
    // types stay off so no runtime weight-repack copy is allocated.
    model_params.load_mode = LLAMA_LOAD_MODE_MMAP;
    model_params.use_extra_bufts = false;

    llama_model* model = llama_model_load_from_file(path.c_str(), model_params);
    if (model == nullptr) {
        __android_log_print(ANDROID_LOG_ERROR, kTag, "model load failed: %s",
                            path.c_str());
        return 0;
    }

    llama_context_params ctx_params = llama_context_default_params();
    ctx_params.n_ctx = kContextTokenBudget;
    // A single decode submits the whole prefix (or every candidate's tokens),
    // so the logical batch must cover the full context budget — anything
    // smaller makes llama_decode reject long contexts outright.
    ctx_params.n_batch = kContextTokenBudget;
    ctx_params.n_ubatch = kContextTokenBudget;
    ctx_params.n_seq_max = 12;
    ctx_params.n_outputs_max = 48;
    ctx_params.n_threads = 2;
    ctx_params.n_threads_batch = 2;
    ctx_params.kv_unified = true;
    llama_context* ctx = llama_init_from_model(model, ctx_params);
    if (ctx == nullptr) {
        __android_log_print(ANDROID_LOG_ERROR, kTag, "context init failed");
        llama_model_free(model);
        return 0;
    }

    auto* runtime = new Runtime();
    runtime->model = model;
    runtime->ctx = ctx;
    runtime->vocab = llama_model_get_vocab(model);
    return reinterpret_cast<jlong>(runtime);
}

JNIEXPORT jfloatArray JNICALL
Java_com_a1lab_echos_ime_LmReranker_nativeScores(
    JNIEnv* env, jobject, jlong handle, jstring left_context,
    jobjectArray words) {
    auto* runtime = reinterpret_cast<Runtime*>(handle);
    if (runtime == nullptr || runtime->ctx == nullptr) return nullptr;
    const jsize n_words = env->GetArrayLength(words);
    if (n_words == 0) return nullptr;

    llama_memory_t memory = llama_get_memory(runtime->ctx);
    llama_memory_clear(memory, true);

    // Prefill the shared context prefix into seq 0. An empty context still
    // needs one anchor token so the first candidate token has a logits row.
    std::vector<llama_token> prefix =
        tokenize(runtime->vocab, jstring_to_utf8(env, left_context), true);
    if (prefix.empty()) prefix = tokenize(runtime->vocab, " ", true);

    std::vector<std::vector<llama_token>> word_tokens;
    size_t total_word_tokens = 0;
    for (jsize w = 0; w < n_words; w++) {
        auto* jword = static_cast<jstring>(env->GetObjectArrayElement(words, w));
        std::string word = " " + jstring_to_utf8(env, jword);
        env->DeleteLocalRef(jword);
        std::vector<llama_token> tokens =
            tokenize(runtime->vocab, word, false);
        if (tokens.empty()) return nullptr;
        total_word_tokens += tokens.size();
        word_tokens.push_back(std::move(tokens));
    }

    // Every candidate continues the same prefix in its own sequence, so the KV
    // cache must hold the prefix plus *all* candidates' tokens. Reserve from
    // the real token counts rather than a fixed guess — a hardcoded margin
    // overflows on long or rare candidates and llama_decode then just fails
    // (silently disabling the reranker). Needs at least one prefix token left
    // to score the first candidate against; beyond that the decode could not
    // succeed, so decline rather than submit an oversized batch.
    if (total_word_tokens >= static_cast<size_t>(kContextTokenBudget)) {
        return nullptr;
    }
    const size_t prefix_budget =
        static_cast<size_t>(kContextTokenBudget) - total_word_tokens;
    if (prefix.size() > prefix_budget) {
        prefix.erase(prefix.begin(), prefix.end() - prefix_budget);
    }

    llama_batch batch = llama_batch_init(
        static_cast<int32_t>(std::max(prefix.size(), total_word_tokens)), 0, 1);

    batch.n_tokens = 0;
    for (size_t i = 0; i < prefix.size(); i++) {
        append_to_batch(batch, prefix[i], static_cast<llama_pos>(i), 0,
                        i == prefix.size() - 1);
    }
    if (llama_decode(runtime->ctx, batch) != 0) {
        llama_batch_free(batch);
        return nullptr;
    }
    const float* prefill_row =
        llama_get_logits_ith(runtime->ctx, batch.n_tokens - 1);
    if (prefill_row == nullptr) {
        llama_batch_free(batch);
        return nullptr;
    }
    const int n_vocab = llama_vocab_n_tokens(runtime->vocab);
    // The prefill row scores every word's FIRST token; only the shared
    // normalizer is needed, not the whole distribution.
    const float prefill_log_sum = log_sum_exp(prefill_row, n_vocab);

    // One batched decode scores every candidate: each word continues the
    // shared prefix in its own sequence (cells shared via kv_unified).
    batch.n_tokens = 0;
    std::vector<std::vector<int32_t>> rows_per_word(word_tokens.size());
    for (size_t w = 0; w < word_tokens.size(); w++) {
        const llama_seq_id seq = static_cast<llama_seq_id>(w + 1);
        llama_memory_seq_cp(memory, 0, seq, -1, -1);
        const auto& tokens = word_tokens[w];
        for (size_t j = 0; j < tokens.size(); j++) {
            const bool want_logits = j + 1 < tokens.size();
            // llama_get_logits_ith indexes by BATCH POSITION (mapped through
            // output_ids), not by compacted output row — a running count of
            // logits-requesting tokens would address the wrong row, or a
            // token that requested none (NULL).
            if (want_logits) rows_per_word[w].push_back(batch.n_tokens);
            append_to_batch(
                batch, tokens[j],
                static_cast<llama_pos>(prefix.size() + j), seq, want_logits);
        }
    }
    if (batch.n_tokens > 0 && llama_decode(runtime->ctx, batch) != 0) {
        llama_batch_free(batch);
        return nullptr;
    }

    std::vector<float> result;
    for (size_t w = 0; w < word_tokens.size(); w++) {
        const auto& tokens = word_tokens[w];
        float sum = prefill_row[tokens[0]] - prefill_log_sum;
        for (size_t j = 0; j < rows_per_word[w].size(); j++) {
            const float* row =
                llama_get_logits_ith(runtime->ctx, rows_per_word[w][j]);
            if (row == nullptr) {
                llama_batch_free(batch);
                return nullptr;
            }
            sum += log_prob_at(row, n_vocab, tokens[j + 1]);
        }
        result.push_back(sum / static_cast<float>(tokens.size()));
    }
    llama_batch_free(batch);

    jfloatArray out = env->NewFloatArray(static_cast<jsize>(result.size()));
    if (out == nullptr) return nullptr;  // OOM — pending exception, no deref
    env->SetFloatArrayRegion(
        out, 0, static_cast<jsize>(result.size()), result.data());
    return out;
}

JNIEXPORT void JNICALL
Java_com_a1lab_echos_ime_LmReranker_nativeFree(JNIEnv*, jobject, jlong handle) {
    auto* runtime = reinterpret_cast<Runtime*>(handle);
    if (runtime == nullptr) return;
    if (runtime->ctx != nullptr) llama_free(runtime->ctx);
    if (runtime->model != nullptr) llama_model_free(runtime->model);
    delete runtime;
}

}  // extern "C"

#endif  // ECHOS_LM_STUB
