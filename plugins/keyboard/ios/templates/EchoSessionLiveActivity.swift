import ActivityKit
import SwiftUI
import WidgetKit

/// A countdown range that is always valid. `Text(timerInterval:)` traps if the
/// range's lowerBound > upperBound, which would happen if the activity renders
/// at/after expiry — so clamp the end to never precede `now` (both bounds
/// captured from a single `now` to avoid a sub-millisecond inversion).
private func echoCountdownRange(to endDate: Date) -> ClosedRange<Date> {
    let now = Date()
    return now...max(endDate, now)
}

/// Lock Screen + Dynamic Island presentation for an active Echos voice-typing
/// session. The countdown uses `Text(timerInterval:)`, so the system animates
/// the remaining time every second on its own — the app never pushes updates
/// (it's backgrounded while the user dictates in another app).
///
/// No `@available` annotations: the `EchosWidget` extension deploys to iOS 16.2,
/// so every symbol here (ActivityKit, Dynamic Island, `Text(timerInterval:)`)
/// is unconditionally available within this target.
struct EchoSessionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EchoSessionAttributes.self) { context in
            // Lock Screen / banner presentation.
            HStack(spacing: 12) {
                Image(systemName: "waveform")
                    .font(.title2)
                    .foregroundStyle(.orange)
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.attributes.title)
                        .font(.headline)
                    Text("Voice typing active")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(timerInterval: echoCountdownRange(to: context.state.endDate), countsDown: true)
                    .monospacedDigit()
                    .font(.title3)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 68)
            }
            .padding()
            .activityBackgroundTint(Color.black.opacity(0.6))
            .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Echos", systemImage: "waveform")
                        .foregroundStyle(.orange)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: echoCountdownRange(to: context.state.endDate), countsDown: true)
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 64)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Tap the mic in any app to dictate")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Image(systemName: "waveform")
                    .foregroundStyle(.orange)
            } compactTrailing: {
                Text(timerInterval: echoCountdownRange(to: context.state.endDate), countsDown: true)
                    .monospacedDigit()
                    .frame(maxWidth: 44)
            } minimal: {
                Image(systemName: "waveform")
                    .foregroundStyle(.orange)
            }
        }
    }
}
