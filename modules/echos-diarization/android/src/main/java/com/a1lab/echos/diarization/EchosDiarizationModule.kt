package com.a1lab.echos.diarization

import com.k2fsa.sherpa.onnx.SpeakerEmbeddingExtractor
import com.k2fsa.sherpa.onnx.SpeakerEmbeddingExtractorConfig
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val WAV_HEADER_SIZE = 44L
private const val SAMPLE_RATE = 16000
// ponytail: fixed thread count; tune from an on-device benchmark if speaker
// identification is too slow.
private const val NUM_THREADS = 2

class EchosDiarizationModule : Module() {
  // Serial: the extractor is not thread-safe and is swapped on model change.
  private val dispatcher = Dispatchers.Default.limitedParallelism(1)
  private var extractor: SpeakerEmbeddingExtractor? = null
  private var modelPath: String? = null

  override fun definition() = ModuleDefinition {
    Name("EchosDiarization")

    AsyncFunction("embed") Coroutine { wavUri: String, modelUri: String, ranges: List<Int> ->
      withContext(dispatcher) { embed(stripFileScheme(wavUri), stripFileScheme(modelUri), ranges) }
    }

    AsyncFunction("release") Coroutine { ->
      withContext(dispatcher) { releaseExtractor() }
    }

    OnDestroy { releaseExtractor() }
  }

  private fun releaseExtractor() {
    extractor?.release()
    extractor = null
    modelPath = null
  }

  private fun embed(wav: String, model: String, ranges: List<Int>): List<FloatArray> {
    if (modelPath != model) {
      releaseExtractor()
      extractor = SpeakerEmbeddingExtractor(
        null, SpeakerEmbeddingExtractorConfig(model, NUM_THREADS, false, "cpu"))
      modelPath = model
    }
    val active = extractor!!
    return RandomAccessFile(wav, "r").use { file ->
      val dataBytes = file.length() - WAV_HEADER_SIZE
      (0 until ranges.size / 2).map { r ->
        val start = ranges[2 * r].toLong() * 2
        val end = minOf(ranges[2 * r + 1].toLong() * 2, dataBytes)
        if (start < 0 || end <= start) return@map FloatArray(0)
        val bytes = ByteArray((end - start).toInt())
        file.seek(WAV_HEADER_SIZE + start)
        file.readFully(bytes)
        val pcm = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
        val samples = FloatArray(pcm.remaining()) { pcm.get(it) / 32768f }
        val stream = active.createStream()
        try {
          stream.acceptWaveform(samples, SAMPLE_RATE)
          stream.inputFinished()
          if (active.isReady(stream)) active.compute(stream) else FloatArray(0)
        } finally {
          stream.release()
        }
      }
    }
  }

  private fun stripFileScheme(uri: String) = uri.removePrefix("file://")
}
