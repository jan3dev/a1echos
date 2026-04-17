package com.a1lab.echos.ime

import java.util.concurrent.atomic.AtomicReference

/**
 * Process-level mutex preventing simultaneous microphone use by the main app
 * and the IME keyboard. Since both run in the same process, an AtomicReference
 * is sufficient for coordination.
 */
object RecordingLock {

    private val owner = AtomicReference<String>(null)

    /**
     * Attempts to acquire the recording lock.
     * @param requestor Identifier for who is requesting (e.g., "ime" or "app")
     * @return true if the lock was acquired, false if already held by another owner
     */
    fun tryAcquire(requestor: String): Boolean {
        return owner.compareAndSet(null, requestor)
    }

    /**
     * Releases the recording lock, but only if the requestor is the current owner.
     * @param requestor Identifier of the current holder
     */
    fun release(requestor: String) {
        owner.compareAndSet(requestor, null)
    }

    /**
     * Returns the current lock owner, or null if unlocked.
     */
    fun currentOwner(): String? = owner.get()

    /**
     * Returns true if the lock is currently held by anyone.
     */
    fun isLocked(): Boolean = owner.get() != null
}
