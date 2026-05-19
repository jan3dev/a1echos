import UIKit

/// Delegate protocol for keyboard actions.
protocol KeyboardViewDelegate: AnyObject {
    func keyboardView(_ view: KeyboardView, didTapCharacter char: String)
    func keyboardViewDidTapDelete(_ view: KeyboardView)
    /// Fired by the delete key's hold-to-repeat timer once the user has held
    /// past the word-deletion threshold (matches native iOS behaviour where
    /// long holds escalate from per-character to per-word deletion).
    func keyboardViewDidHoldDeleteWord(_ view: KeyboardView)
    func keyboardViewDidTapSpace(_ view: KeyboardView)
    func keyboardViewDidTapReturn(_ view: KeyboardView)
    func keyboardViewDidTapGlobe(_ view: KeyboardView)
    /// Long-press on the emoji key (iOS-only path to the system keyboard
    /// picker now that the dedicated globe key is gone).
    func keyboardView(_ view: KeyboardView, didLongPressEmojiFrom sourceView: UIView)
    func keyboardViewDidToggleRecord(_ view: KeyboardView)
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
    /// for 5 native-sized emoji rows without making the QWERTY mode oversized.
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
            rowsHeight = isLandscape ? 236 : 366
        default:
            rowsHeight = isLandscape ? 154 : 212
        }
        return rowsHeight + KeyboardTopBar.preferredHeight
    }

    private let theme = KeyboardTheme()
    private let topBar = KeyboardTopBar()
    private let keyPreview = KeyPreviewView()
    private let keyVariants = KeyVariantsView()
    private let banner = KeyboardBannerView()
    private var rowStackView: UIStackView!
    private var emojiPickerView: EmojiPickerView?
    private var searchOverlay: EmojiSearchOverlayView?

    private var rowStackTopFromTopBar: NSLayoutConstraint!
    // Pinned under the search overlay that replaces the topBar in .emojiSearch.
    private var rowStackTopFromSearchOverlay: NSLayoutConstraint?
    // Pins the rowStack to the QWERTY-equivalent height regardless of mode
    // so swapping into/out of search doesn't resize the keys.
    private var rowStackHeightConstraint: NSLayoutConstraint!

    /// Height the rowStack should occupy in any QWERTY-style mode.
    /// Portrait: 200 pt = 4 rows × ~41.75 pt + 3 × 11 pt spacing.
    /// Landscape: 142 pt = 4 rows × ~28.75 pt + 3 × 9 pt spacing.
    private var qwertyRowStackHeight: CGFloat {
        isPhoneLandscape ? 142 : 200
    }

    private var rowStackInterRowSpacing: CGFloat {
        isPhoneLandscape ? 9 : 11
    }

    private lazy var emojiSearchIndex = EmojiSearchIndex()
    private var emojiSearchQuery: String = ""
    private var keyButtons: [[KeyButton]] = []
    private var currentLayout: KeyboardLayout.LayoutMode = .letters
    private var shiftState: KeyboardLayout.ShiftState = .off
    private var micState: MicState = .idle
    private var returnKeyType: UIReturnKeyType = .default
    private var bannerHideTimer: Timer?

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
        init(button: KeyButton, location: CGPoint) {
            self.button = button
            self.lastLocation = location
        }
    }
    private var pointers: [ObjectIdentifier: PointerState] = [:]

    // Cached key frames. Hit-testing every finger on every move via
    // UIView.convert would dominate the touch pipeline. keyFrameRow tracks
    // the row index of each cached frame so the nearest-key fallback can
    // constrain its search to the row vertically containing the touch.
    private var keyFrames: [CGRect] = []
    private var keyFramesFlat: [KeyButton] = []
    private var keyFrameRow: [Int] = []
    private var keyFramesValid: Bool = false

    // Drag-to-correct hysteresis — matches LatinIME's keyHysteresisDistance (~0.5 keys).
    private static let keyHysteresis: CGFloat = 12.0

    // Delete-repeat is owned by whichever pointer first lands on delete;
    // a second finger on delete commits a single tap on its own release.
    private let deleteRepeater = DeleteRepeater()
    private static let longPressDuration: TimeInterval = 0.4

    // Brief hide-delay so the preview balloon retargets to a new finger
    // landing in the interim instead of flickering off and back on.
    private static let previewHideDelay: TimeInterval = 0.05
    private var previewHideTimer: Timer?

    init() {
        super.init(frame: .zero, inputViewStyle: .keyboard)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    private func setupView() {
        // The `.keyboard` input style supplies the backdrop; keep our own
        // `backgroundColor` clear so the blur shows through.
        backgroundColor = theme.keyboardBackground
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
        banner.translatesAutoresizingMaskIntoConstraints = false
        banner.isHidden = true
        addSubview(banner)
        // Both popups sit above all other subviews. Variants is added last
        // so the accent popover renders above the typewriter balloon — in
        // practice only one is visible at a time.
        addSubview(keyPreview)
        addSubview(keyVariants)
        rowStackTopFromTopBar = rowStackView.topAnchor.constraint(
            equalTo: topBar.bottomAnchor, constant: 4
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
            equalTo: bottomAnchor, constant: -8
        )
        rowStackBottom.priority = .defaultHigh - 1
        NSLayoutConstraint.activate([
            topBar.leadingAnchor.constraint(equalTo: leadingAnchor),
            topBar.trailingAnchor.constraint(equalTo: trailingAnchor),
            topBar.topAnchor.constraint(equalTo: topAnchor),
            topBar.heightAnchor.constraint(equalToConstant: KeyboardTopBar.preferredHeight),

            rowStackView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            rowStackView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            rowStackTopFromTopBar,
            rowStackBottom,
            rowStackHeightConstraint,

            banner.leadingAnchor.constraint(equalTo: leadingAnchor),
            banner.trailingAnchor.constraint(equalTo: trailingAnchor),
            banner.topAnchor.constraint(equalTo: topAnchor),
            banner.heightAnchor.constraint(equalToConstant: KeyboardTopBar.preferredHeight),
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
        let isSearchMode = currentLayout == .emojiSearch
        topBar.isHidden = false
        if isSearchMode {
            installSearchOverlayIfNeeded()
            searchOverlay?.isHidden = false
            rowStackTopFromTopBar.isActive = false
            rowStackTopFromSearchOverlay?.isActive = true
        } else {
            searchOverlay?.isHidden = true
            rowStackTopFromSearchOverlay?.isActive = false
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

    private func updateKeyLabels() {
        for row in keyButtons {
            for button in row {
                let def = button.keyDefinition
                switch def.type {
                case .character:
                    let label = shiftState != .off ? def.label.uppercased() : def.label
                    button.setDisplayLabel(label)
                case .returnKey:
                    applyReturnKeyDisplay(to: button)
                    // In emoji-search mode the return key is the "done"
                    // affordance — render as a blue accent pill with a
                    // checkmark glyph, like native iOS 26 search chrome.
                    button.setPrimaryAction(currentLayout == .emojiSearch)
                default:
                    break
                }
                button.updateAppearance(theme: theme, micState: micState, shiftState: shiftState)
            }
        }
    }

    /// Applies either a text label ("Go", "Send", "Next", "Done") or an SF
    /// Symbol (`return`, `magnifyingglass`, `checkmark` in search mode) to
    /// the return key so it matches the native keyboard's per-context
    /// appearance.
    private func applyReturnKeyDisplay(to button: KeyButton) {
        if currentLayout == .emojiSearch {
            button.setDisplaySymbol("checkmark")
            return
        }
        switch returnKeyType {
        case .go: button.setDisplayLabel("Go")
        case .send: button.setDisplayLabel("Send")
        case .next: button.setDisplayLabel("Next")
        case .done: button.setDisplayLabel("Done")
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

    var currentMicState: MicState { micState }

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
        presentBanner(message: message)
    }

    func showOpenAppPrompt(_ message: String) {
        UIAccessibility.post(notification: .announcement, argument: message)
        presentBanner(message: message, autoHideAfter: 5.0)
    }

    private func presentBanner(
        message: String, autoHideAfter seconds: TimeInterval = 3.0
    ) {
        bannerHideTimer?.invalidate()
        banner.setMessage(message)
        if banner.isHidden {
            banner.alpha = 0
            banner.isHidden = false
            UIView.animate(withDuration: 0.18) { self.banner.alpha = 1 }
        }
        bannerHideTimer = Timer.scheduledTimer(
            withTimeInterval: seconds, repeats: false
        ) { [weak self] _ in
            self?.dismissBanner()
        }
    }

    private func dismissBanner() {
        bannerHideTimer?.invalidate()
        bannerHideTimer = nil
        UIView.animate(
            withDuration: 0.18,
            animations: { self.banner.alpha = 0 },
            completion: { _ in self.banner.isHidden = true }
        )
    }

    func switchToLayout(_ mode: KeyboardLayout.LayoutMode) {
        let modeChanged = mode != currentLayout
        currentLayout = mode
        buildLayout()
        if modeChanged {
            onLayoutModeChange?(mode)
        }
    }

    // MARK: - Multi-touch pipeline (QWERTY rows)

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

        HapticManager.keyTap()
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
            if AccentVariants.hasVariants(for: button.keyDefinition.label),
               !anyPointerOwnsVariants() {
                scheduleAccentLongPress(state: state)
            }
        default:
            showPreviewIfCharacter(button)
        }
    }

    private func handlePointerMoved(_ touch: UITouch) {
        guard let state = pointers[ObjectIdentifier(touch)] else { return }
        let location = touch.location(in: self)
        state.lastLocation = location

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

        // Hysteresis-gated drag-to-correct (LatinIME's
        // `isMajorEnoughMoveToBeOnNewKey`). The finger has to leave the
        // current key's frame by at least `keyHysteresis` points before we
        // transfer the press — otherwise jitter on the boundary would cause
        // a constant ping-pong between adjacent keys.
        let currentFrame = state.button.convert(state.button.bounds, to: self)
        let inflated = currentFrame.insetBy(
            dx: -Self.keyHysteresis, dy: -Self.keyHysteresis
        )
        if inflated.contains(location) { return }

        guard let newButton = hitTestKeyButton(at: location),
              newButton !== state.button else { return }

        // Don't slide across non-character keys — sliding from `q` onto
        // shift / delete / return would cause more confusion than help.
        guard newButton.keyDefinition.type == .character ||
              newButton.keyDefinition.type == .comma ||
              newButton.keyDefinition.type == .period else { return }
        guard state.button.keyDefinition.type == .character ||
              state.button.keyDefinition.type == .comma ||
              state.button.keyDefinition.type == .period else { return }

        // Cancel any pending long-press for the old key — the drag-correct
        // is a fresh press, not a held one.
        state.longPressTimer?.invalidate()
        state.longPressTimer = nil

        state.button.setPressed(false)
        state.button = newButton
        newButton.setPressed(true)
        showPreviewIfCharacter(newButton)

        if newButton.keyDefinition.type == .character,
           AccentVariants.hasVariants(for: newButton.keyDefinition.label),
           !anyPointerOwnsVariants() {
            scheduleAccentLongPress(state: state)
        }
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
            return
        }

        // Variants popover: only the owning pointer commits its selection.
        if state.ownsVariants {
            let selected = keyVariants.selectedVariant()
            keyVariants.hide()
            if let variant = selected {
                delegate?.keyboardView(self, didTapCharacter: variant)
                if shiftState == .on {
                    shiftState = .off
                    updateKeyLabels()
                }
            }
            return
        }

        // Delete repeat already fired one or more times: skip the trailing
        // single-tap so we don't double-delete on release.
        if state.ownsDeleteRepeat {
            let suppressTap = deleteRepeater.didRepeat
            stopDeleteRepeat()
            if suppressTap { return }
        }

        // Emoji long-press already opened the keyboard picker; the release
        // shouldn't also open the emoji panel.
        if state.longPressFired { return }

        handleKeyAction(state.button.keyDefinition)
    }

    // Returns the key under the point — or the nearest key in the same row
    // if the point lands in the ~6 pt inter-key gap (otherwise the gap is a
    // dead zone). Constraining nearest-key to the row vertically containing
    // the touch keeps a slightly-low thumb from snapping up a row.
    private func hitTestKeyButton(at point: CGPoint) -> KeyButton? {
        if !keyFramesValid { rebuildKeyFrames() }
        guard !keyFramesFlat.isEmpty else { return nil }

        // Fast path: direct hit.
        for (idx, frame) in keyFrames.enumerated() {
            if frame.contains(point) { return keyFramesFlat[idx] }
        }

        // Pick the row whose vertical band the touch lies in; if the touch is
        // between rows, pick the row with the nearest vertical edge so the
        // snap follows the natural drift of a thumb roll.
        let candidateRow = nearestRowIndex(for: point.y) ?? -1
        guard candidateRow >= 0 else { return nil }

        var best: (idx: Int, distSq: CGFloat)? = nil
        for idx in 0..<keyFramesFlat.count where keyFrameRow[idx] == candidateRow {
            let f = keyFrames[idx]
            let dx = max(f.minX - point.x, max(0, point.x - f.maxX))
            let dy = max(f.minY - point.y, max(0, point.y - f.maxY))
            let d = dx * dx + dy * dy
            if best == nil || d < best!.distSq { best = (idx, d) }
        }
        // Cap the snap distance to something reasonable so a touch way off
        // the keyboard (e.g. in the top bar via gesture forwarding) doesn't
        // commit some random edge key. ~1.5× a key's smaller side.
        guard let best = best else { return nil }
        let cap = (keyFrames[best.idx].height * 1.5)
        if best.distSq > cap * cap { return nil }
        return keyFramesFlat[best.idx]
    }

    /// Finds the row index whose vertical band best matches `y`. Returns nil
    /// if the touch is dramatically outside the QWERTY area.
    private func nearestRowIndex(for y: CGFloat) -> Int? {
        // Compute the vertical span of each row from its first key frame.
        var bestRow: Int? = nil
        var bestDist: CGFloat = .greatestFiniteMagnitude
        for rowIdx in keyButtons.indices {
            guard let first = keyButtons[rowIdx].first,
                  let frame = cachedFrame(for: first) else { continue }
            if y >= frame.minY && y <= frame.maxY { return rowIdx }
            let d = min(abs(y - frame.minY), abs(y - frame.maxY))
            if d < bestDist {
                bestDist = d
                bestRow = rowIdx
            }
        }
        return bestRow
    }

    private func cachedFrame(for button: KeyButton) -> CGRect? {
        for (idx, b) in keyFramesFlat.enumerated() where b === button {
            return keyFrames[idx]
        }
        return nil
    }

    private func rebuildKeyFrames() {
        keyFrames.removeAll(keepingCapacity: true)
        keyFramesFlat.removeAll(keepingCapacity: true)
        keyFrameRow.removeAll(keepingCapacity: true)
        for (rowIdx, row) in keyButtons.enumerated() {
            for button in row {
                guard button.window != nil, button.bounds.width > 0 else { continue }
                let frame = button.convert(button.bounds, to: self)
                keyFrames.append(frame)
                keyFramesFlat.append(button)
                keyFrameRow.append(rowIdx)
            }
        }
        keyFramesValid = !keyFramesFlat.isEmpty
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

    /// Accent variants long-press. Scheduled per-pointer instead of via a
    /// `UILongPressGestureRecognizer` on the button so it composes correctly
    /// with the multi-touch pipeline (a recognizer would steal the touch from
    /// `touchesBegan`-based commit logic).
    private func scheduleAccentLongPress(state: PointerState) {
        scheduleLongPress(state: state) { [weak self, weak state] in
            guard let self = self, let state = state else { return }
            let label = state.button.keyDefinition.label
            let variants = AccentVariants.variants(
                for: label, uppercase: self.shiftState != .off
            )
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
        stopDeleteRepeat()
    }

    // MARK: - Delete auto-repeat

    private func startDeleteRepeat() {
        deleteRepeater.onCharRepeat = { [weak self] in
            guard let self else { return }
            self.delegate?.keyboardViewDidTapDelete(self)
        }
        deleteRepeater.onWordRepeat = { [weak self] in
            guard let self else { return }
            self.delegate?.keyboardViewDidHoldDeleteWord(self)
        }
        deleteRepeater.start()
    }

    private func stopDeleteRepeat() {
        deleteRepeater.stop()
    }

    private func showPreviewIfCharacter(_ button: KeyButton) {
        let type = button.keyDefinition.type
        guard type == .character || type == .comma || type == .period else {
            return
        }
        let display: String
        switch type {
        case .character:
            display = shiftState != .off
                ? button.keyDefinition.label.uppercased()
                : button.keyDefinition.label
        case .comma: display = ","
        case .period: display = "."
        default: return
        }
        // A new preview cancels any pending hide so rapid retargeting doesn't
        // disappear the existing balloon for a frame.
        previewHideTimer?.invalidate()
        previewHideTimer = nil
        let keyFrame = button.convert(button.bounds, to: self)
        keyPreview.show(character: display, over: keyFrame, in: self)
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
            if shiftState == .on {
                shiftState = .off
                updateKeyLabels()
            }
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
                delegate?.keyboardView(self, didTapCharacter: first)
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

    private func handleKeyAction(_ key: KeyboardLayout.KeyDefinition) {
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
            let char = shiftState != .off ? key.label.uppercased() : key.label
            delegate?.keyboardView(self, didTapCharacter: char)
            if shiftState == .on {
                shiftState = .off
                updateKeyLabels()
            }
        case .delete:
            delegate?.keyboardViewDidTapDelete(self)
        case .space:
            delegate?.keyboardViewDidTapSpace(self)
        case .returnKey:
            delegate?.keyboardViewDidTapReturn(self)
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
            switch shiftState {
            case .off: shiftState = .on
            case .on: shiftState = .capsLock
            case .capsLock: shiftState = .off
            }
            updateKeyLabels()
        case .modeSwitch:
            switch currentLayout {
            case .letters, .emojiSearch: switchToLayout(.numbers)
            case .numbers, .symbols, .emoji: switchToLayout(.letters)
            }
        case .symbolSwitch:
            switch currentLayout {
            case .numbers: switchToLayout(.symbols)
            case .symbols: switchToLayout(.numbers)
            default: break
            }
        case .comma:
            delegate?.keyboardView(self, didTapCharacter: ",")
        case .period:
            delegate?.keyboardView(self, didTapCharacter: ".")
        case .spacer:
            // Unreachable — spacers don't have KeyButtons that can fire
            // touches. Present only so the switch stays exhaustive.
            break
        }
    }
}

// MARK: - KeyboardTopBarDelegate

extension KeyboardView: KeyboardTopBarDelegate {
    func topBarDidTapRecord(_ topBar: KeyboardTopBar) {
        HapticManager.keyTap()
        delegate?.keyboardViewDidToggleRecord(self)
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
            picker.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])
        // Keep the popups (preview / variants) above the picker.
        bringSubviewToFront(keyPreview)
        bringSubviewToFront(keyVariants)
        emojiPickerView = picker
    }

    func emojiPicker(_ view: EmojiPickerView, didSelect emoji: String) {
        delegate?.keyboardView(self, didTapCharacter: emoji)
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
        delegate?.keyboardView(self, didTapCharacter: emoji)
        RecentEmojis.shared.record(emoji)
        emojiSearchQuery = ""
        switchToLayout(.emoji)
    }
}

// MARK: - Banner

/// Inline status banner shown over the top bar when the keyboard needs
/// to relay a recoverable error or instruction to the user — typically
/// "Open Echos to enable voice typing" when the main app isn't running.
/// Keyboard extensions can't open URLs reliably, so the banner is
/// informational only.
final class KeyboardBannerView: UIView {

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
