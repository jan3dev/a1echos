import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

/// The Echos brand mark (three broadcast arcs) drawn as a vector so the Live
/// Activity never depends on an asset catalog being compiled into / loadable
/// from the widget extension bundle — the most reliable way to show a custom
/// logo in a Live Activity. Path coordinates are taken verbatim from
/// `assets/icons/echos_logo.svg` (the mark occupies an 18×24 box; SVG and
/// SwiftUI share a y-down coordinate space, so no flip is needed).
struct EchosLogoMark: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 18.0
        let sy = rect.height / 24.0
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy)
        }

        var path = Path()

        // Largest (outer) arc.
        path.move(to: p(11.2324, 0.2461))
        path.addCurve(to: p(11.6494, 0.0703),
                      control1: p(11.2325, 0.0286), control2: p(11.4935, -0.0814))
        path.addLine(to: p(11.8398, 0.2559))
        path.addCurve(to: p(11.6396, 23.9336),
                      control1: p(18.5269, 6.7660), control2: p(18.4360, 17.5376))
        path.addCurve(to: p(11.2324, 23.7578),
                      control1: p(11.4852, 24.0786), control2: p(11.2328, 23.9697))
        path.addLine(to: p(11.2324, 0.2461))
        path.closeSubpath()

        // Middle arc.
        path.move(to: p(5.1260, 2.8125))
        path.addCurve(to: p(5.5273, 2.6289),
                      control1: p(5.1260, 2.6045), control2: p(5.3698, 2.4931))
        path.addLine(to: p(5.6748, 2.7549))
        path.addCurve(to: p(5.5195, 21.4180),
                      control1: p(11.3969, 7.6892), control2: p(11.3234, 16.5801))
        path.addCurve(to: p(5.1260, 21.2334),
                      control1: p(5.3634, 21.5479), control2: p(5.1263, 21.4364))
        path.addLine(to: p(5.1260, 2.8125))
        path.closeSubpath()

        // Small (inner) arc.
        path.move(to: p(0.1299, 7.2793))
        path.addCurve(to: p(0.1289, 17.0996),
                      control1: p(5.0042, 8.7488), control2: p(5.0163, 15.6749))
        path.addCurve(to: p(0.0, 17.0039),
                      control1: p(0.0650, 17.1182), control2: p(0.0005, 17.0703))
        path.addLine(to: p(0.0, 7.3760))
        path.addCurve(to: p(0.1299, 7.2793),
                      control1: p(0.0, 7.3086), control2: p(0.0654, 7.2600))
        path.closeSubpath()

        return path
    }
}

/// Lock Screen + Dynamic Island presentation for an active Echos voice-typing
/// session. Shows the Echos logo and a "switch off" button (iOS 17+); the
/// session length is conveyed by the system `staleDate`, not a visible
/// countdown.
///
/// No `@available` annotations on the widget itself: the `EchosWidget` extension
/// deploys to iOS 16.2, so ActivityKit / Dynamic Island are unconditionally
/// available. The interactive off button uses `LiveActivityIntent`, which is
/// iOS 17+, so it's gated inline.
struct EchoSessionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EchoSessionAttributes.self) { context in
            // Lock Screen / banner presentation.
            HStack(spacing: 12) {
                logo(width: 21, height: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.attributes.title)
                        .font(.headline)
                    Text("Voice typing active")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                offButton
            }
            .padding()
            .activityBackgroundTint(Color.black.opacity(0.6))
            .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text("Echos")
                    } icon: {
                        logo(width: 15, height: 20)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    offButton
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Tap the mic in any app to dictate")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                logo(width: 14, height: 18)
            } compactTrailing: {
                EmptyView()
            } minimal: {
                logo(width: 14, height: 18)
            }
        }
    }

    private func logo(width: CGFloat, height: CGFloat) -> some View {
        EchosLogoMark()
            .fill(.white)
            .frame(width: width, height: height)
    }

    /// Interactive button that ends the session. Only on iOS 17+, where
    /// `Button(intent:)` is supported inside a Live Activity.
    @ViewBuilder
    private var offButton: some View {
        if #available(iOS 17.0, *) {
            Button(intent: EndEchoSessionIntent()) {
                Image(systemName: "xmark")
                    .font(.headline)
            }
            .buttonStyle(.plain)
            .tint(.white)
            .accessibilityLabel("End voice session")
        }
    }
}
