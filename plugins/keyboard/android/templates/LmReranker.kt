package com.a1lab.echos.ime

import android.content.Context
import android.util.Log
import java.io.File
import java.util.concurrent.locks.ReentrantLock

/**
 * llama.cpp-backed implementation of [LmRerankerProviding]; the JNI side
 * (llama_jni.cpp) mirrors LmReranker.swift. The native library ships only
 * when the vendor static libs were built locally (scripts/keyboard-lm/
 * build-llama-android.sh) — otherwise [libLoaded] is false and every call
 * degrades to "model unavailable", leaving the classical ranking untouched.
 *
 * Loading runs once, off the UI thread; [scores] runs synchronously on the
 * caller's thread (~3ms p95 measured on A16-class hardware for 8 candidates)
 * and returns null while loading, after failure, or when another thread
 * holds the model.
 */
class LmReranker : LmRerankerProviding {

    companion object {
        private const val TAG = "EchosLmReranker"
        private const val MODEL_ASSET = "keyboard_lm.gguf"

        private val libLoaded: Boolean = try {
            System.loadLibrary("echoslm")
            true
        } catch (t: Throwable) {
            false
        }
    }

    private val lock = ReentrantLock()
    private var handle: Long = 0
    private var state = State.IDLE
    /** Bumped by [unload] so a load already in flight frees its result instead
     *  of publishing (or latching FAILED over) it. */
    private var loadGeneration: Long = 0

    private enum class State { IDLE, LOADING, READY, FAILED }

    /** Starts the one-time background load; safe to call repeatedly. */
    fun loadIfNeeded(context: Context) {
        if (!libLoaded) return
        val generation: Long
        lock.lock()
        try {
            if (state != State.IDLE) return
            state = State.LOADING
            generation = loadGeneration
        } finally {
            lock.unlock()
        }
        val appContext = context.applicationContext
        Thread {
            val loaded = stagedModelPath(appContext)?.let { nativeInit(it) } ?: 0L
            var superseded = false
            lock.lock()
            try {
                if (generation != loadGeneration) {
                    // unload() ran while we were loading — don't publish over
                    // the released state; free below, outside the lock.
                    superseded = true
                } else if (loaded != 0L) {
                    handle = loaded
                    state = State.READY
                } else {
                    state = State.FAILED
                    Log.i(TAG, "model unavailable — reranker disabled")
                }
            } finally {
                lock.unlock()
            }
            if (superseded && loaded != 0L) nativeFree(loaded)
        }.apply {
            name = "EchosLmLoad"
            priority = Thread.MIN_PRIORITY
            start()
        }
    }

    /**
     * Releases the model (memory pressure); the next [loadIfNeeded] reloads.
     * Safe to call mid-load: the in-flight load is invalidated, so it frees its
     * result rather than leaking it behind our back (and rather than leaving
     * LOADING state that blocks a reload).
     */
    fun unload() {
        lock.lock()
        try {
            loadGeneration++
            if (handle != 0L) nativeFree(handle)
            handle = 0
            state = State.IDLE
        } finally {
            lock.unlock()
        }
    }

    /**
     * llama.cpp opens the model by filesystem path and an APK asset has none,
     * so the bundled gguf is copied into filesDir once (skipped while the
     * on-disk copy matches the asset's length).
     */
    // ponytail: 32 MB one-time copy; mmap via AssetManager.openFd offset
    // needs a new JNI entry if disk ever matters.
    private fun stagedModelPath(context: Context): String? {
        val dest = File(context.filesDir, "models/keyboard_lm/$MODEL_ASSET")
        return try {
            val assetLength = context.assets.openFd(MODEL_ASSET).use { it.length }
            if (!dest.exists() || dest.length() != assetLength) {
                dest.parentFile?.mkdirs()
                val tmp = File(dest.parentFile, "$MODEL_ASSET.tmp")
                context.assets.open(MODEL_ASSET).use { input ->
                    tmp.outputStream().use { input.copyTo(it) }
                }
                if (!tmp.renameTo(dest)) {
                    tmp.delete()
                    return null
                }
            }
            dest.absolutePath
        } catch (e: java.io.IOException) {
            Log.i(TAG, "bundled model unavailable: ${e.message}")
            null
        }
    }

    override fun scores(leftContext: String, words: List<String>): FloatArray? {
        if (!libLoaded || words.isEmpty()) return null
        if (!lock.tryLock()) return null
        try {
            if (state != State.READY || handle == 0L) return null
            return nativeScores(handle, leftContext, words.toTypedArray())
        } finally {
            lock.unlock()
        }
    }

    private external fun nativeInit(modelPath: String): Long

    private external fun nativeScores(
        handle: Long,
        leftContext: String,
        words: Array<String>,
    ): FloatArray?

    private external fun nativeFree(handle: Long)
}
