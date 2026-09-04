import UIKit

/// Main entry point for the Echos keyboard extension.
/// Manages the keyboard view hierarchy, text input via textDocumentProxy,
/// and coordinates mic recording with the main app via IPC.
class EchosKeyboardViewController: UIInputViewController {

    private var keyboardView: KeyboardView!
    private var ipcClient: IPCClient!
    private var doubleSpacePeriod = DoubleSpacePeriod()
    /// Polls the level the main app publishes while recording (capture lives in
    /// the app — iOS forbids extensions from recording) and drives the top-bar
    /// waveform off it.
    private var meterTimer: Timer?
    private let recapitalize = RecapitalizeEngine()
    /// Learned vocabulary + revert blacklist (§5.11). Loaded off-main in
    /// `viewDidLoad`, flushed in `viewWillDisappear`.
    private let userLexicon = UserLexicon()
    /// Bundled-dictionary correction engine (§5.10). Loaded off-main; until
    /// then `SuggestionEngine` falls back to `UITextChecker`.
    private lazy var correctionEngine = CorrectionEngine(userLexicon: userLexicon)
    private lazy var suggestionEngine = SuggestionEngine(correctionEngine: correctionEngine)
    /// Neural reranker for context-aware autocorrect. Compiled in only when
    /// the llama.xcframework vendor artifact exists (the config plugin adds
    /// the ECHOS_LM compilation condition alongside it and bundles the
    /// model). Always attached; a failed load leaves ranking bit-identical
    /// to the classical engine.
    #if ECHOS_LM
    private let lmReranker = LmReranker()
    #endif
    private var settings = KeyboardSettings.load() {
        didSet {
            HapticManager.isEnabled = settings.hapticFeedback
            SoundManager.isEnabled = settings.keySound
        }
    }


    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        #if ECHOS_LM
        lmReranker.unload()
        #endif
    }
    /// Pending autocorrect revert target (§5.4): set when a correction
    /// auto-applied on a separator, consumed by the next backspace (which
    /// deletes the separator and offers the typed word in the strip) or any
    /// other keystroke / cursor move.
    private var lastAutocorrect: SuggestionEngine.LastAutocorrect?
    /// Active revert offer (§5.4): the user backspaced right after an
    /// autocorrect, so the strip shows the quoted original word — tapping it
    /// swaps the correction back and blacklists the pair. Mirrors the native
    /// iOS revert affordance. Cleared by any other input or cursor move.
    private var pendingRevert: SuggestionEngine.LastAutocorrect?
    /// Word the user explicitly kept by tapping the verbatim strip slot —
    /// autocorrect must not fire on it when the separator lands. Cleared on
    /// cursor moves and whenever the composing word ends.
    private var autocorrectSuppressedWord: String?
    /// Per-character tap coordinates for the in-progress word (spatial
    /// correction model, §5.10). One entry per composing character, appended on
    /// key-down, popped on backspace, and reset whenever the composing word
    /// ends or the cursor/text changes out from under us. Fed to the engine
    /// only when its length matches the reconstructed word — a mismatch falls
    /// back to the static adjacency model rather than skewing costs.
    private var currentWordTouches: [CorrectionEngine.TouchPoint?] = []
    /// Punctuation that commits a pending autocorrect, like space does.
    private static let autocorrectTriggers: Set<Character> = [
        ".", ",", "!", "?", ";", ":",
    ]
    /// The `keyboardType` for which the field-type layout was last applied
    /// (§9.1). Used so we only auto-open the field's preferred layout when the
    /// field actually changes — not on every keystroke, which would fight a
    /// user who tapped `123`/`ABC` to navigate within a URL/email/numbers field.
    /// Reset in `viewWillAppear` so a freshly-shown keyboard starts fresh.
    private var lastAppliedKeyboardType: UIKeyboardType?
    /// Pending spell-check pass for the suggestion strip. The `UITextChecker`
    /// lookup is debounced off the keystroke path so a fast burst of letters
    /// doesn't block the main thread between taps (which reads as input lag).
    private var suggestionRefreshWork: DispatchWorkItem?
    /// Coalescing window for the suggestion spell-check. Shorter than the gap
    /// between deliberate keystrokes, so a paused user sees fresh suggestions
    /// promptly while a fast typist only pays for the spell-check once.
    private static let suggestionDebounce: TimeInterval = 0.09

    override func viewDidLoad() {
        super.viewDidLoad()

        ipcClient = IPCClient()
        suggestionEngine.resolveLanguage()
        // Both loads read files (mmap + JSON) — keep them off the keystroke
        // path. `isLoaded` flips once and is only ever read afterwards, so
        // the main thread simply keeps using the checker fallback until the
        // refresh below lands.
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            self.userLexicon.load()
            self.correctionEngine.load()
            DispatchQueue.main.async { self.refreshSuggestions() }
        }
        // Contact names + user text replacements — the private lexicon iOS
        // grants keyboard extensions. Arrives async, like the dictionary.
        requestSupplementaryLexicon { [weak self] lexicon in
            DispatchQueue.main.async {
                self?.suggestionEngine.setSupplementaryLexicon(lexicon)
            }
        }

        #if ECHOS_LM
        lmReranker.loadIfNeeded()
        suggestionEngine.lmReranker = lmReranker
        #endif

        keyboardView = KeyboardView()
        keyboardView.translatesAutoresizingMaskIntoConstraints = false
        keyboardView.delegate = self

        // Resize the keyboard whenever the layout mode changes — emoji
        // modes need extra vertical space so the picker's 5 native rows
        // fit. Applied without animation: opening/closing the emoji
        // picker, switching to emoji-search, and toggling 123/symbols
        // all snap into place instantly. Wrapping in `UIView.animate`
        // makes the chrome (topBar / search overlay / rowStack) slide
        // between anchors, which reads as a noisy in/out flicker
        // especially on the emoji ↔ QWERTY transition.
        keyboardView.onLayoutModeChange = { [weak self] _ in
            guard let self = self else { return }
            self.applyPreferredKeyboardHeight()
            self.view.layoutIfNeeded()
        }

        view.addSubview(keyboardView)
        NSLayoutConstraint.activate([
            keyboardView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            keyboardView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            keyboardView.topAnchor.constraint(equalTo: view.topAnchor),
            keyboardView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        // Install the height constraint before the first layout pass — created
        // lazily in `viewWillLayoutSubviews` the first frame renders at the
        // system default height and then snaps to ours.
        let heightConstraint = keyboardView.heightAnchor.constraint(
            equalToConstant: keyboardView.preferredHeight
        )
        heightConstraint.priority = .defaultHigh
        heightConstraint.isActive = true
        keyboardView.heightConstraint = heightConstraint

        // Listen for transcription results from the main app
        ipcClient.onTranscriptionResult = { [weak self] text in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.stopMetering()
                self.textDocumentProxy.insertText(text)
                self.keyboardView.setMicState(.idle)
            }
        }

        ipcClient.onTranscriptionError = { [weak self] error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.stopMetering()
                // Timeout = main app went away (suspended/jetsamed) mid-recording.
                // Show the same "open Echos" recovery the pre-flight ping uses
                // instead of a vague timeout error.
                if error.localizedCaseInsensitiveContains("timed out") {
                    self.keyboardView.showOpenAppPrompt(
                        "Open Echos to finish transcription"
                    )
                } else {
                    self.keyboardView.showMicError(error)
                }
                self.keyboardView.setMicState(.idle)
            }
        }

    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        // Re-read the autocorrect preference each time the keyboard is shown so
        // a change made in the app (while the keyboard was dismissed) takes
        // effect on next appearance — no file watcher needed. Also re-resolve
        // the checker language so a host-locale change is picked up.
        settings = KeyboardSettings.load()
        suggestionEngine.resolveLanguage()
        applyKeyboardAppearance()
        HapticManager.prepare()
        // Idempotent; re-mmaps the model after `didReceiveMemoryWarning`
        // unloaded it.
        #if ECHOS_LM
        lmReranker.loadIfNeeded()
        #endif
        // A freshly-shown keyboard should always start in the field-appropriate
        // layout, so forget the last-applied type before re-applying.
        lastAppliedKeyboardType = nil
        // Apply the field-type layout on first appearance too — `textDidChange`
        // may not fire before the keyboard is shown for a freshly focused field.
        applyFieldTypeLayout()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        // Persist any learning from this session (debounced writes may still
        // be pending).
        userLexicon.flush()
    }

    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        applyPreferredKeyboardHeight()
    }

    /// Pulls the keyboard's preferred height from `KeyboardView`. Computed
    /// over there because the per-mode budget (taller in emoji, tighter in
    /// QWERTY) needs to know `currentLayout`. Portrait/landscape ratios:
    /// QWERTY ≈ 44pt key / ~32pt key; emoji modes ≈ 32pt cells × 5 rows +
    /// search + strip.
    private func applyPreferredKeyboardHeight() {
        keyboardView.heightConstraint?.constant = keyboardView.preferredHeight
    }

    /// Cursor moves are an out-of-band signal to abandon any in-flight
    /// composing state — without this, the user could double-tap shift,
    /// move the cursor, then tap shift again and accidentally engage
    /// caps lock. Same for the smart double-space window.
    override func selectionWillChange(_ textInput: UITextInput?) {
        super.selectionWillChange(textInput)
        doubleSpacePeriod.reset()
        keyboardView.resetShiftDoubleTap()
        // A user-driven cursor/selection move ends any recapitalize rotation
        // (§4.7). Our own proxy edits don't fire this callback, so an
        // in-progress rotation survives consecutive shift taps.
        recapitalize.reset()
        // A cursor move invalidates the composing word, the autocorrect
        // revert window, and any verbatim-tap suppression — drop them and
        // recompute the strip for the new spot.
        lastAutocorrect = nil
        pendingRevert = nil
        autocorrectSuppressedWord = nil
        refreshSuggestions()
    }

    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        // Field-type adaptive layout (§9.1): swap to the numeric pad when the
        // host declares a numeric keyboard type, and back to letters when a
        // numeric field loses focus. `switchToLayout` no-ops unless the mode
        // actually changes, so this is cheap to run on every change.
        applyFieldTypeLayout()
        // Update return key appearance based on context.
        let returnType = textDocumentProxy.returnKeyType ?? .default
        keyboardView.updateReturnKeyType(returnType)
        applyKeyboardAppearance()

        // Re-evaluate auto-cap after every commit so the visual shift
        // state matches the cursor position. Cheap (read cached
        // documentContextBeforeInput, walk back ~10 chars).
        applyAutoCap()
        // Host-driven edits (e.g. autofill) change the composing word too, so
        // the per-key touch buffer can no longer be trusted to align with it.
        currentWordTouches.removeAll()
        refreshSuggestions()
    }

    private func applyAutoCap() {
        switch AutoCapEngine.decide(for: textDocumentProxy) {
        case .capitalize:
            keyboardView.applyAutoShift(true)
        case .lowercase:
            keyboardView.applyAutoShift(false)
        case .disabled:
            // Host opted out — leave shift state alone, the user's
            // manual taps still work.
            break
        }
    }

    // MARK: - Suggestions (§5.5)

    /// Recomputes the top-bar suggestion strip for the current composing word.
    /// Hides the strip when there's no word, the field disallows suggestions,
    /// or the bar is busy recording.
    private func refreshSuggestions() {
        // The cheap gating stays synchronous so the strip hides immediately and
        // we never schedule a spell-check the field doesn't want.
        guard keyboardView.currentMicState == .idle,
              suggestionsAllowed(for: textDocumentProxy) else {
            suggestionRefreshWork?.cancel()
            keyboardView.hideSuggestions()
            keyboardView.setKeyTargetWeights([:])
            return
        }
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        let after = textDocumentProxy.documentContextAfterInput ?? ""
        // Revert offer (§5.4): the user just backspaced an autocorrect's
        // separator — show the quoted original until they type on.
        if let revert = pendingRevert {
            if before.hasSuffix(revert.corrected) {
                suggestionRefreshWork?.cancel()
                keyboardView.showSuggestions([
                    SuggestionSlot(
                        text: revert.typed, isVerbatim: true, isEmphasized: false
                    ),
                ])
                return
            }
            pendingRevert = nil
        }
        let word = SuggestionEngine.currentWord(beforeCursor: before, afterCursor: after)
        // Key-target resizing: synchronous — the trie walk is microseconds
        // and the next tap can land before the debounced strip refresh runs.
        keyboardView.setKeyTargetWeights(
            suggestionEngine.keyTargetWeights(forPrefix: word)
        )
        guard !word.isEmpty else {
            suggestionRefreshWork?.cancel()
            autocorrectSuppressedWord = nil
            // Next-word prediction (§5.12): after a word (possibly across a
            // comma) offer its likely continuations; after sentence-terminal
            // punctuation plus a space offer curated openers. An empty field
            // or fresh line (empty paragraph-bounded context) keeps the
            // record button instead.
            let prev = SuggestionEngine.previousWord(
                beforeCursor: before, currentWord: ""
            )
            if before.hasSuffix(" ") || prev != nil {
                let predictions = suggestionEngine.predictions(
                    afterWord: prev ?? "", casing: currentCasing()
                )
                if !predictions.isEmpty {
                    keyboardView.showSuggestions(
                        predictions.map(SuggestionSlot.candidate)
                    )
                    return
                }
            }
            keyboardView.hideSuggestions()
            return
        }
        // Debounce the lookup: cancel any pending pass and reschedule, so a
        // fast burst of keystrokes only pays for one evaluation, after the
        // user pauses — the keystroke itself already committed via
        // `insertText`, so this never delays the character appearing.
        let previousWord = SuggestionEngine.previousWord(
            beforeCursor: before, currentWord: word
        )
        let casing = Self.casing(forTyped: word)
        let touches = touchPoints(matching: word)
        suggestionRefreshWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            let result = self.suggestionEngine.suggestions(
                for: word,
                previousWord: previousWord,
                casing: casing,
                touchPoints: touches,
                leftContext: SuggestionEngine.leftContext(
                    beforeCursor: before, currentWord: word
                )
            )
            let slots = Self.suggestionSlots(for: result)
            if slots.isEmpty {
                self.keyboardView.hideSuggestions()
            } else {
                self.keyboardView.showSuggestions(slots)
            }
        }
        suggestionRefreshWork = work
        DispatchQueue.main.asyncAfter(
            deadline: .now() + Self.suggestionDebounce, execute: work
        )
    }

    /// Builds the strip layout from a lookup result. While a correction is
    /// pending it mirrors native QuickType: quoted typed word on the left,
    /// the correction emphasized in the center, a runner-up on the right.
    private static func suggestionSlots(
        for result: SuggestionEngine.Result
    ) -> [SuggestionSlot] {
        guard result.topIsCorrection,
              let verbatim = result.verbatim,
              let replacement = result.replacement else {
            return result.candidates.map(SuggestionSlot.candidate)
        }
        var slots = [
            SuggestionSlot(text: verbatim, isVerbatim: true, isEmphasized: false),
            SuggestionSlot(text: replacement, isVerbatim: false, isEmphasized: true),
        ]
        if let runnerUp = result.candidates.first(where: {
            $0.lowercased() != replacement.lowercased()
        }) {
            slots.append(.candidate(runnerUp))
        }
        return slots
    }

    /// Records the tap for a committed character into the composing-word touch
    /// buffer: a point for a letter (spatial model), nil for other in-word
    /// characters (apostrophe, hyphen), and a reset for word separators or
    /// multi-character commits (emoji), which end the word.
    private func recordTouch(forCommitted char: String, at point: CGPoint?) {
        guard char.count == 1, let c = char.first,
              !SpacingAndPunctuations.isWordSeparator(c) else {
            currentWordTouches.removeAll()
            return
        }
        if let point, c.isLetter {
            currentWordTouches.append(
                CorrectionEngine.TouchPoint(x: Float(point.x), y: Float(point.y))
            )
        } else {
            currentWordTouches.append(nil)
        }
    }

    /// The composing-word touch buffer, but only when it lines up with the
    /// word the engine will actually score — otherwise nil, so a desynced
    /// buffer falls back to the static adjacency model.
    private func touchPoints(
        matching word: String
    ) -> [CorrectionEngine.TouchPoint?]? {
        currentWordTouches.count == word.count ? currentWordTouches : nil
    }

    /// After a word + separator commits, retroactively fix a confusable
    /// previous word using the just-committed word as context ("ill be" ->
    /// "I'll be"). Gated under the autocorrect setting; only rewrites a
    /// single-space-separated pair whose exact text is still present before the
    /// cursor, so a host that rewrote the field can never misfire it.
    private func applyContextualContraction(separator: String) {
        guard settings.autocorrect, !separator.isEmpty else { return }
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        guard before.hasSuffix(separator) else { return }
        let afterW2 = String(before.dropLast(separator.count)) // "...P W2"
        let w2 = Self.trailingWord(afterW2)
        guard !w2.isEmpty else { return }
        let afterSpace = String(afterW2.dropLast(w2.count)) // "...P "
        guard afterSpace.hasSuffix(" ") else { return } // single space only
        let beforeSpace = String(afterSpace.dropLast(1)) // "...P"
        // More than one separator between the two words: not a plain "P W2".
        if let last = beforeSpace.last,
           SpacingAndPunctuations.isWordSeparator(last) { return }
        let prev = Self.trailingWord(beforeSpace)
        guard !prev.isEmpty,
              let contraction = correctionEngine.contextualContraction(
                  prevWordRaw: prev, nextWord: w2
              ) else { return }
        let deleteCount = separator.count + w2.count + 1 + prev.count
        for _ in 0..<deleteCount { textDocumentProxy.deleteBackward() }
        textDocumentProxy.insertText(contraction + " " + w2 + separator)
    }

    /// The trailing run of non-separator characters in `text` (its last word).
    private static func trailingWord(_ text: String) -> String {
        var chars: [Character] = []
        for ch in text.reversed() {
            if SpacingAndPunctuations.isWordSeparator(ch) { break }
            chars.append(ch)
        }
        return String(chars.reversed())
    }

    /// Maps the live shift state to the casing suggestion candidates should
    /// adopt. Used only for next-word predictions (no typed word to mirror).
    private func currentCasing() -> SuggestionEngine.Casing {
        switch keyboardView.currentShiftState {
        case .capsLock: return .upper
        case .on, .automatic: return .capitalize
        case .off, .manualFromAuto: return .lower
        }
    }

    /// Casing for corrections/completions mirrors the typed word itself —
    /// the shift state has usually dropped back to off by the time the word
    /// is complete ("Teh" must correct to "The", not "the").
    private static func casing(forTyped word: String) -> SuggestionEngine.Casing {
        let letters = word.filter { $0.isLetter }
        if letters.count > 1, letters.allSatisfy({ $0.isUppercase }) {
            return .upper
        }
        if let first = word.first, first.isUppercase {
            return .capitalize
        }
        return .lower
    }

    /// Applies the field-type adaptive layout (§9.1). The field's preferred
    /// layout is applied only when `keyboardType` *changes* — `textDidChange`
    /// fires on every keystroke, and re-forcing the layout each time would
    /// fight a user who tapped `123`/`ABC` to navigate within a URL / email /
    /// numbers field (the numeric pads have no such escape, but the letter
    /// variants and `.numbersAndPunctuation` do). Phone / name-phone / secure
    /// fields never reach our extension (iOS forces the system keyboard), so
    /// they need no handling here.
    private func applyFieldTypeLayout() {
        let keyboardType = textDocumentProxy.keyboardType
        guard keyboardType != lastAppliedKeyboardType else { return }
        lastAppliedKeyboardType = keyboardType

        switch keyboardType {
        case .decimalPad:
            keyboardView.switchToLayout(.decimalPad)
        case .numberPad, .asciiCapableNumberPad:
            keyboardView.switchToLayout(.numberPad)
        case .URL:
            keyboardView.switchToLayout(.urlLetters)
        case .emailAddress:
            keyboardView.switchToLayout(.emailLetters)
        case .twitter:
            keyboardView.switchToLayout(.twitter)
        case .webSearch:
            keyboardView.switchToLayout(.webSearch)
        case .numbersAndPunctuation:
            // Open to the numbers page once; the user can tap `ABC` to reach
            // letters and stays there (we don't re-force on later keystrokes).
            keyboardView.switchToLayout(.numbers)
        default:
            // A plain text field: restore letters only if we're sitting on a
            // field-specific layout. Don't yank the user out of a numbers /
            // symbols / emoji page they opened manually.
            switch keyboardView.currentLayoutMode {
            case .numberPad, .decimalPad, .urlLetters, .emailLetters, .twitter, .webSearch:
                keyboardView.switchToLayout(.letters)
            default:
                break
            }
        }
    }

    /// Suppresses suggestions in fields where they'd be noise or unsafe —
    /// URLs, emails, passwords, numeric pads — mirroring auto-cap's opt-out.
    private func suggestionsAllowed(for proxy: UITextDocumentProxy) -> Bool {
        // `==` (not `switch`) so this compiles whether `keyboardType` is
        // declared optional or non-optional on the proxy across SDK versions.
        let keyboardType = proxy.keyboardType
        let blockedTypes: [UIKeyboardType] = [
            .URL, .emailAddress, .numberPad, .phonePad,
            .decimalPad, .namePhonePad, .asciiCapableNumberPad,
        ]
        if blockedTypes.contains(where: { $0 == keyboardType }) {
            return false
        }
        // `textContentType` is itself optional on the proxy, so the property
        // is double-optional — flatten before unwrapping.
        if let contentType = proxy.textContentType.flatMap({ $0 }) {
            let blockedContent: [UITextContentType] = [
                .password, .newPassword, .oneTimeCode, .URL, .emailAddress,
            ]
            if blockedContent.contains(contentType) {
                return false
            }
        }
        return true
    }

    /// Honors `textDocumentProxy.keyboardAppearance` so a dark-mode host app
    /// gets the dark keyboard even when the system appearance is light
    /// (matches stock iOS keyboard behavior).
    private func applyKeyboardAppearance() {
        let appearance = textDocumentProxy.keyboardAppearance ?? .default
        let style: UIUserInterfaceStyle
        switch appearance {
        case .dark: style = .dark
        case .light: style = .light
        default: style = .unspecified
        }
        if keyboardView.overrideUserInterfaceStyle != style {
            keyboardView.overrideUserInterfaceStyle = style
        }
    }
}

// MARK: - KeyboardViewDelegate

extension EchosKeyboardViewController: KeyboardViewDelegate {

    func keyboardView(
        _ view: KeyboardView, didTapCharacter char: String, at normalizedTouch: CGPoint?
    ) {
        // Any non-space, non-backspace input invalidates the smart
        // double-space window. Letters / digits / accents all reset.
        doubleSpacePeriod.reset()
        // Sentence punctuation commits a pending autocorrect exactly like
        // space does ("teh." becomes "the."). The commit reads the word's
        // touch buffer, so only reset it once the word has ended.
        if char.count == 1, let c = char.first, Self.autocorrectTriggers.contains(c),
           commitWithAutocorrect(separator: char) {
            currentWordTouches.removeAll()
            applyContextualContraction(separator: char)
            applyAutoCap()
            refreshSuggestions()
            return
        }
        if char.count == 1, let c = char.first,
           SpacingAndPunctuations.isWordSeparator(c) {
            observeSeparatorCommit()
        }
        // Typing past an autocorrect ends its one-shot revert window.
        lastAutocorrect = nil
        pendingRevert = nil
        recordTouch(forCommitted: char, at: normalizedTouch)
        textDocumentProxy.insertText(char)
        // A separator ends the previous word too, so it can trigger a
        // context-aware confusable fix even when the current word wasn't
        // autocorrected ("ill be." — "be" is valid, so no commit fired above).
        if char.count == 1, let c = char.first,
           SpacingAndPunctuations.isWordSeparator(c) {
            applyContextualContraction(separator: char)
        }
        // iOS does NOT call `textDidChange` after our own `insertText`
        // (only for host-driven changes), so we run the auto-cap pass
        // inline here. Without this, typing ". " in the numbers layout
        // never lifts the shift state and the next letter stays lowercase.
        applyAutoCap()
        refreshSuggestions()
    }

    /// Runs autocorrect for the in-progress word, committing the corrected
    /// word plus `separator` when the engine is confident. Returns true when
    /// it handled the commit. Shared by the space, punctuation, and return
    /// paths (§5.10).
    private func commitWithAutocorrect(separator: String) -> Bool {
        guard settings.autocorrect,
              keyboardView.currentMicState == .idle,
              suggestionsAllowed(for: textDocumentProxy) else { return false }
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        let after = textDocumentProxy.documentContextAfterInput ?? ""
        let word = SuggestionEngine.currentWord(beforeCursor: before, afterCursor: after)
        guard !word.isEmpty,
              word.lowercased() != autocorrectSuppressedWord?.lowercased() else {
            return false
        }
        let previousWord = SuggestionEngine.previousWord(
            beforeCursor: before, currentWord: word
        )
        let result = suggestionEngine.suggestions(
            for: word,
            previousWord: previousWord,
            casing: Self.casing(forTyped: word),
            touchPoints: touchPoints(matching: word),
            leftContext: SuggestionEngine.leftContext(
                beforeCursor: before, currentWord: word
            )
        )
        // Exact compare: case-only corrections (i -> I, france -> France)
        // must apply too.
        guard result.topIsCorrection,
              let corrected = result.replacement,
              corrected != word else { return false }
        for _ in 0..<word.count { textDocumentProxy.deleteBackward() }
        textDocumentProxy.insertText(corrected + separator)
        lastAutocorrect = SuggestionEngine.LastAutocorrect(
            typed: word, corrected: corrected, separator: separator
        )
        pendingRevert = nil
        autocorrectSuppressedWord = nil
        // The corrected pair feeds prediction learning too.
        if let previousWord, !corrected.contains(" ") {
            userLexicon.observeBigram(previous: previousWord, word: corrected)
        }
        return true
    }

    /// Learning hook (§5.11): a separator is about to end the in-progress
    /// word — feed it to the user lexicon. Unknown words are learned after
    /// two commits; known words strengthen their suggestion weight, and
    /// known word pairs feed next-word prediction.
    private func observeSeparatorCommit() {
        guard keyboardView.currentMicState == .idle,
              suggestionsAllowed(for: textDocumentProxy) else { return }
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        let after = textDocumentProxy.documentContextAfterInput ?? ""
        let word = SuggestionEngine.currentWord(beforeCursor: before, afterCursor: after)
        guard !word.isEmpty else { return }
        let isKnown = correctionEngine.contains(word) || userLexicon.contains(word)
        userLexicon.observeCommit(word: word, isInDictionary: isKnown)
        // Predictions learn only vetted pairs — a typo must never resurface
        // as a suggestion.
        if isKnown,
           let previousWord = SuggestionEngine.previousWord(
               beforeCursor: before, currentWord: word
           ) {
            userLexicon.observeBigram(previous: previousWord, word: word)
        }
        autocorrectSuppressedWord = nil
    }

    func keyboardViewDidTapDelete(_ view: KeyboardView) {
        // A backspace within 1100 ms of a smart `. ` commit reverts it
        // back to a double space — matches LatinIME's "undo correction"
        // behaviour for this specific helper.
        if doubleSpacePeriod.shouldUndoPeriod() {
            // Delete the `. ` we just inserted and put `  ` back in
            // its place. We don't know the exact prior chars for sure
            // (the host may have rewritten them), so we re-read to
            // confirm before mutating.
            let before = textDocumentProxy.documentContextBeforeInput ?? ""
            if before.hasSuffix(". ") {
                currentWordTouches.removeAll()
                textDocumentProxy.deleteBackward()
                textDocumentProxy.deleteBackward()
                textDocumentProxy.insertText("  ")
                applyAutoCap()
                refreshSuggestions()
                return
            }
        }
        // Backspace after an autocorrect (§5.4): delete normally (removing
        // the separator, matching native iOS — the correction itself stays),
        // then offer the quoted original in the strip so one tap restores it.
        if let last = lastAutocorrect {
            lastAutocorrect = nil
            let before = textDocumentProxy.documentContextBeforeInput ?? ""
            if !last.separator.isEmpty,
               before.hasSuffix(last.corrected + last.separator) {
                currentWordTouches.removeAll()
                textDocumentProxy.deleteBackward()
                pendingRevert = last
                applyAutoCap()
                refreshSuggestions()
                return
            }
        }
        pendingRevert = nil
        // Keep the touch buffer aligned with the shrinking word; if it was
        // already empty or desynced, the length-match guard handles it.
        if !currentWordTouches.isEmpty { currentWordTouches.removeLast() }
        textDocumentProxy.deleteBackward()
        applyAutoCap()
        refreshSuggestions()
    }

    func keyboardViewDidHoldDeleteWord(_ view: KeyboardView) {
        lastAutocorrect = nil
        pendingRevert = nil
        currentWordTouches.removeAll()
        deleteWordBackward()
        applyAutoCap()
        refreshSuggestions()
    }

    /// Deletes a contiguous run of trailing whitespace plus the word before
    /// it, falling back to a single character delete when the host doesn't
    /// expose enough context. Mirrors how native iOS escalates a long delete
    /// hold once the per-character repeat has been running for a while.
    private func deleteWordBackward() {
        guard
            let context = textDocumentProxy.documentContextBeforeInput,
            !context.isEmpty
        else {
            textDocumentProxy.deleteBackward()
            return
        }
        let chars = Array(context)
        var idx = chars.count - 1
        var deleteCount = 0
        while idx >= 0, chars[idx].isWhitespace {
            deleteCount += 1
            idx -= 1
        }
        while idx >= 0, !chars[idx].isWhitespace {
            deleteCount += 1
            idx -= 1
        }
        if deleteCount == 0 { deleteCount = 1 }
        for _ in 0..<deleteCount {
            textDocumentProxy.deleteBackward()
        }
    }

    func keyboardViewDidTapSpace(_ view: KeyboardView) {
        // Smart double-space → ". ". Check the two chars before the
        // cursor: if it looks like `<letter|digit|allowed-punct> ` and
        // we're inside the 1100 ms window, swap the trailing space
        // for `. ` (LatinIME §4.5).
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        let tail = Array(before.suffix(2))
        // Smart double-space → ". " runs first and unchanged — it owns the
        // case where the previous keystroke was already a space.
        if doubleSpacePeriod.shouldCommitPeriod(previousChars: tail) {
            lastAutocorrect = nil
            pendingRevert = nil
            currentWordTouches.removeAll()
            textDocumentProxy.deleteBackward()
            textDocumentProxy.insertText(". ")
            doubleSpacePeriod.markPeriodCommitted()
            applyAutoCap()
            refreshSuggestions()
            return
        }
        // Autocorrect-on-space (§5.10) — only when the user enabled it. The
        // commit reads the word's touch buffer, so reset it only afterwards.
        if commitWithAutocorrect(separator: " ") {
            currentWordTouches.removeAll()
            applyContextualContraction(separator: " ")
            doubleSpacePeriod.recordSpaceCommit()
            applyAutoCap()
            refreshSuggestions()
            return
        }
        observeSeparatorCommit()
        lastAutocorrect = nil
        pendingRevert = nil
        currentWordTouches.removeAll()
        textDocumentProxy.insertText(" ")
        applyContextualContraction(separator: " ")
        doubleSpacePeriod.recordSpaceCommit()
        applyAutoCap()
        refreshSuggestions()
    }

    func keyboardViewDidTapReturn(_ view: KeyboardView) {
        doubleSpacePeriod.reset()
        // Return commits a pending autocorrect too, then still performs the
        // newline.
        if commitWithAutocorrect(separator: "\n") {
            currentWordTouches.removeAll()
            applyContextualContraction(separator: "\n")
            applyAutoCap()
            refreshSuggestions()
            return
        }
        observeSeparatorCommit()
        lastAutocorrect = nil
        pendingRevert = nil
        currentWordTouches.removeAll()
        textDocumentProxy.insertText("\n")
        applyContextualContraction(separator: "\n")
        applyAutoCap()
        refreshSuggestions()
    }

    func keyboardViewDidTapGlobe(_ view: KeyboardView) {
        advanceToNextInputMode()
    }

    /// Tap-to-apply (§5.5): replace the in-progress word with the tapped
    /// candidate — no trailing space, the user keeps control of word spacing.
    /// The verbatim slot instead keeps the typed word, learns it, and stops
    /// autocorrect from touching it. With no in-progress word the tap is a
    /// next-word prediction: insert the word plus a space. During a revert
    /// offer the verbatim slot swaps the correction back to the typed word.
    func keyboardView(_ view: KeyboardView, didSelectSuggestion slot: SuggestionSlot) {
        // Selecting a slot replaces or ends the composing word; its per-key
        // touch buffer no longer applies.
        currentWordTouches.removeAll()
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        let after = textDocumentProxy.documentContextAfterInput ?? ""
        if let revert = pendingRevert, slot.isVerbatim {
            pendingRevert = nil
            guard before.hasSuffix(revert.corrected) else { return }
            doubleSpacePeriod.reset()
            for _ in 0..<revert.corrected.count { textDocumentProxy.deleteBackward() }
            textDocumentProxy.insertText(revert.typed)
            userLexicon.recordRevert(typed: revert.typed, corrected: revert.corrected)
            userLexicon.learnNow(revert.typed)
            autocorrectSuppressedWord = revert.typed
            applyAutoCap()
            refreshSuggestions()
            return
        }
        let word = SuggestionEngine.currentWord(beforeCursor: before, afterCursor: after)
        guard !word.isEmpty else {
            if !slot.isVerbatim {
                lastAutocorrect = nil
                pendingRevert = nil
                doubleSpacePeriod.reset()
                textDocumentProxy.insertText(slot.text + " ")
                applyAutoCap()
                refreshSuggestions()
            }
            return
        }
        lastAutocorrect = nil
        pendingRevert = nil
        doubleSpacePeriod.reset()
        if slot.isVerbatim {
            userLexicon.learnNow(word)
            autocorrectSuppressedWord = word
            refreshSuggestions()
            return
        }
        for _ in 0..<word.count { textDocumentProxy.deleteBackward() }
        textDocumentProxy.insertText(slot.text)
        applyAutoCap()
        refreshSuggestions()
    }

    /// Spacebar cursor-drag (§5.1): move the caret without inserting a space.
    func keyboardView(_ view: KeyboardView, moveCursorBy offset: Int) {
        currentWordTouches.removeAll()
        textDocumentProxy.adjustTextPosition(byCharacterOffset: offset)
    }

    /// Spacebar cursor-drag vertical (§5.1). The keyboard proxy exposes no
    /// text geometry, so we move between newline-delimited lines on a
    /// best-effort basis, preserving the caret's column where the target line
    /// is long enough. Soft-wrapped visual lines are invisible to us.
    func keyboardView(_ view: KeyboardView, moveCursorVerticallyBy lines: Int) {
        currentWordTouches.removeAll()
        guard lines != 0 else { return }
        for _ in 0..<abs(lines) {
            if lines < 0 { moveCaretUpOneLine() } else { moveCaretDownOneLine() }
        }
    }

    /// Caret's column = characters since the last newline in the text behind it.
    private func currentColumn(in before: String) -> Int {
        if let nl = before.lastIndex(of: "\n") {
            return before.distance(from: before.index(after: nl), to: before.endIndex)
        }
        return before.count
    }

    private func moveCaretUpOneLine() {
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        let col = currentColumn(in: before)
        guard let curLineStart = before.lastIndex(of: "\n") else {
            // Already on the first line — clamp to its start.
            if !before.isEmpty {
                textDocumentProxy.adjustTextPosition(byCharacterOffset: -before.count)
            }
            return
        }
        let prevChunk = before[..<curLineStart]
        let prevLineStart = prevChunk.lastIndex(of: "\n").map { prevChunk.index(after: $0) }
            ?? prevChunk.startIndex
        let prevLineLength = prevChunk.distance(from: prevLineStart, to: prevChunk.endIndex)
        let targetCol = min(col, prevLineLength)
        let offset = -(col + 1 + (prevLineLength - targetCol))
        textDocumentProxy.adjustTextPosition(byCharacterOffset: offset)
    }

    private func moveCaretDownOneLine() {
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        let after = textDocumentProxy.documentContextAfterInput ?? ""
        let col = currentColumn(in: before)
        guard let nlIdx = after.firstIndex(of: "\n") else {
            // Already on the last line — clamp to its end.
            if !after.isEmpty {
                textDocumentProxy.adjustTextPosition(byCharacterOffset: after.count)
            }
            return
        }
        let remainderOfCurLine = after.distance(from: after.startIndex, to: nlIdx)
        let nextLineStart = after.index(after: nlIdx)
        let nextLineEnd = after[nextLineStart...].firstIndex(of: "\n") ?? after.endIndex
        let nextLineLength = after.distance(from: nextLineStart, to: nextLineEnd)
        let targetCol = min(col, nextLineLength)
        let offset = remainderOfCurLine + 1 + targetCol
        textDocumentProxy.adjustTextPosition(byCharacterOffset: offset)
    }

    /// Recapitalize-on-selection (§4.7). With text selected, shift replaces
    /// the selection with the next case form (lower → Title → UPPER) and
    /// returns true so the view skips its shift-state cycle. iOS can't
    /// re-select, so a follow-up shift tap continues the rotation by deleting
    /// and re-inserting our own run — but only while that run is still intact
    /// immediately before the cursor (any typing or cursor move ends it).
    /// Returns false (normal shift) when there's nothing to recapitalize.
    func keyboardViewDidTapShift(_ view: KeyboardView) -> Bool {
        if let selection = textDocumentProxy.selectedText, !selection.isEmpty {
            guard let next = RecapitalizeEngine.nextCase(selection) else { return false }
            doubleSpacePeriod.reset()
            textDocumentProxy.insertText(next)  // replaces the selection
            recapitalize.begin(inserted: next)
            return true
        }
        guard recapitalize.active,
              !recapitalize.lastInserted.isEmpty,
              let before = textDocumentProxy.documentContextBeforeInput,
              before.hasSuffix(recapitalize.lastInserted),
              let next = RecapitalizeEngine.nextCase(recapitalize.lastInserted)
        else {
            recapitalize.reset()
            return false
        }
        for _ in 0..<recapitalize.lastInserted.count {
            textDocumentProxy.deleteBackward()
        }
        textDocumentProxy.insertText(next)
        recapitalize.begin(inserted: next)
        return true
    }

    /// Long-press on the emoji key surfaces the system keyboard picker
    /// (same list iOS shows when you long-press the stock globe key). The
    /// short tap on the smiley now opens the in-keyboard emoji picker, so
    /// long-press is the remaining path to switch to a different system
    /// keyboard.
    func keyboardView(_ view: KeyboardView, didLongPressEmojiFrom sourceView: UIView) {
        handleInputModeList(from: sourceView, with: UIEvent())
    }

    /// Toggles recording from the top-bar record button. Tap-to-start begins
    /// capture; tap-to-stop flushes the WAV and hands it off to the main app
    /// listener for transcription.
    ///
    /// Before starting, we ping the main app over the App Group IPC channel.
    /// iOS keyboard extensions cannot launch the host app, so a force-killed
    /// Echos app would silently swallow the audio and time out 10 seconds
    /// later. Pinging first lets us surface a clear "open Echos" prompt
    /// immediately and avoid wasting recording time.
    ///
    /// The IPC channel (App Group container + Darwin notifications) only works
    /// when the user has granted Full Access. Without it the ping can never
    /// reach the app, so we check that first and point the user at the real
    /// fix instead of a misleading "open Echos" prompt.
    func keyboardViewDidToggleRecord(_ view: KeyboardView) {
        currentWordTouches.removeAll()
        if isCurrentlyRecording {
            // Hand off to the main app to stop + transcribe. The result (or a
            // timeout) flows back through ipcClient's result/error callbacks.
            view.setMicState(.transcribing)
            stopMetering()
            ipcClient.requestRecordStop()
            return
        }

        guard hasFullAccess else {
            keyboardView.showOpenAppPrompt(
                "Enable Full Access in Settings to use voice typing"
            )
            return
        }

        // Always confirm the app is actually alive and ready with a ping before
        // recording. A session marker alone is NOT proof: it can outlive the app
        // (iOS suspends/jetsams a backgrounded app, or the user force-quits). The
        // pong reports `armed` = the capture engine is live now (or the app is
        // foreground and can start it on demand).
        ipcClient.pingMainAppWithRetry { [weak self] alive, armed in
            guard let self = self else { return }
            // Record only when the app is alive AND truly armed. If it's suspended
            // (!alive) or alive-but-not-armed (backgrounded with no live engine — a
            // fresh background mic start fails with CoreAudio 2003329396), bring
            // Echos to the foreground to arm: opening the app runs the deep link →
            // armSession while foreground, where engine.start succeeds. The user
            // swipes back and the next tap records.
            guard alive && armed else {
                let opened = self.openMainAppForVoiceSession()
                self.keyboardView.showOpenAppPrompt(
                    opened
                        ? "Opening Echos to start voice typing — then swipe back"
                        : "Open Echos to start voice typing"
                )
                return
            }
            self.beginRecording()
        }
    }

    /// Opens the Echos app via its `echos://voice-session` URL so it can arm a
    /// hot-mic session (the app captures on the keyboard's behalf — iOS forbids
    /// the extension from recording, and can't wake a suspended app for us).
    ///
    /// iOS gives keyboard extensions no *supported* way to open their container
    /// app, so this walks the responder chain to `UIApplication.open` — the same
    /// unsupported-but-shipping technique voice keyboards like Wispr Flow and
    /// AQUA Voice use. Returns whether an open was attempted; on false the caller
    /// falls back to a manual "open Echos" prompt.
    @discardableResult
    private func openMainAppForVoiceSession() -> Bool {
        guard let url = URL(string: "echos://voice-session") else { return false }
        let opener = #selector(UIApplication.open(_:options:completionHandler:))
        var responder: UIResponder? = self
        while let current = responder {
            if current.responds(to: opener),
               let application = current as? UIApplication {
                application.open(url, options: [:], completionHandler: nil)
                return true
            }
            responder = current.next
        }
        // Fallback: the extension context opener (documented for Today
        // extensions; attempted in case the responder chain didn't expose
        // UIApplication on this iOS version).
        if let context = extensionContext {
            context.open(url, completionHandler: nil)
            return true
        }
        return false
    }

    private func beginRecording() {
        keyboardView.setMicState(.recording)
        startMetering()
        ipcClient.requestRecordStart()
    }

    /// Polls the app-published input level at display rate and feeds the
    /// waveform. The waveform's own smoothing absorbs the polling cadence, and a
    /// nil read (app hasn't written yet) simply leaves the last level in place.
    private func startMetering() {
        stopMetering()
        keyboardView.setAudioLevel(0)
        meterTimer = Timer.scheduledTimer(
            withTimeInterval: 1.0 / 30.0, repeats: true
        ) { [weak self] _ in
            guard let self = self else { return }
            if let level = self.ipcClient.readMeterLevel() {
                self.keyboardView.setAudioLevel(level)
            }
        }
    }

    private func stopMetering() {
        meterTimer?.invalidate()
        meterTimer = nil
    }

    /// Tracks whether a recording is in progress. The view's mic state is the
    /// source of truth — recording itself happens in the main app, so there's
    /// no local recorder to query.
    private var isCurrentlyRecording: Bool {
        keyboardView.currentMicState == .recording
    }
}
