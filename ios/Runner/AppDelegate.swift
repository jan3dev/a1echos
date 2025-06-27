import Flutter
import UIKit
import AVFoundation

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let controller : FlutterViewController = window?.rootViewController as! FlutterViewController
    let audioPermissionChannel = FlutterMethodChannel(name: "com.jan3.a1lab.a1echos/audio_permission",
                                                      binaryMessenger: controller.binaryMessenger)
    audioPermissionChannel.setMethodCallHandler({
      (call: FlutterMethodCall, result: @escaping FlutterResult) -> Void in
      self.handleAudioPermission(call: call, result: result)
    })
    
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  
  private func handleAudioPermission(call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "requestRecordPermission":
      requestRecordPermission(result: result)
    case "getRecordPermissionStatus":
      getRecordPermissionStatus(result: result)
    default:
      result(FlutterMethodNotImplemented)
    }
  }
  
  private func requestRecordPermission(result: @escaping FlutterResult) {
    AVAudioSession.sharedInstance().requestRecordPermission { granted in
      DispatchQueue.main.async {
        result(granted)
      }
    }
  }
  
  private func getRecordPermissionStatus(result: @escaping FlutterResult) {
    let permission = AVAudioSession.sharedInstance().recordPermission
    switch permission {
    case .granted:
      result("granted")
    case .denied:
      result("denied")
    case .undetermined:
      result("undetermined")
    @unknown default:
      result("unknown")
    }
  }
}
