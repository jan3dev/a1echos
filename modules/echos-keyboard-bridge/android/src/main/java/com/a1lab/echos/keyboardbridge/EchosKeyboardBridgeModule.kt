package com.a1lab.echos.keyboardbridge

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Lets the Echos IME (same process) transcribe on the app's already-loaded JS
 * engine instead of a second copy of the model.
 */
object KeyboardTranscriptionBridge {
  @Volatile internal var module: EchosKeyboardBridgeModule? = null
  private val pending = ConcurrentHashMap<String, (String?, String?) -> Unit>()

  /** Sends a 16 kHz mono 16-bit WAV to JS and returns the request id, or
   *  null (never calling [onResult]) when JS isn't listening, e.g. the app's
   *  JS hasn't started in this process. */
  fun requestTranscription(wavPath: String, onResult: (text: String?, error: String?) -> Unit): String? {
    val target = module ?: return null
    val id = UUID.randomUUID().toString()
    pending[id] = onResult
    return try {
      target.sendEvent("onTranscribeRequest", mapOf("id" to id, "path" to wavPath))
      id
    } catch (e: Exception) {
      pending.remove(id)
      null
    }
  }

  /** Drops a request that timed out so a late reply is ignored. */
  fun cancel(id: String) {
    pending.remove(id)
  }

  internal fun complete(id: String, text: String?, error: String?) {
    pending.remove(id)?.invoke(text, error)
  }
}

class EchosKeyboardBridgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EchosKeyboardBridge")

    Events("onTranscribeRequest")

    OnStartObserving { KeyboardTranscriptionBridge.module = this@EchosKeyboardBridgeModule }

    OnStopObserving { detach() }

    OnDestroy { detach() }

    Function("completeTranscription") { id: String, text: String?, error: String? ->
      KeyboardTranscriptionBridge.complete(id, text, error)
    }
  }

  private fun detach() {
    if (KeyboardTranscriptionBridge.module === this) {
      KeyboardTranscriptionBridge.module = null
    }
  }
}
