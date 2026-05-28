import Foundation
import QuartzCore

/// Tracks the 1100 ms window LatinIME uses for the smart "type two spaces
/// in a row → swap the trailing space for `. `" gesture. The owning IME
/// is responsible for asking `consumeIfApplicable(...)` on every space
/// keystroke and `consumeBackspaceUndo(...)` on every delete keystroke;
/// this struct owns only the time-window state.
///
/// Timestamps come from `CACurrentMediaTime()` (monotonic seconds since
/// boot) — wall-clock `Date` jumps on NTP / DST / manual changes and
/// would either commit `. ` too aggressively or never at all.
struct DoubleSpacePeriod {

    /// LatinIME's `double_space_period_timeout` (config-common.xml:28).
    static let windowDuration: TimeInterval = 1.1

    /// Bumped whenever the user types a space; the next space within
    /// the window can trigger the smart commit. Cleared whenever the
    /// user types anything else (incl. backspace), the cursor moves,
    /// or the timer elapses.
    private(set) var lastSpaceAt: TimeInterval? = nil

    /// True when the last action committed a `. ` via the smart helper.
    /// The next backspace within the window can revert it back to a
    /// double space.
    private(set) var awaitingBackspaceUndo: Bool = false

    mutating func recordSpaceCommit() {
        lastSpaceAt = CACurrentMediaTime()
        awaitingBackspaceUndo = false
    }

    /// Returns true when the caller should *replace* the previous space
    /// + this space with `. ` (sentence separator + space). The caller
    /// is expected to make that edit; this struct only owns the gating.
    /// `previousChars` are the two chars immediately before the cursor
    /// (caller reads them from the host before deciding to commit a space).
    mutating func shouldCommitPeriod(
        previousChars: [Character],
        now: TimeInterval = CACurrentMediaTime()
    ) -> Bool {
        guard let last = lastSpaceAt,
              (now - last) <= Self.windowDuration else {
            return false
        }
        // Must look like " <X>" where X is letter/digit/allowed-punct.
        guard previousChars.count >= 2,
              previousChars[previousChars.count - 1] == " " else {
            return false
        }
        let charBeforeSpace = previousChars[previousChars.count - 2]
        return SpacingAndPunctuations.allowsDoubleSpacePeriod(after: charBeforeSpace)
    }

    /// Marks that we just committed `. ` — the next backspace within
    /// the window can undo it.
    mutating func markPeriodCommitted() {
        awaitingBackspaceUndo = true
        // The trailing space resets the "single space" window so a
        // third space doesn't immediately trigger another swap.
        lastSpaceAt = nil
    }

    /// Caller asks this on every backspace press. Returns true when the
    /// caller should replace the prior `. ` with `  ` (two spaces).
    mutating func shouldUndoPeriod() -> Bool {
        let undo = awaitingBackspaceUndo
        awaitingBackspaceUndo = false
        return undo
    }

    /// Any keystroke other than space / backspace, or any cursor move,
    /// invalidates the window.
    mutating func reset() {
        lastSpaceAt = nil
        awaitingBackspaceUndo = false
    }
}
