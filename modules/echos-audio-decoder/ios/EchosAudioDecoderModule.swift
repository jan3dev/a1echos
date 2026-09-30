import AVFoundation
import ExpoModulesCore
import Foundation

public class EchosAudioDecoderModule: Module {
  private static let sampleRate = 16000

  public func definition() -> ModuleDefinition {
    Name("EchosAudioDecoder")

    AsyncFunction("decodeToWav16k") {
      (srcUri: String, dstUri: String, maxDurationMs: Double) async throws -> [String: Double] in
      let asset = AVURLAsset(url: Self.url(fromPath: srcUri))
      let durationMs = try await asset.load(.duration).seconds * 1000
      if durationMs.isFinite && durationMs > maxDurationMs {
        return ["durationMs": durationMs]
      }
      guard let track = try await asset.loadTracks(withMediaType: .audio).first else {
        throw Exception(name: "NoAudioTrack", description: "File has no audio track")
      }

      let reader = try AVAssetReader(asset: asset)
      // AVAssetReader resamples and downmixes to these settings itself.
      let output = AVAssetReaderTrackOutput(
        track: track,
        outputSettings: [
          AVFormatIDKey: kAudioFormatLinearPCM,
          AVSampleRateKey: Self.sampleRate,
          AVNumberOfChannelsKey: 1,
          AVLinearPCMBitDepthKey: 16,
          AVLinearPCMIsFloatKey: false,
          AVLinearPCMIsBigEndianKey: false,
          AVLinearPCMIsNonInterleaved: false,
        ]
      )
      reader.add(output)
      guard reader.startReading() else {
        throw reader.error
          ?? Exception(name: "DecodeFailed", description: "Could not start decoding")
      }

      let dstURL = Self.url(fromPath: dstUri)
      FileManager.default.createFile(atPath: dstURL.path, contents: nil)
      let handle = try FileHandle(forWritingTo: dstURL)
      defer { try? handle.close() }
      try handle.write(contentsOf: Self.wavHeader(dataBytes: 0))

      var dataBytes: UInt32 = 0
      let maxBytes = maxDurationMs * Double(Self.sampleRate * 2) / 1000
      while let sampleBuffer = output.copyNextSampleBuffer() {
        try autoreleasepool {
          guard let block = CMSampleBufferGetDataBuffer(sampleBuffer) else { return }
          let length = CMBlockBufferGetDataLength(block)
          guard length > 0 else { return }
          var data = Data(count: length)
          data.withUnsafeMutableBytes { ptr in
            _ = CMBlockBufferCopyDataBytes(
              block, atOffset: 0, dataLength: length, destination: ptr.baseAddress!)
          }
          try handle.write(contentsOf: data)
          dataBytes += UInt32(length)
        }
        // Assets without a finite duration are only caught here.
        if Double(dataBytes) > maxBytes {
          reader.cancelReading()
          return ["durationMs": Double(dataBytes) / Double(Self.sampleRate * 2) * 1000]
        }
      }
      guard reader.status == .completed else {
        throw reader.error
          ?? Exception(name: "DecodeFailed", description: "Decoding did not complete")
      }

      try handle.seek(toOffset: 0)
      try handle.write(contentsOf: Self.wavHeader(dataBytes: dataBytes))
      return ["durationMs": Double(dataBytes) / Double(Self.sampleRate * 2) * 1000]
    }
  }

  private static func wavHeader(dataBytes: UInt32) -> Data {
    var data = Data()
    func append<T: FixedWidthInteger>(_ value: T) {
      withUnsafeBytes(of: value.littleEndian) { data.append(contentsOf: $0) }
    }
    data.append(contentsOf: Array("RIFF".utf8))
    append(UInt32(36) + dataBytes)
    data.append(contentsOf: Array("WAVEfmt ".utf8))
    append(UInt32(16))
    append(UInt16(1))
    append(UInt16(1))
    append(UInt32(sampleRate))
    append(UInt32(sampleRate * 2))
    append(UInt16(2))
    append(UInt16(16))
    data.append(contentsOf: Array("data".utf8))
    append(dataBytes)
    return data
  }

  private static func url(fromPath path: String) -> URL {
    if path.hasPrefix("file://") {
      return URL(string: path) ?? URL(fileURLWithPath: path)
    }
    return URL(fileURLWithPath: path)
  }
}
