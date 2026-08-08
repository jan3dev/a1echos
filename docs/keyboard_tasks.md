# Keyboard Parity — LatinIME Feature Extraction (remaining work)

A deep dive into AOSP LatinIME (`/Users/tw/dev/jan3/LatinIME`) to extract every
"hidden" behavior that makes a soft keyboard feel forgiving and intelligent.
Each section names the feature, cites the LatinIME source, lists the relevant
thresholds, describes our current iOS/Android state, and proposes a parity
action with a priority.

Citations are `file:line` relative to the LatinIME repo unless noted.

> **Status:** the bulk of the parity work has shipped — full-surface hit-detection
> tiling + per-row Y bias, auto-cap, smart double-space→period, caps-lock via
> double-tap/long-press shift, recapitalize-on-selection, symbols auto-return,
> the suggestion strip + autocorrect (with backspace revert), spacebar cursor
> drag, the period punctuation popup, and the multi-row accent popup. The
> completed sections have been removed; this file now tracks only what's left.

---

## Priority key

- **P0** — table stakes for typing accuracy/feel; gate any 1.0 release.
- **P1** — substantial UX upgrades that users notice immediately once added.
- **P2** — nice-to-have, deeper polish, or features that require a
  suggestion/dictionary backend we don't have yet.
- **SKIP** — confirmed missing from LatinIME or out of scope.

---

## TL;DR — what's still open

1. **Dynamic key resizing by language model is a myth.** AOSP LatinIME does
   not enlarge any key's touch zone based on predicted-next-key. All hit
   geometry is static once a layout is loaded. The smart-correction happens
   _after_ the touch, inside the suggestion engine's probabilistic decoder
   (`ProximityInfo` + n-gram). We do not need to chase a feature that
   doesn't exist; if we want it, we'd be inventing it. See §1.7.

2. **Remaining capabilities, in rough priority order:** field-type adaptive
   layouts are now done (§9 — numeric/decimal pads, contextual letter rows,
   iOS twitter/webSearch, Android two-page phone pad; datetime deferred);
   long-press space → IME picker is now done on Android (§3.9, skipped on iOS)
   and the accent/symbol popover tables are iOS-matched on both platforms
   (§3.3). Remaining: shift-chord detection (§4.1), sliding modifier
   input (§3.5), locale-aware accent
   variants (§3.3), phantom space (§4.4) + smart punctuation (§4.6), next-word
   prediction (§5.6) + personal-dictionary learning (§5.8/§5.9), gesture
   typing (§2).

3. **Confirmed out of scope / myth:** dead keys (§3.10), dynamic key resizing by
   LM (§1.7 / §5.7), phrase gestures across spaces (§2.9), bogus-move detector
   (§1.9), important-notice strip (§5.11).

---

# 1. Hit detection & touch correction

## 1.2 Proximity grid (precomputed nearest-keys per cell)

**LatinIME**: A `32 × 16` cell grid covers the keyboard. Each cell
holds the precomputed list of keys within `1.2 × mostCommonKeyWidth`
of its center, capped at 16 neighbors. `getNearestKeys(x, y)` is an
O(1) array index. `ProximityInfo.java:38-75, 244-404`.

**Constants**: `config_keyboard_grid_width=32`, `config_keyboard_grid_height=16`
(`config-common.xml:94-95`), `SEARCH_DISTANCE = 1.2f`, `MAX_PROXIMITY_CHARS_SIZE = 16`.

**Our state**: We scan all keys linearly (~30 keys × pointer count).
Not a measured perf problem at our key count, but worth knowing
exists when we hit gesture typing.

**Action**: Defer. Build the grid only if/when we add gesture typing
(thousands of point lookups along a stroke makes O(1) lookup worth
it). For tap input, the linear scan is fine.
**Priority**: P2 (only with §2).

---

## 1.7 Dynamic key resizing by language model — THE MYTH

**LatinIME**: **Does not exist.** Searched `expandKey`,
`adjustHitArea`, `biasedKey`, `weightedKey`, `enlarge` — no matches.
`setProximityInfoNative` is only called from the `ProximityInfo`
constructor; no runtime updater. Sweet spots are static per layout.

The "correction" the user feels is entirely in the suggestion engine:
a slightly-off-target tap can still produce the intended word because
`ProximityInfo` exposes nearby keys to the dictionary decoder, which
ranks candidates by spatial proximity × n-gram score. The visible /
effective hit-box of "h" is **not** enlarged because the model thinks
"hello" is coming.

**Action**: Drop this feature from the wishlist. If we eventually
want it, it would be an original invention — and a fragile one,
because users build muscle memory off static hit zones. The safer
analogue is what LatinIME does: pipe touch coordinates + dictionary
hypotheses into the suggestion ranker (see §5.6+).

**Priority**: SKIP.

---

## 1.8 Multi-touch arbitration (phantom-up)

**LatinIME**: `PointerTrackerQueue` is a FIFO of active pointers.
Three rules: (a) a new modifier-down releases everything older;
(b) regular up flushes older non-modifier pointers via
`onPhantomUpEvent`; (c) modifier up flushes everything except itself.
`PointerTrackerQueue.java:95-220`, `PointerTracker.java:937-954`.

**Our state**: iOS and Android both maintain a per-pointer state map.
We don't have "phantom up" — if iOS drops a pointer's `touchesEnded`
we'd hold a stale entry. UIKit is generally reliable here, but a
defensive flush on layout rebuild already exists (`cancelAllActivePointers`).

**Action**: Defensive cleanup is enough for our key count. Don't
build a full queue model unless we hit observed stuck-key bugs.
**Priority**: P2 / monitor.

---

## 1.9 Bogus-move + touch-noise filtering

**LatinIME**: Tablet-only hack to compensate for spurious moves
between down/up. `BogusMoveEventDetector` thresholds in key-diagonal
fractions (0.53 / 1.14). Plus a 40 ms / 12.6 dp touch-noise filter on
`onDownEvent` that drops a new down landing too close in space and
time to a previous up.
`BogusMoveEventDetector.java:34-72`, `config-common.xml:96-97`,
`PointerTracker.java:622-634`.

**Our state**: None.

**Action**: Skip the bogus-move detector (tablet-only, capacitive
screens don't need it). Consider the touch-noise filter on iOS for
the rare case where a tap-then-immediate-double-tap registers two
down events for one finger.
**Priority**: P2.

---

# 2. Gesture typing (glide typing)

We don't have gesture typing today. If we want it, here's the spec —
otherwise this whole section is P2/SKIP.

## 2.1 Activation

**LatinIME**: Two-stage. (a) A "fast move" must be detected:
`pixelsPerSec > 1.5 × keyWidth/sec` (`GestureStrokeRecognitionParams.java:65`).
(b) From the fast-move point, accumulate time + distance until both
exceed dynamic thresholds. Thresholds _decay_ over 450 ms after the
last keystroke: from `300 ms / 6.0 × keyWidth` down to `20 ms / 0.35 × keyWidth`
(`Params.java:64-70`).
**Why dynamic**: prevents accidental gestures while the user is
flicking between keys.

## 2.2 Sampling

- Recognition keeps a point only if `distance from last kept > (1/6) × keyWidth`.
- Drawing keeps every event (sampling min distance = 0 dp default).
- `GestureStrokeRecognitionPoints.java:272-290`, `Params.java:72`.

## 2.3 Hermite smoothing

- Cubic Hermite spline across kept points. Tangents inferred from
  neighbor offsets. Endpoints use mirror-image fallback.
  `HermiteInterpolator.java:79-160`.
- Segments per interval = max(by-angle, by-distance), capped at 4.
  Angle threshold = 15°.
- `GestureStrokeDrawingParams.java:38-40`.

## 2.4 Velocity & "user paused here" signal

- Slowdown below `5.5 × keyWidth/sec` advances the incremental-recognition
  cursor. Fast = collect, slow = "likely letter pass, recognize now."
  `GestureStrokeRecognitionPoints.java:292-303`, `Params.java:74`.
- Recognition rate-limited to once per 100 ms (`Params.java:73`).
- A timer duplicates the last point on `BatchInputArbiter` ticks so a
  pause-with-no-events still produces a "still pressing here" sample.

## 2.5 Trail rendering

- Offscreen ARGB_8888 bitmap, `PorterDuff.SRC` per frame.
- Alpha: full for `mFadeoutStartDelay = 100 ms`, then linear to zero
  over `mFadeoutDuration = 800 ms`. Total linger = 900 ms.
- Width: linear from `10 dp` (head) to `2.5 dp` (tail).
- Animation cadence: 20 ms (`config-common.xml:72-74, 128-129`).
- Drawn as `RoundedLine` segments between samples.

## 2.6 Floating preview text

- Top suggestion centered horizontally on fingertip, offset 73 dp
  upward, clamped to display width. `GestureFloatingTextDrawingPreview.java:156-183`,
  `config.xml:84`.

## 2.7 Out-of-area cancel

- If `y < -0.25 × keyboardHeight` (i.e. finger drifted ~25% above
  the top row), `cancelBatchInput` fires. The 25% slack is so users
  can curve above row 1 without dropping the gesture.
  `GestureStrokeRecognitionPoints.java:36, 82`.

## 2.8 Multi-touch

- Each `PointerTracker` owns its own arbiter + recognition points,
  but the aggregated stroke buffer is static across trackers.
- Two-finger gestures contribute to one batch (first finger leads).

## 2.9 Multi-word phrase gestures

- **Not implemented in AOSP.** Gesture ends on `ACTION_UP`; no
  near-space-pause detection.

## 2.10 Cancel-vs-commit

- Commit is the default. Cancel only via: out-of-area, explicit
  `ACTION_CANCEL`, gesture never qualified as started, or
  `mIsTrackingForActionDisabled`.

**Action**: Implementing gesture typing is a 2–4 week project that
also requires a candidate-ranking engine (the recognizer model
itself). Cite this section if we ever decide to take it on.
**Priority**: P2 (deferred; not core to "feel right" typing).

---

# 3. Per-key behavior

## 3.3 More-keys popup (accent variants) — locale data outstanding

**LatinIME**: Long-press surfaces a mini-keyboard of variants.

- Default max 5 columns (`config-common.xml:52`).
- Default is centered under the parent key; other slots fan
  right-then-left or follow `!fixedColumnOrder!N` markers.
- Anchored above the parent key (`MoreKeysKeyboardView.java:121-149`).
- Fade in 0 ms, fade out 100 ms.
- Variants chars from `morekeys_*` resource indirections per locale.
- Sliding drag onto a variant + release commits it. Release outside
  → dismiss with no input.
- Detector slide-allowance: 63.36 dp portrait / 53.76 dp landscape.

**Our state**: `KeyVariantsView` (iOS) / `KeyOverlayView` (Android) with
slide-pick and **multi-row wrapping** are shipped. Both platforms now carry
the same table (20 letters / 105 accents plus the 11 symbol popovers) —
Android's `AccentVariants.kt` was expanded to match
`KeyboardLayout.swift`'s `AccentVariants` + `PunctuationVariants`. The set is
still hard-coded to English-with-international-Latin, not locale-driven.

**Action** (remaining):

1. Locale-aware variants: ship the LatinIME `morekeys_*` strings for
   ES/FR/DE/IT/PT at minimum, since our app already targets
   multi-language users.
2. Confirm slide-allowance equivalent — verify the finger can drift
   ~50 dp outside the popup row before deselecting.

**Priority**: P2 (locale data).

---

## 3.5 Sliding key input (modifier chord)

**LatinIME**: Press shift, then drag to a letter, release shift — the
letter is committed shifted, and shift auto-drops. Hysteresis
multiplied during slide; long-press timeout × 3.
`PointerTracker.java:142-145, 697-708, 825-876`,
`SlidingKeyInputDrawingPreview.java`.

**Our state**: We block sliding from modifier keys
(`KeyboardView.swift:592-598` — only character→character slides). A
press on shift + drag to `a` does not produce `A`.

**Action**: Allow shift → letter slide for one-shot capital
shifting. The implementation: if the original pointer is on shift,
keep `shiftState = .on` while dragging, commit on release of the
_letter_ pointer, then drop shift back to `.off`.
**Priority**: P2.

---

## 3.6 Key preview popup (typewriter balloon)

**LatinIME**: Press → balloon shows above key with the typed char.

- Animations: show-up 17 ms (0.98→1.0 scale, decelerate), dismiss
  53 ms (1.0→0.94, accelerate), linger 70 ms after release.
- Suppressed during gesture, during a 1000 ms window after a batch
  input ends, and for keys flagged `noKeyPreview` (delete, space,
  modifiers, etc.).
- `config-common.xml:35-42`, `KeyPreviewChoreographer.java:144-167`.

**Our state**: iOS `KeyPreviewView` with `previewHideDelay: 0.07`
(70 ms). Android `KeyOverlayView` now matches via
`EchosKeyboardView.PREVIEW_HIDE_DELAY_MS` (it used to clear the balloon the
instant the last pointer lifted, which strobed during roll-typing). No
suppression post-gesture (we have no gesture).

**Action**: Add the "no preview after gesture" gate when we add
gesture typing. Verify our show-up time isn't longer than LatinIME's
(scaled from 17 ms). Otherwise good.
**Priority**: P2 / verify timing.

---

## 3.7 Multi-char preview / combining diacritics

**LatinIME**: `KeyPreviewView.setTextAndScaleX()` auto-shrinks
`textScaleX` to fit when the preview text exceeds the bubble's
intrinsic max width — used for `.com` output keys and 2-codepoint
diacritic composition feedback. `KeyPreviewView.java:72-93`.

**Our state**: We render a single char. A combining-diacritic
intermediate state (e.g. dead-key `^` followed by `e` → `ê`) has no
visible composition indicator.

**Action**: Skip until we add dead-key combining (we don't have it).
See §3.10.
**Priority**: P2.

---

## 3.8 Typing time recorder / fast-typing heuristics

**LatinIME**: Tracks last typing time. `isInFastTyping` = last
letter < 500 ms ago. Used by:

- Suppress key preview for 1000 ms after a gesture.
- Gesture detector tightens thresholds during fast typing.
- Bogus-event recovery in `PointerTracker.dragFingerFromOldKeyToNewKey`.
- Long-press timeout is **not** adapted by speed.

`TypingTimeRecorder.java:19-72`, `config-common.xml:76`.

**Our state**: We don't track typing speed.

**Action**: Add only if we ship gesture typing (§2) or aggressive
auto-correction. Adds complexity; small isolated value.
**Priority**: P2.

---

## 3.9 Long-press space

**LatinIME**: Long-press space (`enableLongPress` flag) calls
`onCustomRequest(CUSTOM_CODE_SHOW_INPUT_METHOD_PICKER)` — opens the
system IME picker.
`PointerTracker.java:1035`, `key_styles_common.xml:105`.

**Our state**: Android ships it — `KeyType.SPACE` schedules the same
`scheduleKeyboardPickerLongPress` as the globe key, which matters because the
numbers/symbols pages and the pads drop the globe but keep a spacebar. iOS
does **not**: its 0.3 s space long-press is already the cursor-drag /
trackpad gesture, and the emoji-key long-press covers the picker there.

**Action**: Done on Android; iOS deliberately skipped (gesture conflict).
**Priority**: DONE (Android) / SKIP (iOS).

---

## 3.10 Combining (dead) keys

**LatinIME**: `DeadKeyCombiner` maintains a pending dead-char
sequence. On the next non-dead char, dead chars are converted to
their combining-mark codepoint (e.g. ´ U+00B4 → U+0301) and combined
via NFC normalization. Non-combining fallbacks via
`Data.getNonstandardCombination` (e.g. `o + stroke → ø`).
`event/DeadKeyCombiner.java`.

**Our state**: None. The accent-variants popup is the only way to
type accented chars.

**Action**: Skip. Accent variants cover the common case; dead keys
matter mostly for hardware keyboards.
**Priority**: SKIP (unless a user complains).

---

# 4. State machine: shift, caps, spaces, punctuation

## 4.1 Shift state machine — chord detection outstanding

**LatinIME**: Six alphabet shift states:

- `UNSHIFTED`
- `MANUAL_SHIFTED` (user tapped shift)
- `MANUAL_SHIFTED_FROM_AUTO` (was auto-shifted, then tapped — second tap drops to lower)
- `AUTOMATIC_SHIFTED` (auto-cap)
- `SHIFT_LOCKED` (caps lock)
- `SHIFT_LOCK_SHIFTED` (shift pressed while caps-locked = temporary unshift)

Plus a 5-state physical-shift-key tracker (`RELEASING`, `PRESSING`,
`CHORDING`, `PRESSING_ON_SHIFTED`, `IGNORING`).

`AlphabetShiftState.java:25-30`, `ShiftKeyState.java:21-69`,
`KeyboardState.java:487-597`.

**Our state**: The visual/logical states are shipped — `off`, `on`,
`capsLock`, `automatic` (auto-cap) and `manualFromAuto` are all
distinct, plus double-tap/long-press caps lock. **Chord detection is
the remaining gap.**

**Action** (remaining): Wire chord detection — shift down → letter down
(without shift up) → mark shift as `CHORDING`; on shift up, restore to
UNSHIFT or AUTO regardless of letters typed in between. (This overlaps
the sliding-modifier work in §3.5.)
**Priority**: P1.

---

## 4.4 Auto-space / phantom space

**LatinIME**: 5 space states:

- `NONE`
- `DOUBLE` — just fired double-space-to-period, enables backspace-undo.
- `SWAP_PUNCTUATION` — strip-tap swapped a weak space with punctuation.
- `WEAK` — space after a committed suggestion, eligible for swap.
- `PHANTOM` — pending space, not yet inserted.

Phantom space is _set_ after committing a suggestion or
auto-correction. Phantom space is _consumed_ when the next typed
char is non-word-connector — at which point a real space gets
inserted automatically.

`SpaceState.java`, `InputLogic.java:248-250, 805-812, 2020-2026`.

**Suppressed when** input type is email/password/URL or current
language has no spaces.

**Our state**: None. (The suggestion strip is now shipped, so this is
no longer blocked.)

**Action**: Implement phantom space now that the strip exists — it's
meaningful after picking a suggestion or an autocorrect.
**Priority**: P2.

---

## 4.6 Smart punctuation (swap weak space)

**LatinIME**: When committing punctuation, the engine strips or
swaps a preceding weak-space depending on the punctuation class:

- "Usually preceded by space" `( [ { &` → keep the space, no strip.
- "Usually followed by space" `. , ; : ! ? ) ] } &` → swap, drop the
  preceding space and emit `<punct><space>`.

`InputLogic.java:880-983`, `donottranslate-config-spacing-and-punctuations.xml:26-28`.

**Our state**: None.

**Action**: Implement alongside phantom space (§4.4) — the swap is only
meaningful when the space came from a strip pick. For keyboard-typed
punctuation the user already controls the order, so it's mostly a no-op
without §4.4.
**Priority**: P2.

---

# 5. Smart input & suggestions

The suggestion strip + spell-checker-backed autocorrect (with
backspace-revert) and cursor/selection awareness are shipped. What's
left here is the deeper prediction/dictionary backend.

## 5.6 Predictive next-word (no prefix)

**LatinIME**: After committing a word with `SpaceState.PHANTOM`,
the strip shows predictions with no typed prefix.
Built from `NgramContext` of previous words.
`Suggest.java:269-276`.

**Action**: Tied to §4.4 + §5.9. Requires an n-gram source the system
spell checker doesn't provide.
**Priority**: P2.

---

## 5.7 Dynamic key resizing by language model

**Verdict**: Myth — see §1.7. Drop.
**Priority**: SKIP.

---

## 5.8 Personal dictionary (user history)

**LatinIME**: `UserHistoryDictionary` records typed words +
n-gram context with a forgetting curve. `isValidWord = false` so
words never count as authoritative dictionary entries, only as
suggestion-ranking signals. Unlearn fires on backspace-into-word,
rejecting a batch suggestion, reverting an auto-correction.
`UserHistoryDictionary.java`, `InputLogic.java:1229, 1665`.

**Action**: A simple SQLite-backed "recently typed" table with
timestamp decay scores covers most of the value. Stay strictly
on-device; no upload.

Privacy: we run encrypted SQLCipher already. This table would live
inside that store.
**Priority**: P2.

---

## 5.9 Bigram / trigram / n-gram

**LatinIME**: Up to 4-gram (3 prev words). `BinaryDictionary.java:61`.
**Action**: Defer to §5.8.
**Priority**: P2.

---

## 5.11 Important-notice / punctuation-suggestion strip modes

**LatinIME**: The strip can show a contacts-permission notice
instead of suggestions; or punctuation marks for one-tap insertion
when `PHANTOM` space is pending.
`ImportantNoticeUtils.java`, `PunctuationSuggestions.java`.

**Action**: Skip — out of scope.
**Priority**: SKIP.

---

# 6. Quick-reference constants (remaining)

| Constant              | LatinIME value  | Our value  | Action              |
| --------------------- | --------------- | ---------- | ------------------- |
| Long-press in sliding | × 3             | n/a        | Add when §3.5 lands |
| Key preview show-up   | 17 ms           | unmeasured | Verify              |
| Key preview linger    | 70 ms           | 70 ms      | DONE (both)         |
| Touch-noise time/dist | 40 ms / 12.6 dp | n/a        | P2                  |
| Proximity grid        | 32 × 16         | linear     | Defer until gesture |

---

# 7. Implementation roadmap (remaining order)

**Field-type layouts (P0 → P1, §9):**

1. Android 4×4 numeric pad for `TYPE_CLASS_NUMBER` (P0); iOS `numberPad` +
   `decimalPad` (P0).
2. Contextual letter rows (email/URL) on both platforms (P1 — DONE: iOS
   `numbersAndPunctuation` auto-open + URL/email variants, Android email/URI
   variants + numeric-password pad); iOS `twitter`/`webSearch` (P2 — DONE);
   Android-only two-page phone pad (P2 — DONE; iOS forces the system pad, §9.1).

**Polish (P1):**

3. Shift-chord detection (§4.1) — overlaps sliding-modifier input.
4. Sliding modifier input: shift → letter slide (§3.5).

**Suggestion backend depth (P2):**

5. Phantom space (§4.4) + smart punctuation (§4.6) on strip picks.
6. Next-word prediction (§5.6) + personal dictionary (§5.8/§5.9).
7. Locale-aware accent variants (§3.3).
8. ~~Long-press space → IME picker (§3.9)~~ — DONE on Android; iOS skipped
   (space long-press is the cursor-drag gesture there).

**Gesture typing (P2):**

9. Glide-typing recognizer (§2). Multi-week project; reconsider need.

**Skip outright:**

- Dead keys (§3.10).
- Dynamic key resizing by LM (§1.7 / §5.7).
- Phrase gestures across spaces (§2.9).
- Bogus-move detector (§1.9).
- Important-notice strip (§5.11).

---

# 8. Files for the remaining work

The parity engines already exist on both platforms — `AutoCapEngine`,
`DoubleSpacePeriod`, `RecapitalizeEngine`, `SpacingAndPunctuations`,
`SuggestionEngine`, `SuggestionStripView`, plus the hit-tiling in
`KeyboardView` / `EchosKeyboardView`. Remaining features land here:

iOS:

- `plugins/keyboard/ios/templates/KeyboardView.swift` — shift chord / sliding
  modifier (§4.1, §3.5), long-press space (§3.9).
- `plugins/keyboard/ios/templates/KeyVariantsView.swift` — locale-aware
  variants (§3.3).
- `plugins/keyboard/ios/templates/SuggestionEngine.swift` — next-word /
  personal dictionary (§5.6, §5.8) if we build the backend.

Android:

- `plugins/keyboard/android/templates/EchosKeyboardView.kt` — shift chord /
  sliding modifier (§4.1, §3.5), long-press space (§3.9).
- `plugins/keyboard/android/templates/AccentVariants.kt` — locale-aware
  variants (§3.3).
- `plugins/keyboard/android/templates/SuggestionEngine.kt` — next-word /
  personal dictionary (§5.6, §5.8) if we build the backend.

---

# 9. Field-type adaptive keyboard layouts

A forgiving keyboard shows the _right keys for the field_: a numeric pad for
amounts, a phone pad for phone numbers, `@`/`.` within reach for email. Both
keyboards already receive the field's declared type but barely act on it.

- **iOS** reads `textDocumentProxy.keyboardType` (a `UIKeyboardType`),
  `.returnKeyType`, and `.textContentType`. Today it uses `keyboardType` only
  to gate suggestions (`EchosKeyboardViewController.suggestionsAllowed`) and
  `returnKeyType` only to relabel the return key — **it never switches the
  layout**, so every field gets QWERTY.
- **Android** reads `EditorInfo.inputType` (class + variation + flags) and
  `imeOptions`. `onStartInputView` maps `TYPE_CLASS_NUMBER`/`TYPE_CLASS_PHONE`
  → `showNumberLayout()` (the row-based 0-9 + symbols page) and everything
  else → `showLetterLayout()`. That is **not** Gboard-accurate: Gboard shows a
  compact numeric pad for number fields and a distinct phone pad for phone
  fields.

> **Manual test harness:** design-system gallery **"Keyboard Layouts"**
> (`src/design-system/keyboard-layouts/KeyboardLayouts.gallery.tsx`, group
> Domain).
> open _Keyboard Layouts_, and focus each field to trigger its layout. Fields
> pin `keyboardType` / `returnKeyType` / `secureTextEntry` / `textContentType`
> / `autoComplete` so the native traits the keyboards read are exercised
> directly. (RN folds iOS-only `keyboardType`s to text on Android — see §9.2.)

## 9.1 iOS — `UIKeyboardType` (the 12 documented virtual keyboards)

**Reference**: Apple HIG _Virtual keyboards_
(`https://developer.apple.com/design/human-interface-guidelines/virtual-keyboards`)
and `UIKeyboardType`. RN `keyboardType` → `UIKeyboardType` 1:1.

| #   | `UIKeyboardType` (RN value)                            | Native layout                                             | Our state                                                     | Action                                                         | Pri      |
| --- | ------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- | -------- |
| 1   | `default` / `asciiCapable` (`default`/`ascii-capable`) | Full QWERTY                                               | ✓ shipped                                                     | —                                                              | —        |
| 2   | `numbersAndPunctuation` (`numbers-and-punctuation`)    | Opens to the numbers/symbols page; ABC returns to letters | ✓ auto-opens `.numbers` on focus (ABC stays)                  | DONE — change-detection open on field focus                    | P1       |
| 3   | `URL` (`url`)                                          | QWERTY with `.` `/` `.com` keys; **Go** return            | ✓ `.urlLetters` (`.`/`/`/`.com`, no space)                    | DONE — Go return already maps                                  | P1       |
| 4   | `numberPad` (`number-pad`)                             | Digits 1–9, 0, delete — no decimal, no return             | ✗                                                             | New `.numberPad` layout (digits-only pad, per provided design) | **P0**   |
| 5   | `decimalPad` (`decimal-pad`)                           | `numberPad` + a `.` key                                   | ✗                                                             | `.numberPad` + decimal key                                     | **P0**   |
| 6   | `asciiCapableNumberPad` (not exposed by RN)            | `numberPad` restricted to ASCII digits                    | ✗                                                             | Same layout as `.numberPad` (we only ever emit ASCII)          | P1       |
| 7   | `phonePad` (`phone-pad`)                               | Digits + `+ * #`, Pause/Wait                              | **System keyboard** — custom keyboards ineligible (see below) | **None** — iOS shows its own pad                               | **SKIP** |
| 8   | `namePhonePad` (`name-phone-pad`)                      | QWERTY by default; alternate page is a phone keypad       | **System keyboard** — custom keyboards ineligible             | **None** — iOS shows its own                                   | **SKIP** |
| 9   | `emailAddress` (`email-address`)                       | QWERTY with `@` and `.` visible (no spacebar shrink)      | ✓ `.emailLetters` (`@`/`.`)                                   | DONE                                                           | P1       |
| 10  | `twitter` (`twitter`)                                  | QWERTY with `@` and `#` visible                           | ✓ `.twitter` (`@`/`#`)                                        | DONE                                                           | P2       |
| 11  | `webSearch` (`web-search`)                             | QWERTY with `.`; **Search** return                        | ✓ `.webSearch` (`.`)                                          | DONE — Search return already maps                              | P2       |

**iOS eligibility — what we DON'T have to build.** Apple's App Extension
Programming Guide forbids third-party keyboards in three cases; iOS silently
swaps in the **system keyboard** instead (this is why a phone-pad field shows
no keyboard-switcher / globe and no Echos mic button):

1. **Secure text entry** (`isSecureTextEntry` — passwords, passcodes).
2. **`UIKeyboardType.phonePad`**.
3. **`UIKeyboardType.namePhonePad`**.

So on iOS we build **no** phone pad, name-phone pad, or password layout — the
OS handles them and our extension never even loads for those fields. That
leaves the eligible numeric pads (`numberPad` / `decimalPad`) and the
contextual letter-row variants as the only iOS work. _Android has no such
restriction_ — its IME is always used (see §9.2). Source: Apple _App Extension
Programming Guide → Custom Keyboard_ (`https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/CustomKeyboard.html`).

**Design note**: the eligible iOS numeric pads follow HIG-specific designs
(distinct from Android's Gboard-style pads); dark + light numpad designs are to
be supplied before building #4–5. These compact pads should drop the
record/mic button and top bar to match the native numeric look — but must keep
a next-keyboard affordance (Apple requires a way to switch keyboards;
today that's the emoji-key long-press).

**Hook-in**: in `EchosKeyboardViewController` (`textDidChange` and on
`viewWillAppear`/`onStartInput`) read `textDocumentProxy.keyboardType`, map it
through a new `layoutMode(for:)`, and call a new
`keyboardView.switchLayout(to:)`. Define the numeric pads (`.numberPad` /
`.decimalPad`) + contextual letter-row variants in `KeyboardLayout.swift`
(mirror the existing `LayoutMode` /
`KeyDefinition` pattern; the row-stack + width-weight builder already supports
arbitrary rows).

## 9.2 Android — Gboard parity (`EditorInfo.inputType`)

**Reference**: developer.android.com _Specify the input method type_;
`android.text.InputType` (class + `TYPE_MASK_VARIATION` + flags). Goal: copy
Gboard as closely as possible.

> **RN caveat**: React Native maps only `number-pad`/`numeric`/`decimal-pad`
> → `TYPE_CLASS_NUMBER` (+ decimal/signed), `phone-pad` → `TYPE_CLASS_PHONE`,
> `email-address` → text|email, `url` → text|uri. The iOS-only `keyboardType`
> values fall back to the text keyboard on Android. So in the test harness the
> `ascii-capable` / `numbers-and-punctuation` / `twitter` / `web-search` /
> `name-phone-pad` rows show QWERTY on Android — expected.

| `inputType` (class · variation · flag)                   | Gboard layout                                                        | Our state                                                                                                          | Action                                                          | Pri    |
| -------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------ |
| `TYPE_CLASS_TEXT` (default)                              | QWERTY                                                               | ✓                                                                                                                  | —                                                               | —      |
| `TEXT` · `VARIATION_EMAIL_ADDRESS` / `WEB_EMAIL_ADDRESS` | QWERTY with `@` and `.` (no comma)                                   | ✓ email variant (`@`/`.`)                                                                                          | DONE                                                            | P1     |
| `TEXT` · `VARIATION_URI`                                 | QWERTY with `/` and `.com`                                           | ✓ URI variant (`/`/`.`/`.com`)                                                                                     | DONE                                                            | P1     |
| `TEXT` · `VARIATION_*PASSWORD`                           | QWERTY, suggestions/autocorrect off                                  | ✓ both off — `computeSuggestionsAllowed` gates the strip **and** autocorrect (`autocorrect && suggestionsAllowed`) | DONE — confirmed                                                | P2     |
| `TYPE_CLASS_NUMBER`                                      | Compact numeric pad; `FLAG_DECIMAL` adds `.`, `FLAG_SIGNED` adds `−` | ✗ — shows the row-based NUMBER page                                                                                | **Add the provided 4×4 numeric pad**; gate `.`/`−` on the flags | **P0** |
| `NUMBER` · `VARIATION_PASSWORD`                          | Stripped numeric pad (digits only)                                   | ✓ digits-only 4×4 (no `−`/`,`/`.`)                                                                                 | DONE                                                            | P1     |
| `TYPE_CLASS_PHONE`                                       | Phone pad: digits + `* # + , ; ( ) - / N P W`, Pause/Wait            | ✓ two-page dial pad (digits + `* #` → `( ) / N Pause , * Wait # + .`)                                              | DONE — **Android-only** (iOS forces the system pad, §9.1)       | P2     |
| `TYPE_CLASS_DATETIME` (+ `DATE` / `TIME`)                | Numeric pad + `/` `:` (+ am/pm for time)                             | ✗ — **deferred** (RN `TextInput` can't produce `TYPE_CLASS_DATETIME`, so it's unreachable from our app)            | Deferred follow-up                                              | P2     |

**Provided numeric-pad design** (the 4×4 auto-pad for `TYPE_CLASS_NUMBER`):

```
1   2   3   −
4   5   6   ␣(space)
7   8   9   ⌫(delete)
,   0   .   ⏎(enter/next)
```

This auto-activates on numeric fields. The **existing 5-column calculator
`NUMPAD_CELLS`** (scrollable `+ − × ÷ ( )` operator stack, reached via the
"1234" key in the symbols page) **stays as-is** per decision — the new pad is a
separate layout, not a replacement.

**Hook-in**: `EchosInputMethodService.onStartInputView` already switches on
`info.inputType and TYPE_MASK_CLASS`. Extend it to route `TYPE_CLASS_NUMBER`
→ `keyboardView.showNumericPadLayout()` (new) and `TYPE_CLASS_PHONE`
→ `keyboardView.showPhonePadLayout()` (new), and inspect
`TYPE_MASK_VARIATION` for the email/URI letter variants. Define the new
layouts in `EchosKeyboardLayout.kt` — the cell-grid infra
(`NumpadCell` / `computeCellKeyRects`) already supports arbitrary grids, so the
4×4 is a new `NumpadCell` list + `FloatArray` column weights.

## 9.3 Priority summary

- **P0**: Android numeric pad (provided 4×4) for `TYPE_CLASS_NUMBER`; iOS
  `numberPad` + `decimalPad`. DONE
- **P1**: iOS `numbersAndPunctuation` auto-open, URL + email letter variants;
  Android email/URI variants, numeric-password pad. DONE
- **P2**: iOS `twitter`, `webSearch` DONE; Android phone pad DONE (Android-only
  two-page dial pad — iOS uses the system pad), password no-autocorrect
  CONFIRMED. Android datetime pad **deferred** — RN `TextInput` can't produce
  `TYPE_CLASS_DATETIME`, so it's unreachable from our app / the gallery harness.
- **SKIP (iOS)**: `phonePad`, `namePhonePad`, secure/password fields — iOS
  forces the system keyboard (§9.1). `asciiCapableNumberPad` is not RN-settable
  and behaves like `numberPad`.

## 9.4 Files for §9 work

iOS:

- `plugins/keyboard/ios/templates/KeyboardLayout.swift` — new `numberPad` /
  `decimalPad` layouts + URL/email/twitter/webSearch letter-row variants. (No
  `phonePad` / `namePhonePad` / password — iOS forces the system keyboard, §9.1.)
- `plugins/keyboard/ios/templates/KeyboardView.swift` — `switchLayout(to:)` +
  rendering for the numeric pads.
- `plugins/keyboard/ios/templates/EchosKeyboardViewController.swift` —
  `keyboardType` → layout mapping on focus.

Android:

- `plugins/keyboard/android/templates/EchosKeyboardLayout.kt` — new numeric /
  phone / datetime layouts + email/URI letter variants.
- `plugins/keyboard/android/templates/EchosKeyboardView.kt` —
  `showNumericPadLayout()` / `showPhonePadLayout()`.
- `plugins/keyboard/android/templates/EchosInputMethodService.kt` — route
  `inputType` class + variation to the new layouts.

> If any of the above adds a **new** Swift/Kotlin template file (rather than
> editing an existing one), it must also be appended to the hardcoded file
> lists in `withIosKeyboardExtension.js` / `withAndroidIme.js`, or it never
> reaches the native build.
