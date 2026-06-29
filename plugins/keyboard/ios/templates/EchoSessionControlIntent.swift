import ActivityKit
import AppIntents
import Foundation

/// Interactive "switch off" button for the voice-session Live Activity.
///
/// Compiled into both the widget extension (so the `Button(intent:)` can
/// reference it) and the main app (so iOS can run `perform()` in-process while
/// Echos is alive). `LiveActivityIntent` requires iOS 17, so the whole type is
/// gated — on iOS 16.x the widget simply renders without the button.
///
/// `perform()` is self-sufficient: it ends the indicator and clears the shared
/// session marker directly (works even if the app isn't running), and also
/// posts a Darwin notification so a live app tears down its hot mic.
@available(iOS 17.0, *)
struct EndEchoSessionIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "End voice session"

    private static let appGroupID = "group.com.a1lab.echos.shared"
    private static let endSessionNotificationName = "com.a1lab.echos.endSession"

    func perform() async throws -> some IntentResult {
        // End any running session indicator. ActivityKit matches across
        // processes by the attributes type name.
        for activity in Activity<EchoSessionAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }

        // Clear the App Group session marker so the keyboard stops treating the
        // hot-mic session as live.
        if let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: Self.appGroupID
        ) {
            let marker = container
                .appendingPathComponent("keyboard", isDirectory: true)
                .appendingPathComponent("session.json")
            try? FileManager.default.removeItem(at: marker)
        }

        // Tell the running app (if any) to stop the capture engine + session.
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterPostNotification(
            center,
            CFNotificationName(Self.endSessionNotificationName as CFString),
            nil, nil, true
        )

        return .result()
    }
}
