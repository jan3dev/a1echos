import QuartzCore
import UIKit

/// Delegate protocol for keyboard actions.
protocol KeyboardViewDelegate: AnyObject {
    /// A character was committed. `normalizedTouch`, when non-nil, is the tap
    /// location in key-grid units (see `KeyAdjacency.center`) for the spatial
    /// correction model; nil for non-letter or synthetic commits (emoji,
    /// variants popup, shifted symbols).
    func keyboardView(
        _ view: KeyboardView, didTapCharacter char: String, at normalizedTouch: CGPoint?
    )
    func keyboardViewDidTapDelete(_ view: KeyboardView)
    /// Fired by the delete key's hold-to-repeat timer once the user has held
    /// past the word-deletion threshold (matches native iOS behaviour where
    /// long holds escalate from per-character to per-word deletion).
    func keyboardViewDidHoldDeleteWord(_ view: KeyboardView)
    func keyboardViewDidTapSpace(_ view: KeyboardView)
    func keyboardViewDidTapReturn(_ view: KeyboardView)
    func keyboardViewDidTapGlobe(_ view: KeyboardView)
    /// Tapped shift. Return true if the tap was consumed (e.g. recapitalizing
    /// a text selection) so the view skips its normal shift-state cycle.
    func keyboardViewDidTapShift(_ view: KeyboardView) -> Bool
    /// Spacebar cursor-drag: move the caret by `offset` characters (negative
    /// = left). §5.1.
    func keyboardView(_ view: KeyboardView, moveCursorBy offset: Int)
    /// Spacebar cursor-drag vertical: move the caret up (`lines` negative) or
    /// down (`lines` positive) between newline-delimited lines. §5.1.
    func keyboardView(_ view: KeyboardView, moveCursorVerticallyBy lines: Int)
    /// Long-press on the emoji key (iOS-only path to the system keyboard
    /// picker now that the dedicated globe key is gone).
    func keyboardView(_ view: KeyboardView, didLongPressEmojiFrom sourceView: UIView)
    func keyboardViewDidToggleRecord(_ view: KeyboardView)
    /// A suggestion slot was tapped in the top-bar strip (§5.5); the
    /// controller replaces the in-progress word (or keeps it, for the
    /// verbatim slot).
    func keyboardView(_ view: KeyboardView, didSelectSuggestion slot: SuggestionSlot)
}

/// Mic button states.
enum MicState {
    case idle
    case recording
    case transcribing
}

/// Main keyboard view. Inherits from `UIInputView` with `.keyboard` style so
/// iOS renders the native translucent blur backdrop that the stock keyboard
/// uses (requires the extension's `RequestsOpenAccess` to be true, which is
/// already set in the Info.plist written by this plugin).
class KeyboardView: UIInputView {

    weak var delegate: KeyboardViewDelegate?
    var heightConstraint: NSLayoutConstraint?

    /// Fires whenever `currentLayout` switches — used by
    /// `EchosKeyboardViewController` to re-evaluate the keyboard height
    /// constraint so the emoji modes get the extra vertical room they need
    /// for 4 native-sized emoji rows without making the QWERTY mode oversized.
    var onLayoutModeChange: ((KeyboardLayout.LayoutMode) -> Void)?

    // Inferred from verticalSizeClass rather than bounds.width > bounds.height
    // — the keyboard area is wider than tall in portrait too, so the bounds
    // check misclassifies portrait modes whose chrome makes them taller.
    private var isPhoneLandscape: Bool {
        traitCollection.verticalSizeClass == .compact
    }

    var preferredHeight: CGFloat {
        let isLandscape = isPhoneLandscape
        let rowsHeight: CGFloat
        switch currentLayout {
        case .emoji, .emojiSearch:
            // The picker occupies `rowsHeight − 4 (top band) − 2 (bottom
            // margin)`. Portrait keeps its 4×52pt grid; landscape is taller
            // (242) so its 3-row grid gets ~44pt cells — big enough for the
            // larger emoji glyph without tightening the gaps between them.
            rowsHeight = isLandscape ? 252 : 319
        case .numberPad, .decimalPad:
            // Top bar is hidden on numeric pads — return the rows-only budget
            // (4 pt top band + rowStack height + 2 pt bottom margin).
            return isLandscape ? 140 : 214
        default:
            // Budget = 8 pt top band (rowStackTopFromTopBar, gives the top-row
            // key-preview balloon headroom) + the fixed rowStack height + the
            // bottom margin. Portrait uses a slim 2 pt margin; landscape uses
            // 4 pt so the keys sit a touch higher off the screen edge.
            rowsHeight = isLandscape ? 146 : 218
        }
        return rowsHeight + KeyboardTopBar.preferredHeight
    }

    private let theme = KeyboardTheme()
    private let topBar = KeyboardTopBar()
    private let keyPreview = KeyPreviewView()
    private let keyVariants = KeyVariantsView()
    // The emoji grid's balloon — same shape as the QWERTY one but with a
    // drop shadow (the picker backdrop has no key seams to anchor it) and a
    // larger glyph cap so the emoji reads bigger than its 39pt grid cell.
    private let emojiPreview = KeyPreviewView(
        showsShadow: true, maxLabelFontSize: 44, glyphHeightRatio: 0.78,
        maxHeadHeight: nil, neckHeight: 22
    )
    // Sticky skin-tone popover; non-nil only while presented.
    private var skinTonePopup: SkinToneVariantsView?
    private let toast = KeyboardToastView()
    private var rowStackView: UIStackView!
    private var emojiPickerView: EmojiPickerView?
    private var searchOverlay: EmojiSearchOverlayView?

    private var rowStackTopFromTopBar: NSLayoutConstraint!
    // Pinned under the search overlay that replaces the topBar in .emojiSearch.
    private var rowStackTopFromSearchOverlay: NSLayoutConstraint?
    // Pins the rowStack to the keyboard's top edge directly, used by the
    // numeric pads where the top bar is hidden (§9.1) so the pad doesn't sit
    // below an empty 56pt band.
    private var rowStackTopFromContainer: NSLayoutConstraint?
    // Pins the rowStack to the QWERTY-equivalent height regardless of mode
    // so swapping into/out of search doesn't resize the keys.
    private var rowStackHeightConstraint: NSLayoutConstraint!

    /// Height the rowStack should occupy in any QWERTY-style mode.
    /// Portrait: 208 pt = 4 rows × ~43.75 pt + 3 × 11 pt spacing.
    /// Landscape: 134 pt = 4 rows × ~26.75 pt + 3 × 9 pt spacing.
    /// Portrait keys run 2 pt taller than the earlier 41.75 to match stock
    /// iOS; landscape keys are shorter still (26.75) — they read too tall
    /// otherwise. The 9 pt inter-row gap is unchanged.
    private var qwertyRowStackHeight: CGFloat {
        isPhoneLandscape ? 134 : 208
    }

    private var rowStackInterRowSpacing: CGFloat {
        switch currentLayout {
        case .numberPad, .decimalPad:
            // Match the 6 pt horizontal inter-key gap so the pad reads as a
            // uniform mesh; the keys grow taller to absorb the tighter spacing.
            return 6
        default:
            return isPhoneLandscape ? 9 : 11
        }
    }

    private lazy var emojiSearchIndex = EmojiSearchIndex()
    private var emojiSearchQuery: String = ""
    private var keyButtons: [[KeyButton]] = []
    private var currentLayout: KeyboardLayout.LayoutMode = .letters
    private var shiftState: KeyboardLayout.ShiftState = .off
    private var micState: MicState = .idle
    private var returnKeyType: UIReturnKeyType = .default
    private var toastHideTimer: Timer?

    // Double-tap-shift → caps lock. LatinIME matches the system
    // `getDoubleTapTimeout()` (≈300 ms); we use the same value.
    // Stored as `CACurrentMediaTime()` (monotonic seconds since boot) —
    // wall-clock `Date` jumps on NTP / DST / manual changes and would
    // break the window check.
    private static let shiftDoubleTapWindow: TimeInterval = 0.3
    private var lastShiftTapAt: TimeInterval? = nil
    // Long-press shift → caps lock fires at 1200 ms in LatinIME.
    private static let shiftLongPressDuration: TimeInterval = 1.2

    // §4.9 symbols auto-return — set when the user types a non-space
    // symbol from the numbers / #+= layout, consumed on the next space
    // or enter to flip back to letters. Reset on any manual layout swap.
    private var typedNonSpaceInSymbols: Bool = false

    // Per-pointer state — without it, a second finger landing while the
    // first is still down races into touchUpOutside and gets dropped (the
    // key-skipping users see when typing fast).
    private final class PointerState {
        var button: KeyButton
        var lastLocation: CGPoint
        var longPressTimer: Timer?
        var longPressFired: Bool = false
        var ownsVariants: Bool = false
        var ownsDeleteRepeat: Bool = false
        // Spacebar cursor-drag (§5.1): set once the hold timer promotes the
        // space press into cursor mode. `cursorLastStepX` tracks the x at
        // which the last ±1 caret step fired.
        var cursorModeActive: Bool = false
        var cursorLastStepX: CGFloat = 0
        var cursorLastStepY: CGFloat = 0
        init(button: KeyButton, location: CGPoint) {
            self.button = button
            self.lastLocation = location
        }
    }
    private var pointers: [ObjectIdentifier: PointerState] = [:]

    // Cached hit tiles, one per key and parallel to `keyFramesFlat`. Re-hit-
    // testing every finger on every move via UIView.convert would dominate the
    // touch pipeline. Unlike the drawn key rects, these tiles cover the whole
    // keyboard body edge to edge — each absorbs its share of the inter-key
    // gaps, the outer margins, and the bands above the top row / below the
    // bottom row (§1.4), with the inter-row split biased toward the lower row
    // (§1.5). So every touch on the body resolves to exactly one key with no
    // gap or edge dead zones. `hitTestKeyButton` additionally falls back to the
    // nearest key for any in-body point the cache happens to miss (stale/empty
    // cache), so a tap on the body is never silently dropped.
    private var keyFrames: [CGRect] = []
    private var keyFramesFlat: [KeyButton] = []
    private var keyFramesValid: Bool = false

    // Delete-repeat is owned by whichever pointer first lands on delete;
    // a second finger on delete commits a single tap on its own release.
    private let deleteRepeater = DeleteRepeater()
    // Accent / emoji long-press fires at 300 ms to match LatinIME's default;
    // the shift → caps-lock long-press is separate (`shiftLongPressDuration`).
    private static let longPressDuration: TimeInterval = 0.3

    // Brief hide-delay so the preview balloon retargets to a new finger
    // landing in the interim instead of flickering off and back on. 70 ms
    // matches LatinIME's key-preview linger.
    private static let previewHideDelay: TimeInterval = 0.07
    private var previewHideTimer: Timer?

    // Spacebar cursor-drag (§5.1, iOS convention). Hold space this long to
    // enter cursor mode; thereafter every this-many points of horizontal
    // travel nudges the caret by one character.
    private static let spaceCursorHoldDelay: TimeInterval = 0.3
    private static let cursorStepDistance: CGFloat = 10.0
    // Vertical travel per caret line-step — roughly one key-row tall.
    private static let cursorRowStepDistance: CGFloat = 18.0

    init() {
        super.init(frame: .zero, inputViewStyle: .keyboard)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    private func setupView() {
        // A custom keyboard's touch region is built by the host from the
        // extension's *rendered, non-transparent* content — NOT from
        // `hitTest`/`point(inside:)`. With a fully `.clear` background only the
        // opaque keys land in that region, so taps in the inter-key gaps,
        // margins, and the band below the rows fall straight through to the
        // host app and never reach `touchesBegan` (Apple DTS forum 702798).
        // A near-transparent (non-`clear`) fill puts the whole keyboard body
        // in the region while staying visually clear over the system blur; the
        // empty `draw(_:)` override below stops UIKit from optimizing the
        // near-transparent fill (and the touch region with it) back out.
        //
        // The tint matches the system keyboard blur's resolved tone per
        // appearance, so this 2%-alpha fill shifts the blur toward the colour
        // it already is (≈ no visible change) — a black fill instead darkened
        // the whole keyboard a hair below the surrounding safe-area blur.
        backgroundColor = UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(white: 0.17, alpha: 0.02)
                : UIColor(white: 0.82, alpha: 0.02)
        }
        allowsSelfSizing = true

        // CRITICAL: UIView ships with `isMultipleTouchEnabled = false`, which
        // makes UIKit deliver exactly one touch to this view at a time. With
        // the parent-level pipeline below that's the difference between
        // "second finger lands and types" and "second finger is silently
        // dropped" — the dominant cause of perceived key-skipping on iOS.
        isMultipleTouchEnabled = true

        // The press balloon for top-row keys extends above the QWERTY area
        // and overlaps the top bar — matches native iPhone behavior. Clip
        // off and the balloon would render with a shorter head on row 1.
        clipsToBounds = false

        topBar.delegate = self
        addSubview(topBar)

        rowStackView = UIStackView()
        rowStackView.axis = .vertical
        rowStackView.distribution = .fillEqually
        rowStackView.spacing = 11
        rowStackView.translatesAutoresizingMaskIntoConstraints = false

        addSubview(rowStackView)
        // Added before the popups so accent/typewriter popovers render above it.
        toast.translatesAutoresizingMaskIntoConstraints = false
        toast.isHidden = true
        addSubview(toast)
        // Both popups sit above all other subviews. Variants is added last
        // so the accent popover renders above the typewriter balloon — in
        // practice only one is visible at a time.
        addSubview(keyPreview)
        addSubview(keyVariants)
        rowStackTopFromTopBar = rowStackView.topAnchor.constraint(
            equalTo: topBar.bottomAnchor, constant: 8
        )
        rowStackTopFromContainer = rowStackView.topAnchor.constraint(
            equalTo: topAnchor, constant: 4
        )
        rowStackHeightConstraint = rowStackView.heightAnchor.constraint(
            equalToConstant: qwertyRowStackHeight
        )
        // Required: the rows' size is the user-visible invariant. The
        // bottom anchor below has its priority lowered to .defaultHigh-1
        // so if iOS forces a slightly different total keyboard height
        // the slack lands as a bottom margin instead of resizing keys.
        rowStackHeightConstraint.priority = .required
        let rowStackBottom = rowStackView.bottomAnchor.constraint(
            equalTo: bottomAnchor, constant: -2
        )
        rowStackBottom.priority = .defaultHigh - 1
        NSLayoutConstraint.activate([
            topBar.leadingAnchor.constraint(equalTo: leadingAnchor),
            topBar.trailingAnchor.constraint(equalTo: trailingAnchor),
            topBar.topAnchor.constraint(equalTo: topAnchor),
            topBar.heightAnchor.constraint(equalToConstant: KeyboardTopBar.preferredHeight),

            rowStackView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 7),
            rowStackView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -7),
            rowStackTopFromTopBar,
            rowStackBottom,
            rowStackHeightConstraint,

            // Toast band sits near the bottom of the keyboard, centered. The
            // inner pill self-centers within this full-width band, so an error
            // floats over the lower key rows (briefly) instead of covering the
            // top bar's record button. Auto-hides, and is non-interactive so
            // taps still reach the keys underneath.
            toast.leadingAnchor.constraint(equalTo: leadingAnchor),
            toast.trailingAnchor.constraint(equalTo: trailingAnchor),
            toast.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -10),
            toast.heightAnchor.constraint(equalToConstant: 40),
        ])

        buildLayout()
    }

    // MARK: - Layout Building

    private func buildLayout() {
        // Mode-switch can rebuild the layout mid-roll (e.g. one finger taps
        // `123` while another is still pressing a letter). Tear down any
        // active pointer state first so we don't leave a `PointerState`
        // pointing at a button that's about to be removed from the hierarchy.
        cancelAllActivePointers()

        // Remove existing rows
        for view in rowStackView.arrangedSubviews {
            rowStackView.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        keyButtons.removeAll()

        // Search overlay anchors below the topBar so the search field
        // lines up with the picker's search field instead of jumping up.
        // Numeric pads (§9.1) drop the top bar entirely and pin the rows to
        // the container's top edge so there's no empty band above the pad.
        let isSearchMode = currentLayout == .emojiSearch
        let isNumericPad = currentLayout == .numberPad || currentLayout == .decimalPad
        topBar.isHidden = isNumericPad
        // Exactly one of the three top-pin constraints is active at a time.
        rowStackTopFromTopBar.isActive = false
        rowStackTopFromSearchOverlay?.isActive = false
        rowStackTopFromContainer?.isActive = false
        if isNumericPad {
            searchOverlay?.isHidden = true
            rowStackTopFromContainer?.isActive = true
        } else if isSearchMode {
            installSearchOverlayIfNeeded()
            searchOverlay?.isHidden = false
            rowStackTopFromSearchOverlay?.isActive = true
        } else {
            searchOverlay?.isHidden = true
            rowStackTopFromTopBar.isActive = true
        }

        if currentLayout == .emoji {
            rowStackView.isHidden = true
            installEmojiPickerIfNeeded()
            emojiPickerView?.isHidden = false
            emojiPickerView?.refreshRecents()
            return
        }

        emojiPickerView?.isHidden = true
        rowStackView.isHidden = false

        let rows = KeyboardLayout.rows(for: currentLayout)

        for row in rows {
            let rowView = UIStackView()
            rowView.axis = .horizontal
            rowView.distribution = .fill
            rowView.spacing = 6
            rowView.alignment = .fill

            var rowButtons: [KeyButton] = []
            // Track every arranged view + its widthWeight so we can pin
            // spacers (invisible) to the same reference-key width that
            // letters use. Without this, spacers default to 0-width and
            // the row-2 indent / row-3 shift gaps don't render.
            var weightedViews: [(view: UIView, weight: CGFloat)] = []

            for keyDef in row {
                let effectiveWeight = effectiveWidthWeight(for: keyDef)

                if keyDef.type == .spacer {
                    let spacer = UIView()
                    spacer.translatesAutoresizingMaskIntoConstraints = false
                    spacer.isUserInteractionEnabled = false
                    rowView.addArrangedSubview(spacer)
                    weightedViews.append((spacer, effectiveWeight))
                    continue
                }

                // Passive mode: parent owns touches, KeyButton stays visual-only.
                // The QWERTY rows hand every touch to `KeyboardView`'s
                // `touchesBegan/Moved/Ended/Cancelled` overrides so that
                // multi-finger fast typing actually delivers every key.
                let button = KeyButton(
                    keyDefinition: keyDef,
                    theme: theme,
                    passiveHitTesting: true
                )

                // Set width proportional to weight
                if effectiveWeight != 1.0 {
                    button.widthMultiplier = effectiveWeight
                }

                rowView.addArrangedSubview(button)
                rowButtons.append(button)
                weightedViews.append((button, effectiveWeight))
            }

            // Apply width constraints based on weights (mixed views).
            applyWidthConstraints(views: weightedViews)

            rowStackView.addArrangedSubview(rowView)
            keyButtons.append(rowButtons)
        }

        updateKeyLabels()
        keyFramesValid = false
    }

    // Landscape shrinks shift/delete (1.4 → 1.2) and grows the row-3
    // spacer (0.01 → 0.21) in lockstep so shift+spacer = 1.41K still
    // holds and z stays under s.
    private func effectiveWidthWeight(
        for keyDef: KeyboardLayout.KeyDefinition
    ) -> CGFloat {
        guard isPhoneLandscape else { return keyDef.widthWeight }
        switch keyDef.type {
        case .shift, .delete:
            // Only override the 1.4 default — other widths (e.g. the
            // 1.5 used elsewhere historically) stay as defined.
            return keyDef.widthWeight == 1.4 ? 1.2 : keyDef.widthWeight
        case .spacer:
            // Only override the near-zero row-3 spacers, leaving the
            // larger row-2 indent spacers (0.41) alone.
            return keyDef.widthWeight == 0.01 ? 0.21 : keyDef.widthWeight
        default:
            return keyDef.widthWeight
        }
    }

    /// Pins every weighted view (key buttons + spacers) in a row to the
    /// first 1.0-weight view's width. Spacers piggy-back on the same
    /// reference so row-2 indents and row-3 gaps scale with key width
    /// across device sizes.
    private func applyWidthConstraints(
        views: [(view: UIView, weight: CGFloat)]
    ) {
        guard let referenceIdx = views.firstIndex(where: { $0.weight == 1.0 }) else {
            return
        }
        let reference = views[referenceIdx].view

        for (idx, entry) in views.enumerated() where idx != referenceIdx {
            if entry.weight == 1.0 {
                entry.view.widthAnchor.constraint(equalTo: reference.widthAnchor).isActive = true
            } else {
                entry.view.widthAnchor.constraint(
                    equalTo: reference.widthAnchor,
                    multiplier: entry.weight
                ).isActive = true
            }
        }
    }

    /// Shift-cased label for a character key. Only single-char labels
    /// uppercase — multi-char field-variant keys like ".com" must render and
    /// commit verbatim (not ".COM").
    private func shiftedLabel(_ label: String) -> String {
        shiftState.isShifted && label.count == 1 ? label.uppercased() : label
    }

    private func updateKeyLabels() {
        for row in keyButtons {
            for button in row {
                let def = button.keyDefinition
                switch def.type {
                case .character:
                    button.setDisplayLabel(shiftedLabel(def.label))
                case .returnKey:
                    applyReturnKeyDisplay(to: button)
                    button.setPrimaryAction(returnKeyIsPrimaryAction)
                default:
                    break
                }
                button.updateAppearance(theme: theme, micState: micState, shiftState: shiftState)
            }
        }
    }

    /// Whether the return key should render as the accent-filled "primary
    /// action" pill. True for the emoji-search done affordance and for the
    /// action return types that read as a confirm/submit (go, send, done) or a
    /// search (search / google / yahoo). `.next` and plain `.default` stay
    /// neutral (a regular white key).
    private var returnKeyIsPrimaryAction: Bool {
        if currentLayout == .emojiSearch { return true }
        switch returnKeyType {
        case .go, .send, .done, .search, .google, .yahoo: return true
        default: return false
        }
    }

    /// Applies the per-context SF Symbol to the return key so it matches the
    /// native keyboard. The accent pill itself is applied separately via
    /// `setPrimaryAction` (see `returnKeyIsPrimaryAction`).
    private func applyReturnKeyDisplay(to button: KeyButton) {
        if currentLayout == .emojiSearch {
            button.setDisplaySymbol("checkmark")
            return
        }
        switch returnKeyType {
        case .go: button.setDisplaySymbol("arrow.right")
        case .send: button.setDisplaySymbol("arrow.up")
        case .next: button.setDisplaySymbol("chevron.right")
        case .done: button.setDisplaySymbol("checkmark")
        case .search, .google, .yahoo:
            button.setDisplaySymbol("magnifyingglass")
        default:
            button.setDisplaySymbol("return")
        }
    }

    // MARK: - Public API

    func updateReturnKeyType(_ type: UIReturnKeyType) {
        // textDidChange fires per-keystroke; skip the full-layout label
        // walk when the return type hasn't actually changed.
        guard type != returnKeyType else { return }
        returnKeyType = type
        updateKeyLabels()
    }

    /// Drives the shift state from outside (the IME view controller calls
    /// this from its auto-cap engine on `textDidChange`). A no-op when
    /// the user has manually committed to caps lock — we never override
    /// an explicit lock with an automatic shift.
    func applyAutoShift(_ shouldCapitalize: Bool) {
        switch shiftState {
        case .capsLock, .on, .manualFromAuto:
            // User made an explicit choice — never override with auto.
            return
        case .off, .automatic:
            let next: KeyboardLayout.ShiftState = shouldCapitalize ? .automatic : .off
            guard next != shiftState else { return }
            shiftState = next
            updateKeyLabels()
        }
    }

    /// Clears any in-flight shift double-tap window — called by the IME
    /// when the cursor moves so an unrelated later shift tap doesn't
    /// race the double-tap detector.
    func resetShiftDoubleTap() {
        lastShiftTapAt = nil
    }

    var currentMicState: MicState { micState }

    /// Exposes the live shift state so the controller can case suggestion
    /// candidates to match what a typed character would produce (§5.5).
    var currentShiftState: KeyboardLayout.ShiftState { shiftState }

    /// Exposes the live layout mode so the controller can apply field-type
    /// layouts without yanking the user out of a page they chose manually
    /// (§9.1).
    var currentLayoutMode: KeyboardLayout.LayoutMode { currentLayout }

    /// Shows up to 3 suggestion slots in the top bar (no-op while
    /// recording — `KeyboardTopBar` guards that). An empty list hides the strip.
    func showSuggestions(_ slots: [SuggestionSlot]) {
        topBar.showSuggestions(slots)
    }

    func hideSuggestions() {
        topBar.hideSuggestions()
    }

    func setAudioLevel(_ level: Double) {
        topBar.setAudioLevel(level)
    }

    func setMicState(_ state: MicState) {
        micState = state
        topBar.setMicState(state)
        updateKeyLabels()

        // Announce state change for VoiceOver
        switch state {
        case .recording:
            UIAccessibility.post(notification: .announcement, argument: "Recording")
        case .transcribing:
            UIAccessibility.post(notification: .announcement, argument: "Transcribing")
        case .idle:
            break
        }
    }

    func showMicError(_ message: String) {
        UIAccessibility.post(notification: .announcement, argument: message)
        presentToast(message: message)
    }

    func showOpenAppPrompt(_ message: String) {
        UIAccessibility.post(notification: .announcement, argument: message)
        presentToast(message: message, autoHideAfter: 5.0)
    }

    private func presentToast(
        message: String, autoHideAfter seconds: TimeInterval = 3.0
    ) {
        toastHideTimer?.invalidate()
        toast.setMessage(message)
        // Float above any emoji picker / search overlay installed later in the
        // view stack — those bring only the key popups forward, not the toast.
        bringSubviewToFront(toast)
        if toast.isHidden {
            toast.alpha = 0
            toast.isHidden = false
            UIView.animate(withDuration: 0.18) { self.toast.alpha = 1 }
        }
        toastHideTimer = Timer.scheduledTimer(
            withTimeInterval: seconds, repeats: false
        ) { [weak self] _ in
            self?.dismissToast()
        }
    }

    private func dismissToast() {
        toastHideTimer?.invalidate()
        toastHideTimer = nil
        UIView.animate(
            withDuration: 0.18,
            animations: { self.toast.alpha = 0 },
            completion: { _ in self.toast.isHidden = true }
        )
    }

    func switchToLayout(_ mode: KeyboardLayout.LayoutMode) {
        // No-op on an unchanged mode so callers can fire this on every
        // keystroke (the field-type adaptive layout does — §9.1) without
        // paying a full `buildLayout()` teardown/rebuild each time.
        guard mode != currentLayout else { return }
        currentLayout = mode
        // Drop the symbols-auto-return latch — any explicit swap means
        // the user is choosing their layout, the next space shouldn't
        // also flip them somewhere they don't expect.
        typedNonSpaceInSymbols = false
        buildLayout()
        onLayoutModeChange?(mode)
    }

    // MARK: - Multi-touch pipeline (QWERTY rows)

    /// Treat the whole body as "inside" while the rows are showing — `UIInputView`
    /// otherwise reports `false` for its inter-key/margin gaps. This keeps
    /// in-process hit-testing consistent with the `hitTest` body-claim below.
    /// (The cross-process *touch region* the host uses is fixed separately, by
    /// the near-transparent `backgroundColor` in `setupView` — a `.clear`
    /// background excludes the gaps from that region entirely.)
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        if !rowStackView.isHidden, bounds.contains(point) { return true }
        return super.point(inside: point, with: event)
    }

    /// Intentionally empty. Forcing a `draw(_:)` pass keeps UIKit from
    /// optimizing the near-transparent `backgroundColor` (see `setupView`) out
    /// of the rasterized content, which would shrink the keyboard's touch
    /// region back to just the opaque keys and re-open the dead-zone gaps.
    override func draw(_ rect: CGRect) {}

    /// The multi-touch pipeline must own the entire QWERTY body — keys, the
    /// inter-key/inter-row gaps, the outer margins, and the thin bands above
    /// and below the rows — so the hit-tile lookup (`hitTestKeyButton`) can
    /// run on every touch. We can't just forward `rowStackView`-subtree hits:
    /// `UIInputView`'s `super.hitTest` returns `nil` for the outer padding and
    /// the row/top-bar gaps (it treats them as non-content), which previously
    /// turned those regions into dead zones. So whenever the rows are showing,
    /// claim any in-bounds point for `self` regardless of what `super` returns
    /// — except the top bar (record button) and the popups / emoji overlays,
    /// which own their own touches.
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let target = super.hitTest(point, with: event)
        if let target = target {
            // The skin-tone popover covers the whole keyboard and swallows
            // every touch (it's sticky until a tone is tapped) — it must
            // win before the rows' body-claim below.
            if let popup = skinTonePopup,
               target === popup || target.isDescendant(of: popup) {
                return target
            }
            if target === topBar || target.isDescendant(of: topBar) { return target }
            if !keyVariants.isHidden,
               target === keyVariants || target.isDescendant(of: keyVariants) {
                return target
            }
            if let picker = emojiPickerView, !picker.isHidden,
               target === picker || target.isDescendant(of: picker) {
                return target
            }
            if let overlay = searchOverlay, !overlay.isHidden,
               target === overlay || target.isDescendant(of: overlay) {
                return target
            }
        }
        if !rowStackView.isHidden, bounds.contains(point) { return self }
        return target
    }

    /// Each UITouch in `event` is dispatched independently — this is the iOS
    /// analogue of LatinIME's `MainKeyboardView.processMotionEvent` walking
    /// every pointer in the `MotionEvent`. Skipping any touch here would
    /// reintroduce the "second finger does nothing" bug.
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            handlePointerDown(touch)
        }
        super.touchesBegan(touches, with: event)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            handlePointerMoved(touch)
        }
        super.touchesMoved(touches, with: event)
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            handlePointerUp(touch, cancelled: false)
        }
        super.touchesEnded(touches, with: event)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            handlePointerUp(touch, cancelled: true)
        }
        super.touchesCancelled(touches, with: event)
    }

    private func handlePointerDown(_ touch: UITouch) {
        let location = touch.location(in: self)
        guard let button = hitTestKeyButton(at: location) else { return }

        KeyFeedback.keyTap(for: button.keyDefinition.type)
        button.setPressed(true)

        let state = PointerState(button: button, location: location)
        pointers[ObjectIdentifier(touch)] = state

        switch button.keyDefinition.type {
        case .delete:
            // Only the first pointer on delete owns the auto-repeat. A
            // second finger tapping delete while the first is held commits
            // a single delete on its own release.
            if !anyPointerOwnsDeleteRepeat() {
                state.ownsDeleteRepeat = true
                // Delete the first character on key-down (matches native iOS):
                // the repeat timer only fires its first tick after a 0.4s hold,
                // so without this a press feels dead until the hold kicks in.
                // The owner's release tap is suppressed to avoid a double.
                performDelete()
                startDeleteRepeat()
            }
        case .emoji:
            scheduleLongPress(state: state) { [weak self, weak button] in
                guard let self = self, let button = button else { return }
                state.longPressFired = true
                self.delegate?.keyboardView(self, didLongPressEmojiFrom: button)
            }
            showPreviewIfCharacter(button)
        case .character:
            showPreviewIfCharacter(button)
            if hasLongPressVariants(button.keyDefinition.label),
               !anyPointerOwnsVariants() {
                scheduleVariantsLongPress(state: state)
            }
        case .shift:
            // Long-press shift = caps lock. Matches LatinIME 1200 ms.
            scheduleLongPress(
                state: state, delay: Self.shiftLongPressDuration
            ) { [weak self] in
                guard let self = self else { return }
                state.longPressFired = true
                self.shiftState = .capsLock
                self.lastShiftTapAt = nil
                self.updateKeyLabels()
            }
        case .space:
            // Hold space to enter cursor-drag mode (§5.1). A quick tap never
            // reaches here — the timer is cancelled on release — so normal
            // space and double-space-period are unaffected.
            scheduleLongPress(
                state: state, delay: Self.spaceCursorHoldDelay
            ) { [weak self, weak state] in
                guard let self = self, let state = state else { return }
                state.cursorModeActive = true
                state.cursorLastStepX = state.lastLocation.x
                state.cursorLastStepY = state.lastLocation.y
                self.keyPreview.hide()
                self.setTrackpadBlankOnAllKeys(true)
                HapticManager.keyTap()
            }
        default:
            showPreviewIfCharacter(button)
        }
    }

    private func handlePointerMoved(_ touch: UITouch) {
        guard let state = pointers[ObjectIdentifier(touch)] else { return }
        let location = touch.location(in: self)
        state.lastLocation = location

        // Spacebar cursor-drag mode (§5.1): horizontal travel nudges the
        // caret one character per `cursorStepDistance` points. Takes over the
        // drag entirely — no key re-detection, no space commit on release.
        if state.cursorModeActive {
            let dx = location.x - state.cursorLastStepX
            let step = Self.cursorStepDistance
            if abs(dx) >= step {
                let steps = Int(dx / step)
                delegate?.keyboardView(self, moveCursorBy: steps)
                state.cursorLastStepX += CGFloat(steps) * step
            }
            let dy = location.y - state.cursorLastStepY
            let vStep = Self.cursorRowStepDistance
            if abs(dy) >= vStep {
                let rows = Int(dy / vStep)
                delegate?.keyboardView(self, moveCursorVerticallyBy: rows)
                state.cursorLastStepY += CGFloat(rows) * vStep
            }
            return
        }

        // Variants popover takes over the drag — forward to it for slide-pick.
        if state.ownsVariants {
            keyVariants.updateHighlight(at: location)
            return
        }

        // Delete-repeat keeps running regardless of where the finger drifts —
        // matches Gboard behavior. No re-detection needed.
        if state.ownsDeleteRepeat {
            return
        }

        // Long-press already fired (emoji picker): finger drift is just noise.
        if state.longPressFired { return }

        // The pressed key is sticky: once a touch lands on a key (the
        // nearest-key fallback in `hitTestKeyButton` already makes *landing*
        // forgiving), finger movement does NOT retarget to a neighbour. This
        // matches the native feel — a quick tap that rolls slightly, or a
        // hold-and-wiggle, commits the key you actually pressed instead of
        // ping-ponging to an adjacent letter (which read as wrong/skipped
        // letters while typing fast). Deliberate slides are still handled by
        // the dedicated paths above: spacebar cursor-drag, the accent-variants
        // popover, and delete-repeat. Keeping the variants long-press timer
        // alive here (we no longer cancel it on move) means holding a key and
        // wiggling shows its accent popup rather than changing the key.
    }

    private func handlePointerUp(_ touch: UITouch, cancelled: Bool) {
        guard let state = pointers.removeValue(forKey: ObjectIdentifier(touch))
        else { return }

        state.longPressTimer?.invalidate()
        state.longPressTimer = nil
        state.button.setPressed(false)

        // Hide the preview balloon only when the last finger lifts so other
        // simultaneously-held fingers still get visible feedback. The hide
        // itself is deferred — see `previewHideDelay` — so rapid roll-typing
        // retargets the balloon instead of strobing it off and on.
        if pointers.isEmpty {
            scheduleDeferredPreviewHide()
        }

        if cancelled {
            if state.ownsVariants { keyVariants.hide() }
            if state.ownsDeleteRepeat { stopDeleteRepeat() }
            if state.cursorModeActive { setTrackpadBlankOnAllKeys(false) }
            return
        }

        // Variants popover: only the owning pointer commits its selection.
        if state.ownsVariants {
            let selected = keyVariants.selectedVariant()
            keyVariants.hide()
            if let variant = selected {
                delegate?.keyboardView(self, didTapCharacter: variant, at: nil)
                dropTransientShiftAfterCharacterCommit()
            }
            return
        }

        // The delete owner already deleted on key-down (and possibly repeated
        // while held), so its release never commits another tap.
        if state.ownsDeleteRepeat {
            stopDeleteRepeat()
            return
        }

        // Emoji long-press already opened the keyboard picker; the release
        // shouldn't also open the emoji panel.
        if state.longPressFired { return }

        // Cursor-drag consumed the press — don't insert a space or arm the
        // double-space window.
        if state.cursorModeActive {
            setTrackpadBlankOnAllKeys(false)
            return
        }

        handleKeyAction(
            state.button.keyDefinition,
            normalizedTouch: normalizedTouch(for: state.button, at: state.lastLocation)
        )
    }

    /// Places `location` (self coords) in key-grid units relative to the tapped
    /// key's known grid center, so the spatial model sees where within the key
    /// the finger actually landed. nil for non-letter keys (no grid center).
    private func normalizedTouch(for button: KeyButton, at location: CGPoint) -> CGPoint? {
        guard button.keyDefinition.type == .character else { return nil }
        let label = shiftedLabel(button.keyDefinition.label).lowercased()
        guard label.count == 1,
              let ascii = label.unicodeScalars.first.map({ UInt8($0.value & 0xFF) }),
              let center = KeyAdjacency.center(ascii) else { return nil }
        let frame = button.convert(button.bounds, to: self)
        guard frame.width > 0, frame.height > 0 else { return nil }
        return CGPoint(
            x: CGFloat(center.x) + (location.x - frame.midX) / frame.width,
            y: CGFloat(center.y) + (location.y - frame.midY) / frame.height
        )
    }

    // The key whose hit tile contains `point`. The tiles cover the keyboard
    // body with no gaps (see `rebuildKeyFrames`), so any touch on the body —
    // the ~6 pt inter-key gaps (§1.1/§1.3), the outer side margins, and the
    // bands just above the top row / just below the space row (§1.4) — lands
    // on exactly one key. If the cache is momentarily empty/stale/partial (the
    // first-touch zero-width-bounds window, an orientation/layout transition,
    // or a build that dropped a key), the tile loop can miss; a nearest-key
    // fallback then guarantees any in-body tap still resolves to a key, just
    // like the native keyboard. A point off the body (e.g. a drag that wanders
    // up into the top bar) is gated out so it returns nil, which keeps a drag
    // on its current key instead of snapping to a far edge key.
    private func hitTestKeyButton(at point: CGPoint) -> KeyButton? {
        if !keyFramesValid {
            // Flush any pending Auto Layout first — on the first touch after a
            // layout invalidation the buttons can still report zero-width
            // bounds, which would drop them from the cache below.
            layoutIfNeeded()
            rebuildKeyFrames()
        }
        for (idx, frame) in keyFrames.enumerated() where frame.contains(point) {
            return weightedKeyButton(at: point, winnerIdx: idx)
        }
        // Nearest-key fallback: any tap on the keyboard body must resolve to a
        // key (native iOS), even when the tile cache didn't cover this point.
        // Gated on the body — the same test `hitTest` uses to claim touches —
        // so an off-body point still returns nil and `handlePointerMoved`
        // keeps the finger on its current key.
        guard !rowStackView.isHidden, bounds.contains(point) else { return nil }
        return nearestKeyButton(to: point)
    }

    // MARK: - Invisible key-target resizing

    /// Per-letter next-key weights in (0, 1], pushed by the controller after
    /// every text change (`CorrectionEngine.nextCharWeights`). Empty map =
    /// resizing off; hit geometry is exactly the tiles.
    private var keyTargetWeights: [UInt8: Float] = [:]

    /// Widest contested strip along a shared tile edge, as a fraction of the
    /// winner's visible key dimension, reached only at weight delta 1.0.
    private static let maxTargetShiftFraction: CGFloat = 0.25

    /// Tile edges are computed, not authored — allow sub-point float drift
    /// when matching shared edges (mirrors EchosKeyboardView.kt).
    private static let edgeTolerance: CGFloat = 0.5

    func setKeyTargetWeights(_ weights: [UInt8: Float]) {
        keyTargetWeights = weights
    }

    /// The next-key weight for a single-letter character key; nil for every
    /// other key (only letter keys trade hit area — space/shift/delete/return
    /// never grow and are never stolen from).
    private func letterWeight(_ button: KeyButton) -> Float? {
        guard button.keyDefinition.type == .character else { return nil }
        let label = button.keyDefinition.label.lowercased()
        guard label.count == 1,
              let scalar = label.unicodeScalars.first,
              scalar.value >= UInt8(ascii: "a"), scalar.value <= UInt8(ascii: "z")
        else { return nil }
        return keyTargetWeights[UInt8(scalar.value)] ?? 0
    }

    /// The coordinate of the tile edge `neighbor` shares with `tile` along the
    /// given axis, or nil when the two tiles do not abut on it. Tiles tile the
    /// keyboard exactly, so a shared edge means one's far side meets the
    /// other's near side within `edgeTolerance`.
    private static func sharedEdge(
        near: CGFloat, far: CGFloat, neighborNear: CGFloat, neighborFar: CGFloat
    ) -> CGFloat? {
        if abs(neighborFar - near) < edgeTolerance { return near }
        if abs(neighborNear - far) < edgeTolerance { return far }
        return nil
    }

    /// Invisible key-target resizing (Apple's pre-iOS-17 keyboard, patent
    /// US8232973): the tile boundary between two letter keys effectively
    /// shifts toward the less likely one. When the touch lands inside the
    /// winner's tile but within the contested strip along an edge shared with
    /// a likelier letter key, that key claims the touch. The strip width is
    /// `maxTargetShiftFraction` of the winner's visible dimension scaled by
    /// the weight difference, so a tap near a key's center is never stolen
    /// and the raw touch point (which the spatial decoder buffers) is
    /// unaffected — only the resolved key changes.
    private func weightedKeyButton(at point: CGPoint, winnerIdx: Int) -> KeyButton {
        let winner = keyFramesFlat[winnerIdx]
        guard !keyTargetWeights.isEmpty,
              let winnerWeight = letterWeight(winner) else { return winner }
        let tile = keyFrames[winnerIdx]
        let visible = winner.convert(winner.bounds, to: self)
        var best: KeyButton?
        var bestScore: CGFloat = 0
        for (idx, neighborTile) in keyFrames.enumerated() where idx != winnerIdx {
            let candidate = keyFramesFlat[idx]
            guard let candidateWeight = letterWeight(candidate),
                  candidateWeight > winnerWeight else { continue }
            let distToEdge: CGFloat?
            let span: CGFloat
            if let edgeX = Self.sharedEdge(
                near: tile.minX, far: tile.maxX,
                neighborNear: neighborTile.minX, neighborFar: neighborTile.maxX
            ), point.y >= max(tile.minY, neighborTile.minY),
               point.y <= min(tile.maxY, neighborTile.maxY) {
                distToEdge = abs(point.x - edgeX)
                span = visible.width
            } else if let edgeY = Self.sharedEdge(
                near: tile.minY, far: tile.maxY,
                neighborNear: neighborTile.minY, neighborFar: neighborTile.maxY
            ), point.x >= max(tile.minX, neighborTile.minX),
               point.x <= min(tile.maxX, neighborTile.maxX) {
                distToEdge = abs(point.y - edgeY)
                span = visible.height
            } else {
                continue
            }
            guard let dist = distToEdge else { continue }
            // `score > bestScore` (starting at 0) already implies dist < shift.
            let score = Self.maxTargetShiftFraction * span
                * CGFloat(candidateWeight - winnerWeight) - dist
            if score > bestScore {
                bestScore = score
                best = candidate
            }
        }
        return best ?? winner
    }

    /// Squared distance from `point` to the nearest edge of `rect` (0 when the
    /// point is inside). Mirrors `KeyVariantsView.nearestCellIndex`. Squared to
    /// avoid the `sqrt` — only relative ordering matters.
    private func squaredDistance(from point: CGPoint, to rect: CGRect) -> CGFloat {
        let dx = max(rect.minX - point.x, max(0, point.x - rect.maxX))
        let dy = max(rect.minY - point.y, max(0, point.y - rect.maxY))
        return dx * dx + dy * dy
    }

    /// The key whose *visible* frame is nearest `point`. Walks the live buttons
    /// rather than the tile cache so it still works when the cache is empty or
    /// partial — that's the whole point of the fallback in `hitTestKeyButton`.
    private func nearestKeyButton(to point: CGPoint) -> KeyButton? {
        var best: KeyButton?
        var bestDistSq = CGFloat.infinity
        for row in keyButtons {
            for button in row where button.window != nil && button.bounds.width > 0 {
                let frame = button.convert(button.bounds, to: self)
                let d = squaredDistance(from: point, to: frame)
                if d < bestDistSq {
                    bestDistSq = d
                    best = button
                }
            }
        }
        return best
    }

    /// Per-row sweet-spot Y bias (§1.5): a downward offset, in points, for the
    /// lower letter rows. Folded into the inter-row tile split in
    /// `rebuildKeyFrames` so the gap above a lower row is mostly claimed by
    /// that row — people systematically land a touch high on the bottom rows,
    /// so an ambiguous inter-row tap should resolve *down*, not snap up.
    /// Fractions of row height mirror LatinIME's touch-position correction
    /// (top ≈ 0, mid 0.038, bottom 0.088), indexed by QWERTY letter row.
    private func rowYBias(forRow rowIdx: Int, rowHeight: CGFloat) -> CGFloat {
        switch rowIdx {
        case 1: return 0.038 * rowHeight
        case 2: return 0.088 * rowHeight
        default: return 0
        }
    }

    /// Rebuilds the hit-tile cache (`keyFrames`, parallel to `keyFramesFlat`).
    /// Each key's tile, with its row and column neighbours, tiles the keyboard
    /// body edge to edge — the drawn key rects are untouched, only the hit
    /// geometry grows:
    ///   • columns split at the inter-key gap midpoint; the first / last key in
    ///     a row run out to the keyboard's side edges (§1.4 left/right),
    ///   • rows split at the inter-row gap midpoint pulled up by the averaged
    ///     sweet-spot bias so the lower row claims most of the gap (§1.5); the
    ///     top row runs up to the top bar's lower edge (§1.4 top) and the
    ///     bottom row down to the keyboard's bottom (§1.4 bottom, iOS).
    private func rebuildKeyFrames() {
        keyFrames.removeAll(keepingCapacity: true)
        keyFramesFlat.removeAll(keepingCapacity: true)

        // Snapshot each non-empty row's visible keys with their on-screen
        // frames; the tiling needs each key's neighbours and the adjacent
        // rows' bands. The original row index rides along so the sweet-spot
        // bias keys off the QWERTY row, not a post-filter position.
        var rows: [(rowIdx: Int, keys: [(button: KeyButton, frame: CGRect)])] = []
        for (rowIdx, row) in keyButtons.enumerated() {
            let keys = row
                .filter { $0.window != nil && $0.bounds.width > 0 }
                .map { (button: $0, frame: $0.convert($0.bounds, to: self)) }
            if !keys.isEmpty { rows.append((rowIdx: rowIdx, keys: keys)) }
        }
        guard !rows.isEmpty else {
            keyFramesValid = false
            return
        }

        let viewWidth = bounds.width
        let viewMaxY = bounds.maxY
        // Top row reaches up to the top bar's lower edge — never into the bar
        // (it owns the record button); the full top edge when the bar is hidden.
        let topEdgeY = topBar.isHidden ? 0 : topBar.frame.maxY

        // Shared vertical edge of row `i` (above) and row `i + 1` (below): the
        // inter-row gap midpoint pulled up by the averaged sweet-spot bias.
        func interRowSplit(_ i: Int) -> CGFloat {
            let upper = rows[i].keys[0].frame
            let lower = rows[i + 1].keys[0].frame
            let midpoint = (upper.maxY + lower.minY) / 2
            let bias = (rowYBias(forRow: rows[i].rowIdx, rowHeight: upper.height)
                + rowYBias(forRow: rows[i + 1].rowIdx, rowHeight: lower.height)) / 2
            return midpoint - bias
        }

        for (i, row) in rows.enumerated() {
            let bandTop = i == 0
                ? min(row.keys[0].frame.minY, topEdgeY)
                : interRowSplit(i - 1)
            let bandBottom = i == rows.count - 1
                ? max(row.keys[0].frame.maxY, viewMaxY)
                : interRowSplit(i)
            let lastCol = row.keys.count - 1
            for (col, key) in row.keys.enumerated() {
                let left: CGFloat = col == 0
                    ? 0
                    : (row.keys[col - 1].frame.maxX + key.frame.minX) / 2
                let right: CGFloat = col == lastCol
                    ? max(viewWidth, key.frame.maxX)
                    : (key.frame.maxX + row.keys[col + 1].frame.minX) / 2
                keyFrames.append(CGRect(
                    x: left, y: bandTop,
                    width: right - left, height: bandBottom - bandTop
                ))
                keyFramesFlat.append(key.button)
            }
        }

        // Only treat the cache as valid once every key made it in — a build
        // that dropped zero-width buttons must rebuild on the next touch
        // rather than leaving those keys permanently un-hittable.
        let expected = keyButtons.reduce(0) { $0 + $1.count }
        keyFramesValid = keyFramesFlat.count == expected && !keyFramesFlat.isEmpty
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        keyFramesValid = false
        rowStackHeightConstraint.constant = qwertyRowStackHeight
        rowStackView.spacing = rowStackInterRowSpacing
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if traitCollection.verticalSizeClass
            != previousTraitCollection?.verticalSizeClass {
            rowStackHeightConstraint.constant = qwertyRowStackHeight
            rowStackView.spacing = rowStackInterRowSpacing
            // Rebuild rows so shift/delete/spacer widths pick up the
            // orientation-specific `effectiveWidthWeight` values.
            if currentLayout != .emoji {
                buildLayout()
            }
            setNeedsLayout()
        }
    }

    // MARK: - Per-pointer timers

    private func scheduleLongPress(
        state: PointerState,
        delay: TimeInterval = KeyboardView.longPressDuration,
        action: @escaping () -> Void
    ) {
        state.longPressTimer?.invalidate()
        state.longPressTimer = Timer.scheduledTimer(
            withTimeInterval: delay, repeats: false
        ) { _ in action() }
    }

    /// True when a long-press on `label` should open the variants popup —
    /// either accent variants for a letter, or a punctuation/symbol popup.
    private func hasLongPressVariants(_ label: String) -> Bool {
        return AccentVariants.hasVariants(for: label)
            || PunctuationVariants.hasVariants(for: label)
    }

    /// Long-press variants (accent letters or period punctuation). Scheduled
    /// per-pointer instead of via a `UILongPressGestureRecognizer` on the
    /// button so it composes correctly with the multi-touch pipeline (a
    /// recognizer would steal the touch from `touchesBegan`-based commit
    /// logic).
    private func scheduleVariantsLongPress(state: PointerState) {
        scheduleLongPress(state: state) { [weak self, weak state] in
            guard let self = self, let state = state else { return }
            let label = state.button.keyDefinition.label
            let variants: [String]
            if let punctuation = PunctuationVariants.variants(for: label) {
                variants = punctuation
            } else {
                variants = AccentVariants.variants(
                    for: label, uppercase: self.shiftState.isShifted
                )
            }
            guard !variants.isEmpty else { return }
            // Hide the typewriter preview — variants popover takes over.
            self.keyPreview.hide()
            let keyFrame = state.button.convert(state.button.bounds, to: self)
            self.keyVariants.show(
                variants: variants, keyFrame: keyFrame, in: self
            )
            // Seed the highlight from the current finger position so the
            // user can drag-pick immediately without a redundant motion.
            self.keyVariants.updateHighlight(at: state.lastLocation)
            state.ownsVariants = true
            state.longPressFired = true
        }
    }

    private func anyPointerOwnsVariants() -> Bool {
        return pointers.values.contains { $0.ownsVariants }
    }

    private func anyPointerOwnsDeleteRepeat() -> Bool {
        return pointers.values.contains { $0.ownsDeleteRepeat }
    }

    /// Drops every active pointer's state. Called when a layout rebuild
    /// would invalidate the `KeyButton` references each pointer holds.
    private func cancelAllActivePointers() {
        for state in pointers.values {
            state.longPressTimer?.invalidate()
            state.button.setPressed(false)
        }
        pointers.removeAll(keepingCapacity: true)
        previewHideTimer?.invalidate()
        previewHideTimer = nil
        keyPreview.hide()
        keyVariants.hide()
        emojiPreview.hide()
        dismissSkinTonePopup()
        setTrackpadBlankOnAllKeys(false)
        stopDeleteRepeat()
    }

    /// Toggles the trackpad-blank visual across every key (§5.1). Idempotent —
    /// safe to call on any cursor-drag exit path, including a layout rebuild
    /// that happens mid-drag.
    private func setTrackpadBlankOnAllKeys(_ blank: Bool) {
        for row in keyButtons {
            for button in row {
                button.setTrackpadBlank(blank)
            }
        }
    }

    // MARK: - Delete auto-repeat

    private func startDeleteRepeat() {
        deleteRepeater.onCharRepeat = { [weak self] in
            guard let self else { return }
            self.performDelete()
        }
        deleteRepeater.onWordRepeat = { [weak self] in
            guard let self else { return }
            self.performDeleteWord()
        }
        deleteRepeater.start()
    }

    /// All delete paths (key-down first delete, auto-repeat ticks) funnel
    /// through here so `.emojiSearch` consumes them into the local query
    /// instead of the host app's text proxy.
    private func performDelete() {
        if currentLayout == .emojiSearch {
            if !emojiSearchQuery.isEmpty {
                emojiSearchQuery.removeLast()
                refreshSearchOverlay()
            }
            return
        }
        delegate?.keyboardViewDidTapDelete(self)
    }

    private func performDeleteWord() {
        if currentLayout == .emojiSearch {
            if !emojiSearchQuery.isEmpty {
                while emojiSearchQuery.hasSuffix(" ") {
                    emojiSearchQuery.removeLast()
                }
                while let last = emojiSearchQuery.last, last != " " {
                    emojiSearchQuery.removeLast()
                }
                refreshSearchOverlay()
            }
            return
        }
        delegate?.keyboardViewDidHoldDeleteWord(self)
    }

    private func stopDeleteRepeat() {
        deleteRepeater.stop()
    }

    private func showPreviewIfCharacter(_ button: KeyButton) {
        // Numeric pads don't use the typewriter balloon (matches the native
        // pad) — the keys flash on press instead.
        if currentLayout == .numberPad || currentLayout == .decimalPad { return }
        let type = button.keyDefinition.type
        guard type == .character || type == .comma || type == .period else {
            return
        }
        let display: String
        switch type {
        case .character:
            display = shiftedLabel(button.keyDefinition.label)
        case .comma: display = ","
        case .period: display = "."
        default: return
        }
        // A new preview cancels any pending hide so rapid retargeting doesn't
        // disappear the existing balloon for a frame.
        previewHideTimer?.invalidate()
        previewHideTimer = nil
        let keyFrame = button.convert(button.bounds, to: self)
        // Let a top-row balloon grow up to the record button's top edge (the
        // highest a balloon may go before the system clips it) and no further.
        // Keep a 1 pt margin below that edge so the balloon's top never lands
        // exactly on the clip boundary.
        let recordTop = topBar.convert(
            CGPoint(x: 0, y: topBar.recordButtonTop), to: self
        ).y
        let ceiling = max(recordTop, 1)
        keyPreview.show(
            character: display, over: keyFrame, in: self, topLimit: ceiling
        )
    }

    private func scheduleDeferredPreviewHide() {
        previewHideTimer?.invalidate()
        previewHideTimer = Timer.scheduledTimer(
            withTimeInterval: KeyboardView.previewHideDelay,
            repeats: false
        ) { [weak self] _ in
            guard let self = self else { return }
            // If a new pointer-down arrived in the interim, leave the
            // balloon alone — that pointer's `showPreviewIfCharacter` has
            // already retargeted it.
            if self.pointers.isEmpty {
                self.keyPreview.hide()
            }
        }
    }

    /// Intercepts keystrokes while `.emojiSearch` is active. Returns true
    /// when the key has been consumed (so `handleKeyAction` should bail);
    /// returns false for keys the search mode doesn't own (shift / mode-
    /// switch / etc.) which fall through to the normal action handling.
    private func handleEmojiSearchKey(
        _ key: KeyboardLayout.KeyDefinition
    ) -> Bool {
        switch key.type {
        case .character:
            emojiSearchQuery += key.label.lowercased()
            dropTransientShiftAfterCharacterCommit()
            refreshSearchOverlay()
            return true
        case .delete:
            if !emojiSearchQuery.isEmpty {
                emojiSearchQuery.removeLast()
                refreshSearchOverlay()
            }
            return true
        case .space:
            emojiSearchQuery += " "
            refreshSearchOverlay()
            return true
        case .returnKey:
            // Blue check = commit first match and exit emoji entirely
            // (back to letters, not the picker).
            let results = emojiSearchIndex.search(emojiSearchQuery)
            if let first = results.first {
                delegate?.keyboardView(self, didTapCharacter: first, at: nil)
                RecentEmojis.shared.record(first)
            }
            emojiSearchQuery = ""
            switchToLayout(.letters)
            return true
        case .comma:
            emojiSearchQuery += ","
            refreshSearchOverlay()
            return true
        case .period:
            emojiSearchQuery += "."
            refreshSearchOverlay()
            return true
        case .emoji:
            emojiSearchQuery = ""
            switchToLayout(.emoji)
            return true
        case .shift, .modeSwitch, .symbolSwitch, .mic, .globe:
            return false
        case .spacer:
            return true
        }
    }

    private func handleKeyAction(
        _ key: KeyboardLayout.KeyDefinition, normalizedTouch: CGPoint? = nil
    ) {
        // In `.emojiSearch`, character / delete / space / return are routed
        // into the local search query instead of the host's text proxy, so
        // typing on the QWERTY rows filters emoji results live. The mode-
        // switch and shift keys still work normally so the user can reach
        // numbers, symbols, and capital letters while searching.
        if currentLayout == .emojiSearch {
            if handleEmojiSearchKey(key) { return }
        }
        switch key.type {
        case .character:
            delegate?.keyboardView(
                self, didTapCharacter: shiftedLabel(key.label), at: normalizedTouch
            )
            dropTransientShiftAfterCharacterCommit()
            markSymbolTypedIfApplicable()
        case .delete:
            delegate?.keyboardViewDidTapDelete(self)
        case .space:
            delegate?.keyboardViewDidTapSpace(self)
            autoReturnToLettersIfApplicable()
        case .returnKey:
            delegate?.keyboardViewDidTapReturn(self)
            autoReturnToLettersIfApplicable()
        case .globe:
            delegate?.keyboardViewDidTapGlobe(self)
        case .emoji:
            // iOS gives third-party keyboards no API to programmatically
            // jump to the system Emoji keyboard — instead we swap the row
            // area for an in-keyboard emoji picker.
            switchToLayout(.emoji)
        case .mic:
            // Mic key was replaced by the top-bar record button; no-op in
            // case a stale layout ever carries one.
            break
        case .shift:
            // A live text selection turns shift into a recapitalize gesture
            // (§4.7); the controller owns the document proxy, so it decides.
            if delegate?.keyboardViewDidTapShift(self) == true { return }
            handleShiftTap()
        case .modeSwitch:
            switch currentLayout {
            // The URL / email variants carry the same `123` key as letters, so
            // their mode-switch goes to the numbers page too.
            case .letters, .emojiSearch, .urlLetters, .emailLetters, .twitter, .webSearch: switchToLayout(.numbers)
            case .numbers, .symbols, .emoji: switchToLayout(.letters)
            // Numeric pads have no mode-switch key; unreachable, present
            // only to keep the switch exhaustive.
            case .numberPad, .decimalPad: break
            }
        case .symbolSwitch:
            switch currentLayout {
            case .numbers: switchToLayout(.symbols)
            case .symbols: switchToLayout(.numbers)
            default: break
            }
        case .comma:
            delegate?.keyboardView(self, didTapCharacter: ",", at: nil)
            markSymbolTypedIfApplicable()
        case .period:
            delegate?.keyboardView(self, didTapCharacter: ".", at: nil)
            markSymbolTypedIfApplicable()
        case .spacer:
            // Unreachable — spacers don't have KeyButtons that can fire
            // touches. Present only so the switch stays exhaustive.
            break
        }
    }

    /// Latches the "user typed something in symbols" signal so the next
    /// space or enter flips them back to letters (§4.9 LatinIME).
    private func markSymbolTypedIfApplicable() {
        if currentLayout == .numbers || currentLayout == .symbols {
            typedNonSpaceInSymbols = true
        }
    }

    /// Consumes the latch and switches back to the letters layout, but
    /// only when the user actually committed a non-space symbol first.
    /// Without the guard, hitting space twice in symbols would jump the
    /// user out unexpectedly.
    private func autoReturnToLettersIfApplicable() {
        guard typedNonSpaceInSymbols,
              currentLayout == .numbers || currentLayout == .symbols
        else { return }
        switchToLayout(.letters)
    }

    /// LatinIME-style 6-state shift cycle on every tap, with a double-
    /// tap window that escalates to caps lock. The long-press shortcut
    /// to caps lock is wired separately in `handlePointerDown`.
    private func handleShiftTap() {
        let now = CACurrentMediaTime()
        let withinDoubleTap: Bool
        if let last = lastShiftTapAt {
            withinDoubleTap = (now - last) <= Self.shiftDoubleTapWindow
        } else {
            withinDoubleTap = false
        }
        lastShiftTapAt = now

        switch shiftState {
        case .off:
            shiftState = .on
        case .on:
            shiftState = withinDoubleTap ? .capsLock : .off
        case .automatic:
            // User taps shift to cancel the auto-shift — go to the
            // transient "from-auto" state. A second tap inside the
            // double-tap window escalates straight to caps lock.
            shiftState = .manualFromAuto
        case .manualFromAuto:
            shiftState = withinDoubleTap ? .capsLock : .on
        case .capsLock:
            shiftState = .off
        }
        updateKeyLabels()
    }

    /// Called after any character commit. Drops the transient one-shot
    /// shift states; caps lock stays sticky.
    private func dropTransientShiftAfterCharacterCommit() {
        switch shiftState {
        case .on, .automatic, .manualFromAuto:
            shiftState = .off
            updateKeyLabels()
        case .off, .capsLock:
            break
        }
        // Once a non-shift key has fired, the double-tap window for
        // shift no longer applies.
        lastShiftTapAt = nil
    }
}

// MARK: - KeyboardTopBarDelegate

extension KeyboardView: KeyboardTopBarDelegate {
    func topBarDidTapRecord(_ topBar: KeyboardTopBar) {
        HapticManager.keyTap()
        delegate?.keyboardViewDidToggleRecord(self)
    }

    func topBar(_ topBar: KeyboardTopBar, didSelectSuggestion slot: SuggestionSlot) {
        delegate?.keyboardView(self, didSelectSuggestion: slot)
    }
}

// MARK: - Emoji picker

extension KeyboardView: EmojiPickerViewDelegate {

    fileprivate func installEmojiPickerIfNeeded() {
        guard emojiPickerView == nil else { return }
        let picker = EmojiPickerView(theme: theme)
        picker.translatesAutoresizingMaskIntoConstraints = false
        picker.delegate = self
        // Match the rowStackView constraints so the picker fills the same
        // area the QWERTY rows would occupy.
        addSubview(picker)
        NSLayoutConstraint.activate([
            // Picker extends edge-to-edge — native iOS emoji picker
            // fills the full keyboard width, especially noticeable in
            // landscape where the 8 pt of outer padding wastes valuable
            // horizontal space.
            picker.leadingAnchor.constraint(equalTo: leadingAnchor),
            picker.trailingAnchor.constraint(equalTo: trailingAnchor),
            picker.topAnchor.constraint(equalTo: topBar.bottomAnchor, constant: 4),
            picker.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -2),
        ])
        // Keep the popups (preview / variants) above the picker.
        bringSubviewToFront(keyPreview)
        bringSubviewToFront(keyVariants)
        emojiPickerView = picker
    }

    func emojiPicker(_ view: EmojiPickerView, didSelect emoji: String) {
        delegate?.keyboardView(
            self, didTapCharacter: SkinTonePreferences.shared.display(emoji), at: nil
        )
    }

    func emojiPicker(_ view: EmojiPickerView, didHighlight emoji: String, at frame: CGRect) {
        guard skinTonePopup == nil else { return }
        emojiPreview.show(
            character: emoji, over: view.convert(frame, to: self), in: self
        )
    }

    func emojiPickerDidUnhighlight(_ view: EmojiPickerView) {
        emojiPreview.hide()
    }

    func emojiPicker(
        _ view: EmojiPickerView, didLongPressSkinTonable base: String, at frame: CGRect
    ) {
        presentSkinTonePopup(for: base, anchor: view.convert(frame, to: self))
    }

    func emojiPickerDidTapABC(_ view: EmojiPickerView) {
        switchToLayout(.letters)
    }

    func emojiPickerDidTapDelete(_ view: EmojiPickerView) {
        delegate?.keyboardViewDidTapDelete(self)
    }

    func emojiPickerDidHoldDeleteWord(_ view: EmojiPickerView) {
        delegate?.keyboardViewDidHoldDeleteWord(self)
    }

    func emojiPickerDidActivateSearch(_ view: EmojiPickerView) {
        emojiSearchQuery = ""
        switchToLayout(.emojiSearch)
        refreshSearchOverlay()
    }
}

// MARK: - Emoji search overlay

extension KeyboardView: EmojiSearchOverlayViewDelegate {

    fileprivate func installSearchOverlayIfNeeded() {
        guard searchOverlay == nil else { return }
        let overlay = EmojiSearchOverlayView(theme: theme)
        overlay.translatesAutoresizingMaskIntoConstraints = false
        overlay.delegate = self
        addSubview(overlay)
        // Overlay height is implicit: rowStack has a fixed QWERTY height
        // and is pinned to overlay.bottom + 4, so the overlay absorbs the
        // leftover vertical space without changing key sizes.
        let topConstraint = rowStackView.topAnchor.constraint(
            equalTo: overlay.bottomAnchor, constant: 4
        )
        NSLayoutConstraint.activate([
            overlay.leadingAnchor.constraint(equalTo: leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: trailingAnchor),
            overlay.topAnchor.constraint(equalTo: topBar.bottomAnchor, constant: 4),
        ])
        rowStackTopFromSearchOverlay = topConstraint
        // Keep popups above the overlay.
        bringSubviewToFront(keyPreview)
        bringSubviewToFront(keyVariants)
        searchOverlay = overlay
    }

    /// Recomputes the search results from the current query and pushes them
    /// into the overlay. Called every time the user types/deletes while in
    /// `.emojiSearch`. When the query is empty we still hand the overlay a
    /// curated set (recents, falling back to smileys) so the strip is never
    /// blank — mirrors native iOS behaviour where you see emojis pre-typing.
    fileprivate func refreshSearchOverlay() {
        guard let overlay = searchOverlay else { return }
        let results: [String]
        if emojiSearchQuery.isEmpty {
            let recents = EmojiData.emojis(for: .recents)
            if !recents.isEmpty {
                results = recents
            } else {
                results = Array(EmojiData.emojis(for: .smileys).prefix(40))
            }
        } else {
            results = emojiSearchIndex.search(emojiSearchQuery)
        }
        overlay.setQuery(emojiSearchQuery, results: results)
    }

    func emojiSearchOverlayDidClearQuery(_ view: EmojiSearchOverlayView) {
        emojiSearchQuery = ""
        refreshSearchOverlay()
    }

    func emojiSearchOverlay(
        _ view: EmojiSearchOverlayView, didSelect emoji: String
    ) {
        // Stay in search after inserting — the user often picks several
        // emojis from one query; ABC/return are the explicit exits.
        delegate?.keyboardView(
            self, didTapCharacter: SkinTonePreferences.shared.display(emoji), at: nil
        )
        RecentEmojis.shared.record(emoji)
    }

    func emojiSearchOverlay(
        _ view: EmojiSearchOverlayView,
        didLongPressSkinTonable base: String, at frame: CGRect
    ) {
        presentSkinTonePopup(for: base, anchor: view.convert(frame, to: self))
    }
}

// MARK: - Skin tone popover

extension KeyboardView {

    /// Floats the sticky skin-tone popover above `anchor` (own coordinate
    /// space). Tapping a variant persists the tone for that emoji, inserts
    /// it, and refreshes whichever emoji surface is showing.
    fileprivate func presentSkinTonePopup(for base: String, anchor: CGRect) {
        dismissSkinTonePopup()
        emojiPreview.hide()
        let popup = SkinToneVariantsView(
            base: base,
            currentTone: SkinTonePreferences.shared.tone(for: base),
            anchor: anchor
        )
        popup.onCancel = { [weak self] in
            self?.dismissSkinTonePopup()
        }
        popup.onSelect = { [weak self] tone in
            guard let self else { return }
            self.dismissSkinTonePopup()
            SkinTonePreferences.shared.setTone(tone, for: base)
            self.delegate?.keyboardView(
                self, didTapCharacter: EmojiSkinTones.applying(tone, to: base), at: nil
            )
            RecentEmojis.shared.record(base)
            KeyFeedback.keyTap()
            self.emojiPickerView?.refreshSkinTones()
            if self.currentLayout == .emojiSearch {
                // Stay in search (like a plain result tap) but rebuild the
                // strip so the result button shows the new tone.
                self.refreshSearchOverlay()
            }
        }
        popup.present(in: self)
        skinTonePopup = popup
    }

    fileprivate func dismissSkinTonePopup() {
        skinTonePopup?.removeFromSuperview()
        skinTonePopup = nil
    }
}

// MARK: - Toast

/// Transient toast pill shown near the bottom-center of the keyboard when it
/// needs to relay a recoverable error or instruction to the user — typically
/// "Open Echos to enable voice typing" when the main app isn't running.
/// Mirrors the Android keyboard's native bottom toast so both platforms
/// surface errors the same way. Keyboard extensions can't open URLs reliably,
/// so the toast is informational only (and non-interactive, so it never
/// swallows taps meant for the keys beneath it).
final class KeyboardToastView: UIView {

    private let label = UILabel()
    private let pill = UIView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        backgroundColor = .clear
        isUserInteractionEnabled = false

        pill.translatesAutoresizingMaskIntoConstraints = false
        pill.backgroundColor = UIColor(hex: 0x707171)
        pill.layer.cornerRadius = 14
        pill.layer.cornerCurve = .continuous
        addSubview(pill)

        label.translatesAutoresizingMaskIntoConstraints = false
        label.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        label.textColor = UIColor(hex: 0xF5F5F8)
        label.textAlignment = .center
        label.adjustsFontSizeToFitWidth = true
        label.minimumScaleFactor = 0.85
        label.numberOfLines = 1
        pill.addSubview(label)

        NSLayoutConstraint.activate([
            pill.centerXAnchor.constraint(equalTo: centerXAnchor),
            pill.centerYAnchor.constraint(equalTo: centerYAnchor),
            pill.heightAnchor.constraint(equalToConstant: 28),
            pill.leadingAnchor.constraint(
                greaterThanOrEqualTo: leadingAnchor, constant: 16
            ),
            pill.trailingAnchor.constraint(
                lessThanOrEqualTo: trailingAnchor, constant: -16
            ),

            label.leadingAnchor.constraint(equalTo: pill.leadingAnchor, constant: 14),
            label.trailingAnchor.constraint(equalTo: pill.trailingAnchor, constant: -14),
            label.topAnchor.constraint(equalTo: pill.topAnchor),
            label.bottomAnchor.constraint(equalTo: pill.bottomAnchor),
        ])
    }

    func setMessage(_ text: String) {
        label.text = text
    }
}
