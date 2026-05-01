package com.a1lab.echos.ime

import android.os.Handler
import android.os.Looper
import android.os.SystemClock

/**
 * Drives delete-key auto-repeat to match the iOS keyboard's cadence:
 * after the user has held the key down for ~0.4 s the repeat starts at
 * char-rate, then escalates to word-rate once the press passes ~1.5 s.
 *
 * Used by both the regular keyboard and the emoji picker so both bottom
 * bars feel identical when holding delete.
 */
class KeyDeleteRepeater(
    private val onCharDelete: () -> Unit,
    private val onWordDelete: () -> Unit,
) {

    companion object {
        private const val INITIAL_DELAY_MS = 400L
        private const val CHAR_INTERVAL_MS = 80L
        private const val WORD_THRESHOLD_MS = 1500L
        private const val WORD_INTERVAL_MS = 200L
    }

    private val handler = Handler(Looper.getMainLooper())
    private var holdStartTime = 0L
    private var fired = false

    /** True if at least one auto-repeat has fired since the last `start()`. */
    val didRepeat: Boolean
        get() = fired

    fun start() {
        cancel()
        fired = false
        holdStartTime = SystemClock.uptimeMillis()
        handler.postDelayed(repeatRunnable, INITIAL_DELAY_MS)
    }

    fun cancel() {
        handler.removeCallbacks(repeatRunnable)
        fired = false
    }

    private val repeatRunnable: Runnable = object : Runnable {
        override fun run() {
            fired = true
            val elapsed = SystemClock.uptimeMillis() - holdStartTime
            if (elapsed > WORD_THRESHOLD_MS) {
                onWordDelete()
                handler.postDelayed(this, WORD_INTERVAL_MS)
            } else {
                onCharDelete()
                handler.postDelayed(this, CHAR_INTERVAL_MS)
            }
        }
    }
}
