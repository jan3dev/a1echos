import ExpoModulesCore
import Foundation

public class EchosFileProtectionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("EchosFileProtection")

    AsyncFunction("setFileProtection") {
      (path: String, protection: String) throws -> Void in
      let url = Self.url(fromPath: path)
      let value: FileProtectionType
      switch protection {
      case "complete":
        value = .complete
      case "completeUnlessOpen":
        value = .completeUnlessOpen
      case "completeUntilFirstUserAuthentication":
        value = .completeUntilFirstUserAuthentication
      case "none":
        value = .none
      default:
        throw Exception(
          name: "InvalidProtectionClass",
          description: "Unknown protection class: \(protection)"
        )
      }
      try FileManager.default.setAttributes(
        [.protectionKey: value],
        ofItemAtPath: url.path
      )
    }

    AsyncFunction("getFileProtection") { (path: String) throws -> String in
      let url = Self.url(fromPath: path)
      let attrs = try FileManager.default.attributesOfItem(atPath: url.path)
      guard let value = attrs[.protectionKey] as? FileProtectionType else {
        return "none"
      }
      switch value {
      case .complete:
        return "complete"
      case .completeUnlessOpen:
        return "completeUnlessOpen"
      case .completeUntilFirstUserAuthentication:
        return "completeUntilFirstUserAuthentication"
      case .none:
        return "none"
      default:
        return "none"
      }
    }

    AsyncFunction("setBackupExcluded") {
      (path: String, excluded: Bool) throws -> Void in
      var url = Self.url(fromPath: path)
      var resourceValues = URLResourceValues()
      resourceValues.isExcludedFromBackup = excluded
      try url.setResourceValues(resourceValues)
    }
  }

  private static func url(fromPath path: String) -> URL {
    if path.hasPrefix("file://") {
      return URL(string: path) ?? URL(fileURLWithPath: path)
    }
    return URL(fileURLWithPath: path)
  }
}
