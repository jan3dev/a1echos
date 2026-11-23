import ExpoModulesCore
import Foundation

public class EchosDiarizationModule: Module {
  // Serial: the extractor is not thread-safe and is swapped on model change.
  private let queue = DispatchQueue(label: "com.a1lab.echos.diarization", qos: .userInitiated)
  private var embedder: EchosSpeakerEmbedder?
  private var modelPath: String?

  public func definition() -> ModuleDefinition {
    Name("EchosDiarization")

    AsyncFunction("embed") {
      (wavUri: String, modelUri: String, ranges: [Int], promise: Promise) in
      self.queue.async {
        do {
          let model = Self.path(modelUri)
          if self.modelPath != model {
            self.embedder = nil
            self.modelPath = nil
            guard let embedder = EchosSpeakerEmbedder(model: model) else {
              throw Exception(
                name: "ModelLoadFailed", description: "Could not load the speaker model")
            }
            self.embedder = embedder
            self.modelPath = model
          }
          let embeddings = try self.embedder!.embedWavFile(
            Self.path(wavUri), ranges: ranges.map { NSNumber(value: $0) })
          promise.resolve(embeddings)
        } catch {
          promise.reject(error)
        }
      }
    }

    AsyncFunction("release") { (promise: Promise) in
      self.queue.async {
        self.embedder = nil
        self.modelPath = nil
        promise.resolve(nil)
      }
    }
  }

  private static func path(_ uri: String) -> String {
    uri.hasPrefix("file://") ? (URL(string: uri)?.path ?? uri) : uri
  }
}
