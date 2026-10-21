package com.a1lab.echos.ime

import android.os.Handler
import android.os.Looper
import android.os.SystemClock

/**
 * Drives delete-key auto-repeat to match the iOS keyboard's cadence:
 * after the user has held the key down for 0.3 s the repeat starts at
 * char-rate (LatinIME's 50 ms), then escalates to word-rate once the press
 * passes ~1.5 s. Ticks are scheduled on an absolute clock so the per-tick
 * delete work doesn't stretch the interval.
 *
 * Used by both the regular keyboard and the emoji picker so both bottom
 * bars feel identical when holding delete.
 */
class KeyDeleteRepeater(
    private val onCharDelete: () -> Unit,
    private val onWordDelete: () -> Unit,
) {

    companion object {
        private const val INITIAL_DELAY_MS = 300L
        private const val CHAR_INTERVAL_MS = 50L
        private const val WORD_THRESHOLD_MS = 1500L
        private const val WORD_INTERVAL_MS = 200L
    }

    private val handler = Handler(Looper.getMainLooper())
    private var holdStartTime = 0L
    private var nextTickTime = 0L

    fun start() {
        cancel()
        holdStartTime = SystemClock.uptimeMillis()
        nextTickTime = holdStartTime + INITIAL_DELAY_MS
        handler.postAtTime(repeatRunnable, nextTickTime)
    }

    fun cancel() {
        handler.removeCallbacks(repeatRunnable)
    }

    private val repeatRunnable: Runnable = object : Runnable {
        override fun run() {
            val now = SystemClock.uptimeMillis()
            val interval = if (now - holdStartTime > WORD_THRESHOLD_MS) {
                onWordDelete()
                WORD_INTERVAL_MS
            } else {
                onCharDelete()
                CHAR_INTERVAL_MS
            }
            // After a main-thread stall, resume the cadence rather than
            // replaying every missed tick as a burst.
            nextTickTime = maxOf(nextTickTime + interval, now)
            handler.postAtTime(this, nextTickTime)
        }
    }
}
