import SwiftUI
import WidgetKit

/// Entry point for the `EchosWidget` extension. The bundle currently hosts only
/// the voice-session Live Activity; home-screen widgets can be added here later.
@main
struct EchosWidgetBundle: WidgetBundle {
    var body: some Widget {
        EchoSessionLiveActivity()
    }
}
