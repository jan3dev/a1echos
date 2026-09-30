package com.a1lab.echos.audiodecoder

import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val TARGET_RATE = 16000
private const val TIMEOUT_US = 10_000L

class EchosAudioDecoderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EchosAudioDecoder")

    // Off the shared AsyncFunction queue: a multi-hour decode would stall every other module.
    AsyncFunction("decodeToWav16k") Coroutine { srcUri: String, dstUri: String, maxDurationMs: Double ->
      withContext(Dispatchers.IO) {
        decode(stripFileScheme(srcUri), stripFileScheme(dstUri), maxDurationMs)
      }
    }
  }

  private fun decode(src: String, dst: String, maxDurationMs: Double): Map<String, Double> {
    val extractor = MediaExtractor()
    var codec: MediaCodec? = null
    try {
      extractor.setDataSource(src)
      val trackIndex = (0 until extractor.trackCount).firstOrNull {
        extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
      } ?: throw IllegalArgumentException("File has no audio track")
      extractor.selectTrack(trackIndex)
      val format = extractor.getTrackFormat(trackIndex)
      if (format.containsKey(MediaFormat.KEY_DURATION)) {
        val durationMs = format.getLong(MediaFormat.KEY_DURATION) / 1000.0
        if (durationMs > maxDurationMs) return mapOf("durationMs" to durationMs)
      }

      val decoder = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
      codec = decoder
      decoder.configure(format, null, null, 0)
      decoder.start()

      RandomAccessFile(dst, "rw").use { out ->
        out.setLength(0)
        out.write(wavHeader(0))
        val downsampler = Downsampler(format.getInteger(MediaFormat.KEY_SAMPLE_RATE))
        var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        var isFloat = false
        var dataBytes = 0L
        val maxBytes = maxDurationMs * TARGET_RATE * 2 / 1000
        fun result() = mapOf("durationMs" to dataBytes / (TARGET_RATE * 2.0) * 1000)
        val info = MediaCodec.BufferInfo()
        var inputDone = false
        var outputDone = false

        while (!outputDone) {
          if (!inputDone) {
            val inIndex = decoder.dequeueInputBuffer(TIMEOUT_US)
            if (inIndex >= 0) {
              val size = extractor.readSampleData(decoder.getInputBuffer(inIndex)!!, 0)
              if (size < 0) {
                decoder.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                inputDone = true
              } else {
                decoder.queueInputBuffer(inIndex, 0, size, extractor.sampleTime, 0)
                extractor.advance()
              }
            }
          }

          val outIndex = decoder.dequeueOutputBuffer(info, TIMEOUT_US)
          if (outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
            val outFormat = decoder.outputFormat
            downsampler.srcRate = outFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            channels = outFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            val encoding = if (outFormat.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
              outFormat.getInteger(MediaFormat.KEY_PCM_ENCODING)
            } else {
              AudioFormat.ENCODING_PCM_16BIT
            }
            require(encoding == AudioFormat.ENCODING_PCM_16BIT || encoding == AudioFormat.ENCODING_PCM_FLOAT) {
              "Unsupported PCM encoding $encoding"
            }
            isFloat = encoding == AudioFormat.ENCODING_PCM_FLOAT
          } else if (outIndex >= 0) {
            val buf = decoder.getOutputBuffer(outIndex)!!.order(ByteOrder.LITTLE_ENDIAN)
            buf.position(info.offset)
            buf.limit(info.offset + info.size)
            downsampler.size = 0
            val bytesPerSample = if (isFloat) 4 else 2
            while (buf.remaining() >= channels * bytesPerSample) {
              var sum = 0f
              repeat(channels) {
                sum += if (isFloat) buf.float else buf.short / 32768f
              }
              downsampler.push(sum / channels)
            }
            decoder.releaseOutputBuffer(outIndex, false)
            out.write(downsampler.out, 0, downsampler.size)
            dataBytes += downsampler.size
            // Containers without a duration header are only caught here.
            if (dataBytes > maxBytes) return result()
            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputDone = true
          }
        }

        out.seek(0)
        out.write(wavHeader(dataBytes.toInt()))
        return result()
      }
    } finally {
      codec?.let {
        try { it.stop() } catch (_: IllegalStateException) {}
        it.release()
      }
      extractor.release()
    }
  }

  // ponytail: box-average decimation is a crude low-pass; swap for a windowed-sinc resampler if ASR quality on 44.1k+ sources suffers.
  private class Downsampler(srcRate: Int) {
    var srcRate = srcRate
      set(value) {
        field = value
        step = value.toDouble() / TARGET_RATE
      }
    private var step = srcRate.toDouble() / TARGET_RATE
    var out = ByteArray(16 * 1024)
    var size = 0
    private var acc = 0f
    private var count = 0
    private var phase = 0.0
    private var last = 0f

    fun push(sample: Float) {
      acc += sample
      count++
      last = sample
      phase += 1.0
      while (phase >= step) {
        val value = if (count > 0) acc / count else last
        val pcm = (value.coerceIn(-1f, 1f) * 32767f).toInt()
        if (size + 2 > out.size) out = out.copyOf(out.size * 2)
        out[size++] = pcm.toByte()
        out[size++] = (pcm shr 8).toByte()
        phase -= step
        acc = 0f
        count = 0
      }
    }
  }

  private fun wavHeader(dataBytes: Int): ByteArray =
    ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN).apply {
      put("RIFF".toByteArray())
      putInt(36 + dataBytes)
      put("WAVEfmt ".toByteArray())
      putInt(16)
      putShort(1)
      putShort(1)
      putInt(TARGET_RATE)
      putInt(TARGET_RATE * 2)
      putShort(2)
      putShort(16)
      put("data".toByteArray())
      putInt(dataBytes)
    }.array()

  private fun stripFileScheme(path: String): String =
    if (path.startsWith("file://")) android.net.Uri.parse(path).path ?: path.removePrefix("file://") else path
}
