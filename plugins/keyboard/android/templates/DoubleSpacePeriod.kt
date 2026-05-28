package com.a1lab.echos.ime

import android.os.SystemClock

/**
 * Tracks the 1100 ms window LatinIME uses for the smart "type two spaces
 * in a row → swap the trailing space for `. `" gesture.
 */
class DoubleSpacePeriod {

    companion object {
        /** LatinIME's `double_space_period_timeout`. */
        const val WINDOW_MS: Long = 1100L
    }

    private var lastSpaceAt: Long = 0L
    private var awaitingBackspaceUndo: Boolean = false

    fun recordSpaceCommit() {
        lastSpaceAt = SystemClock.uptimeMillis()
        awaitingBackspaceUndo = false
    }

    /**
     * `previousChars` are the two chars immediately before the cursor.
     * Returns true when the caller should replace the trailing space
     * with `. ` (sentence separator + space).
     */
    fun shouldCommitPeriod(previousChars: String, now: Long = SystemClock.uptimeMillis()): Boolean {
        if (lastSpaceAt == 0L) return false
        if (now - lastSpaceAt > WINDOW_MS) return false
        if (previousChars.length < 2) return false
        if (previousChars[previousChars.length - 1] != ' ') return false
        val charBeforeSpace = previousChars[previousChars.length - 2]
        return SpacingAndPunctuations.allowsDoubleSpacePeriod(charBeforeSpace)
    }

    fun markPeriodCommitted() {
        awaitingBackspaceUndo = true
        lastSpaceAt = 0L
    }

    /** Caller asks on every backspace; returns true to revert `. ` → `  `. */
    fun shouldUndoPeriod(): Boolean {
        val undo = awaitingBackspaceUndo
        awaitingBackspaceUndo = false
        return undo
    }

    fun reset() {
        lastSpaceAt = 0L
        awaitingBackspaceUndo = false
    }
}
