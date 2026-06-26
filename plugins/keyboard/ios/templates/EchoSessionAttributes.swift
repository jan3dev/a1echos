import ActivityKit
import Foundation

/// Shared between the main app (which starts/ends the Live Activity from the
/// foreground session-arm path) and the `EchosWidget` extension (which renders
/// it on the Lock Screen / Dynamic Island). A copy of this exact file is
/// compiled into BOTH targets; ActivityKit matches a running activity to the
/// widget by the attributes type's name + ContentState shape, so the two copies
/// must stay byte-identical.
///
/// Marked `@available(iOS 16.2, *)` because the main app deploys to iOS 16.0 and
/// `ActivityAttributes` / `ActivityContent` are 16.1 / 16.2 APIs; callers gate
/// usage behind `if #available(iOS 16.2, *)`.
@available(iOS 16.2, *)
struct EchoSessionAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// When the hot-mic session expires. The widget renders a live countdown
        /// to this instant via `Text(timerInterval:)`, so the OS ticks it down
        /// without the (backgrounded) app pushing any updates.
        var endDate: Date
    }

    /// Static label shown for the lifetime of the activity.
    var title: String
}
