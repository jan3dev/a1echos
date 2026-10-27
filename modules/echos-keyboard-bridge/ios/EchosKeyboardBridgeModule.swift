import ExpoModulesCore
import Foundation

/// Lets `KeyboardTranscriptionListener` (app target) transcribe on the app's
/// already-loaded JS engine instead of a second copy of the model.
public enum KeyboardTranscriptionBridge {
  private static let lock = NSLock()
  private static weak var module: EchosKeyboardBridgeModule?
  private static var pending: [String: (String?, String?) -> Void] = [:]

  /// Sends a 16 kHz mono 16-bit WAV to JS and returns the request id, or nil
  /// (never calling `onResult`) when JS isn't listening.
  public static func requestTranscription(
    path: String, onResult: @escaping (_ text: String?, _ error: String?) -> Void
  ) -> String? {
    let id = UUID().uuidString
    lock.lock()
    guard let target = module else {
      lock.unlock()
      return nil
    }
    pending[id] = onResult
    lock.unlock()
    target.sendEvent("onTranscribeRequest", ["id": id, "path": path])
    return id
  }

  /// Drops a request that timed out so a late reply is ignored.
  public static func cancel(_ id: String) {
    lock.lock()
    pending[id] = nil
    lock.unlock()
  }

  static func attach(_ module: EchosKeyboardBridgeModule) {
    lock.lock()
    self.module = module
    lock.unlock()
  }

  static func detach(_ module: EchosKeyboardBridgeModule) {
    lock.lock()
    if self.module === module { self.module = nil }
    lock.unlock()
  }

  static func complete(id: String, text: String?, error: String?) {
    lock.lock()
    let onResult = pending.removeValue(forKey: id)
    lock.unlock()
    onResult?(text, error)
  }
}

public class EchosKeyboardBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("EchosKeyboardBridge")

    Events("onTranscribeRequest")

    OnStartObserving { KeyboardTranscriptionBridge.attach(self) }

    OnStopObserving { KeyboardTranscriptionBridge.detach(self) }

    OnDestroy { KeyboardTranscriptionBridge.detach(self) }

    Function("completeTranscription") { (id: String, text: String?, error: String?) in
      KeyboardTranscriptionBridge.complete(id: id, text: text, error: error)
    }
  }
}
