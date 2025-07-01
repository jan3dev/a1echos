// swift-tools-version:5.7
import PackageDescription

let package = Package(
  name: "_umbrella_",
  dependencies: [
    .package(url: "https://github.com/argmaxinc/WhisperKit.git", .upToNextMajor(from: "0.13.0"))
  ]
)
