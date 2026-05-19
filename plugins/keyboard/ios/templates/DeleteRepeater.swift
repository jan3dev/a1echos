import Foundation

// Hold-to-repeat delete cadence — native iOS: char-rate after a 0.4s hold,
// escalating to word-rate past ~1.5s. Caller owns touch arbitration and
// suppresses the trailing tap on release when `didRepeat` is true.
final class DeleteRepeater {
    static let initialDelay: TimeInterval = 0.4
    static let charInterval: TimeInterval = 0.08
    static let wordThreshold: TimeInterval = 1.5
    static let wordInterval: TimeInterval = 0.2

    var onCharRepeat: (() -> Void)?
    var onWordRepeat: (() -> Void)?

    private(set) var didRepeat = false

    private var timer: Timer?
    private var holdStart: Date?

    func start() {
        didRepeat = false
        holdStart = Date()
        timer?.invalidate()
        timer = Timer.scheduledTimer(
            withTimeInterval: Self.initialDelay, repeats: false
        ) { [weak self] _ in
            self?.fire()
            self?.scheduleCharRepeat()
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        holdStart = nil
        didRepeat = false
    }

    private func scheduleCharRepeat() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(
            withTimeInterval: Self.charInterval, repeats: true
        ) { [weak self] _ in self?.fire() }
    }

    private func fire() {
        didRepeat = true
        let elapsed = Date().timeIntervalSince(holdStart ?? Date())
        if elapsed > Self.wordThreshold {
            if timer?.timeInterval != Self.wordInterval {
                timer?.invalidate()
                timer = Timer.scheduledTimer(
                    withTimeInterval: Self.wordInterval, repeats: true
                ) { [weak self] _ in self?.fire() }
            }
            onWordRepeat?()
        } else {
            onCharRepeat?()
        }
    }
}
