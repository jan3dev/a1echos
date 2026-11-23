require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))
# c-api.h is the same in both slices of the xcframework.
sherpa_headers = File.expand_path(
  '../../../node_modules/react-native-sherpa-onnx/ios/Frameworks/sherpa_onnx.xcframework/ios-arm64/Headers',
  __dir__
)

Pod::Spec.new do |s|
  s.name           = 'EchosDiarization'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = 'JAN3'
  s.homepage       = 'https://jan3.com'
  s.platforms      = { :ios => '16.0' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Links libsherpa-onnx.a into the app; this pod only calls into it.
  s.dependency 'SherpaOnnx'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'HEADER_SEARCH_PATHS' => "$(inherited) \"#{sherpa_headers}\""
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
