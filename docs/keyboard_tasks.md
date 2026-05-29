# Keyboard Parity — LatinIME Feature Extraction

A deep dive into AOSP LatinIME (`/Users/tw/dev/jan3/LatinIME`) to extract every
"hidden" behavior that makes a soft keyboard feel forgiving and intelligent.
Each section names the feature, cites the LatinIME source, lists the relevant
thresholds, describes our current iOS/Android state, and proposes a parity
action with a priority.

Citations are `file:line` relative to the LatinIME repo unless noted.

---

## TL;DR — Headline findings

1. **Dynamic key resizing by language model is a myth.** AOSP LatinIME does
   not enlarge any key's touch zone based on predicted-next-key. All hit
   geometry is static once a layout is loaded. The smart-correction happens
   _after_ the touch, inside the suggestion engine's probabilistic decoder
   (`ProximityInfo` + n-gram). We do not need to chase a feature that
   doesn't exist; if we want it, we'd be inventing it. See §1.7.

2. **The "forgiving" feel comes from five separate mechanisms** stacked
   together, all static:
   - hitbox extends past the visible rect into inter-key gaps and keyboard
     padding (§1.1, §1.4),
   - +1 px right-edge overlap so no tap falls in "no man's land" (§1.1),
   - 32×16 proximity grid + squared-distance nearest-key selection (§1.2–1.3),
   - per-row Y sweet-spot bias for thumb-tap landing patterns (§1.5),
   - 8 dp hysteresis before a drag transfers the press to a new key (§1.6).

3. **Big missing capabilities in our keyboard, in priority order:**
   auto-cap (§4.2), smart double-space → period (§4.5), caps-lock via
   double-tap-shift (§4.3), symbol-layout auto-return-to-alpha (§4.9),
   per-row sweet-spot bias (§1.5), edge-key hitbox extension (§1.4),
   suggestion strip + auto-correct (§5.5–5.11), gesture typing (§2),
   personal-dictionary learning (§5.8).

4. **Things LatinIME does NOT have that some users associate with it:**
   spacebar-drag cursor (§5.1), swipe-from-backspace word delete (§5.2),
   dynamic key resizing by LM (§5.7), phrase gestures across spaces (§2.9).

---

## Priority key

- **P0** — table stakes for typing accuracy/feel; gate any 1.0 release.
- **P1** — substantial UX upgrades that users notice immediately once added.
- **P2** — nice-to-have, deeper polish, or features that require a
  suggestion/dictionary backend we don't have yet.
- **SKIP** — confirmed missing from LatinIME or out of scope.

---

# 1. Hit detection & touch correction

## 1.1 Hitbox-vs-visible-rect split

**LatinIME**: Every key stores two rects. The _visible_ rect is what's
drawn; the _hitbox_ (`Rect mHitBox`) absorbs the inter-key gap and the
+1 px overlap on the right edge so no tap can land in dead space.
`Key.java:236-238, 270-273`. Gap split is half-on, half-off the visible
key: `mX = x + mHorizontalGap/2`.

**Constants**: `keyHysteresisDistance = 8 dp` phone (`config.xml:25`),
`40 dp` tablet (`values-sw600dp/config.xml:23`).

**Our state**: iOS uses `keyHysteresis: CGFloat = 12.0` already.
Android uses `dpPx(10f)`. Inter-key gap is already absorbed by our
nearest-key fallback (`hitTestKeyButton` on iOS, `findKey` on Android).
We do **not** maintain a separate hitbox/visible rect — we inflate the
visible rect during hit-testing instead, which is equivalent.

**Action**: None. Behavior is equivalent.
**Priority**: ✅ done.

---

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

## 1.3 Nearest-key selection by squared distance

**LatinIME**: Among keys whose hitbox contains the point, pick the
one with smallest `squaredDistanceToEdge(touchX, touchY)`. Ties broken
by higher key code (deterministic for the +1 px right-edge overlap).
`KeyDetector.java:88-115`, `Key.java:940-950`.

**Our state**: iOS `hitTestKeyButton` already does this exactly
(direct-hit fast path → nearest-key fallback constrained to row).
Android `findKey` does the equivalent.

**Action**: None.
**Priority**: ✅ done.

---

## 1.4 Edge-key hitbox extension

**LatinIME**: First key of every row is "marked left edge"; last is
"marked right edge"; top row keys are "marked top edge". Their
hitboxes extend outward to the full keyboard padding so a tap
landing in the outer padding still resolves to the nearest edge key.
`Key.java:581-595`, called from `KeyboardBuilder.java:846, 858, 862`.

**Our state**: We do not extend edge keys' hit zones into the
keyboard's outer padding. A tap landing 2 pt to the left of the `a`
key currently falls through `hitTestKeyButton` (it's outside any
key's frame and the row-constrained fallback caps at `1.5 × height`
distance, which works in practice but isn't deterministic).

**Action**: Inflate the first key's left-hitbox, last key's
right-hitbox, and every top-row key's top-hitbox to the keyboard's
outer padding. Same for the bottom row on iOS (LatinIME omits
bottom-row extension because the system view consumes that space;
we don't have that luxury on a UIInputView).

**Files to touch**:

- `plugins/keyboard/ios/templates/KeyboardView.swift` (`rebuildKeyFrames`
  → expand outermost frames before storing).
- `plugins/keyboard/android/templates/EchosKeyboardView.kt`
  (`computeKeyRects` → wrap row's first/last/top/bottom keys with the
  padding inflation).

**Priority**: P1.

---

## 1.5 Per-row sweet spots (touch position correction)

**LatinIME**: Each key gets a `sweetSpotCenter` and `sweetSpotRadius`
biased by the row index. Empirically calibrated values for QWERTY (holo):

| Row     | correctionY | correctionR |
| ------- | ----------- | ----------- |
| 0 (top) | -0.0006     | 0.158       |
| 1 (mid) | +0.038      | 0.153       |
| 2 (bot) | +0.088      | 0.152       |

`TouchPositionCorrection.java`, `values/touch-position-correction.xml:39-57`.
Values are in fractions of the hitbox height. Positive Y means the
sweet spot is shifted _down_ (compensating for thumb-tip occlusion —
users systematically tap higher than they intend on bottom rows).
**X correction is hardcoded to 0** (`TouchPositionCorrection.java:84-88`).

The current Material themes set `touchPositionCorrectionData = @null`
(`themes-lxx-light.xml:112`), so production AOSP no longer uses this —
the data feeds the _suggestion engine's_ spatial scoring, not direct
hit-detection.

**Our state**: No per-row bias. Bottom-row taps that land in the
inter-row gap currently snap to the wrong row.

**Action**: Two options. (a) Cheap: when the row-constrained
nearest-key fallback fires, prefer the row _below_ an ambiguous touch
on the lower half of the keyboard (mimicking the positive Y bias).
(b) Proper: store a `rowYBias` per row, subtract it from the touch's
Y before hit-testing on rows 2/3.

Recommend (b): on iOS, inside `hitTestKeyButton` apply `effectiveY = y

- rowYBias[row]` when computing squared distance.

**Priority**: P1 — measurable accuracy lift on bottom row.

---

## 1.6 Slide-from-key hysteresis

**LatinIME**: Once a finger lands on key K, dragging within K stays
on K. Only when `squaredDistanceToEdge(x, y) >= keyHysteresisDistance²`
does the finger transfer to a new key. 8 dp on phones. Bigger
multiplier in sliding-modifier mode.
`PointerTracker.java:1080-1116`, `config-common.xml:66`.

**Our state**: iOS uses 12 pt, Android uses 10 dp. Already in.

**Action**: None — values are sensible.
**Priority**: ✅ done.

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
hypotheses into the suggestion ranker (see §5.5+).

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

## 3.1 Long-press timing

**LatinIME**: Default 300 ms. User-adjustable in 10 ms steps from
100 to 700 ms. Shift key: 1200 ms (long-press → caps lock). Sliding
input: × 3 multiplier. Accessibility: 3000 ms.
`config-common.xml:47-51, 57`, `PointerTracker.java:1137-1147`.

**Our state**: iOS `longPressDuration: 0.4`. Android `LONG_PRESS_THRESHOLD_MS = 400L`.

**Action**: Both at 400 ms is a touch sluggish vs. LatinIME's 300 ms.
Drop to **300 ms** for accent variants. Long-press _shift_ (separate
timer) should fire at 1200 ms and engage caps lock.
**Priority**: P1.

---

## 3.2 Key repeat (delete)

**LatinIME**: Initial 400 ms, interval 50 ms, no acceleration. Plus
a `DELETE_ACCELERATE_AT = 20` mechanic in `InputLogic` that doubles
the per-tick delete after 20 consecutive presses.
`config-common.xml:30-31`, `Constants.java:182`, `InputLogic.java:1129, 1156`.

**Our state**: iOS `DeleteRepeater`: 400 ms initial, 80 ms char
interval, escalates to 200 ms _word_-delete after 1500 ms hold.
Android mirrors this. Our model is more aggressive (word delete vs.
LatinIME's "2 chars per tick").

**Action**: Keep ours — it's a deliberate upgrade. Document in
comment that this is intentionally more aggressive than AOSP.
**Priority**: ✅ done (validated).

---

## 3.3 More-keys popup (accent variants)

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

**Our state**: We have `KeyVariantsView` (iOS) / `KeyOverlayView` (Android)
with slide-pick. Variants are baked into `AccentVariants.swift` and
the Kotlin equivalent. Layout is single-row instead of multi-row.

**Action**:

1. Multi-row layout when variants > 5: stack into ⌈N/5⌉ rows so the
   popup isn't truncated for letters like `o` (`ô ö ò ó œ ø ō õ` = 8).
2. Locale-aware variants (currently hard-coded to English-ish set;
   ship the LatinIME `morekeys_*` strings for ES/FR/DE/IT/PT at
   minimum since our app already targets multi-language users).
3. Confirm slide-allowance equivalent. iOS picks variants via
   `keyVariants.updateHighlight(at: location)` — verify it allows the
   finger to drift outside the popup row by ~50 dp before deselecting.

**Priority**: P1 (multi-row), P2 (locale data).

---

## 3.4 More-keys long-press chord pattern

**LatinIME**: After long-press fires, a synthetic down-event is
forwarded into the popup so the user's continuous drag transitions
seamlessly. `PointerTracker.java:1049-1052`.

**Our state**: iOS does this — `keyVariants.updateHighlight(at: state.lastLocation)`
seeds from the current pointer position. Android equivalent runs in
the popup runnable.

**Action**: None.
**Priority**: ✅ done.

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

**Our state**: iOS `KeyPreviewView` with `previewHideDelay: 0.05`
(50 ms). Android `KeyOverlayView` similar. No suppression
post-gesture (we have no gesture).

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
auto-correction (§5). Adds complexity; small isolated value.
**Priority**: P2.

---

## 3.9 Long-press space

**LatinIME**: Long-press space (`enableLongPress` flag) calls
`onCustomRequest(CUSTOM_CODE_SHOW_INPUT_METHOD_PICKER)` — opens the
system IME picker.
`PointerTracker.java:1035`, `key_styles_common.xml:105`.

**Our state**: iOS has no long-press on space (the emoji key
long-press opens the keyboard picker via `handleInputModeList`).
Android has a globe key with long-press → keyboard picker.

**Action**: Consider adding long-press on space → keyboard picker as
a _secondary_ affordance on both platforms. Users moving from stock
Android/Gboard will look for this.
**Priority**: P2.

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

## 3.11 Long-press period → punctuation popup

**LatinIME**: Period key has `moreKeys` of 16 punctuation marks
`,?!#)(/;'@:-"+&%`. Long-press surfaces them in an 8-column
auto-order layout. `res/xml/key_period.xml`,
`donottranslate-more-keys.xml:morekeys_punctuation`.

**Our state**: Our period key has no long-press popup.

**Action**: Add a punctuation more-keys popup to the period key on
the QWERTY layout. Reuse `KeyVariantsView` / `KeyOverlayView`.
**Priority**: P1 — small change, high discoverability win.

---

# 4. State machine: shift, caps, spaces, punctuation

This is where the largest behavior gap sits between our keyboard and
LatinIME. Most of this is implementable without a dictionary.

## 4.1 Shift state machine

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

**Our state**: 3 states (`off`, `on`, `capsLock`) cycled on tap.
No chord detection, no auto-shift, no double-tap-for-caps.

**Action**: Reimplement the 6-state machine. Concretely:

1. Add `AUTOMATIC_SHIFTED` as a distinct visual state from
   `MANUAL_SHIFTED` (same rendering, but next tap on a non-shift key
   drops back to `UNSHIFTED` _without_ the user's intent feeling like
   they undid a deliberate shift).
2. Implement `MANUAL_SHIFTED_FROM_AUTO` (auto-shift was active, user
   tapped shift → drops to UNSHIFT after one tap, not two).
3. Wire chord detection: shift down → letter down (without shift up)
   → mark shift as `CHORDING`; on shift up, restore to UNSHIFT or
   AUTO regardless of letters typed in between.
   **Priority**: P0.

---

## 4.2 Auto-capitalization

**LatinIME**: Detects when the next char should be capitalized.
Triggers: sentence start, after `.`/`?`/`!` + space, after newline,
beginning of input, after opening punctuation.
Algorithm: read committed text before cursor (cached in
`mCommittedTextBeforeComposingText`, no IPC), walk back skipping
opening punct → walk over spaces → if hit start-of-input or
newline = sentence start = caps. Otherwise inspect last non-space
char with an abbreviation state machine (`e.g.` doesn't capitalize;
`yes.` does).

Suppressed when: input field disables auto-cap (URL, password),
`Settings.PREF_AUTO_CAP = false`, or no `EditorInfo`.

`InputLogic.java:1758-1768`, `RichInputConnection.java:362-394`,
`CapsModeUtils.java:103-329`.

**Our state**: None. Every character typed at the start of a
message stays lowercase.

**Action**: Implement an auto-cap mode that runs on every text-input
event and at session start. On iOS, use
`UITextDocumentProxy.documentContextBeforeInput` to read prior text.
On Android, use `InputConnection.getTextBeforeCursor(...)`. Apply the
LatinIME walk-back algorithm (skip open punct → walk spaces → check
sentence terminator). Set the keyboard's `shiftState` to
`automatic_shifted` when the rule fires.

Note: the abbreviation state machine is fiddly. Start with the
simple rule (last non-space char is one of `. ? !` and there's at
least one space between it and the cursor) — covers 95% of cases.
Add abbreviation detection later if users report it
over-capitalizing `e.g.`.

**Files**:

- iOS: new `AutoCapEngine.swift`, call from `EchosKeyboardViewController.swift`
  in `textWillChange` / `textDidChange`.
- Android: new `AutoCapEngine.kt`, call from
  `EchosInputMethodService.kt` in `onStartInput` and after every
  `commitText`.

**Constants**: `EDITOR_CONTENTS_CACHE_SIZE = 1024 chars` is plenty.

**Priority**: P0.

---

## 4.3 Caps lock via double-tap shift

**LatinIME**: Two taps on shift within
`ViewConfiguration.getDoubleTapTimeout()` (default 300 ms) while
already in `MANUAL_SHIFTED` or just-un-shifted = engage caps lock.
Alternatively, long-press shift for 1200 ms.
`KeyboardState.java:487-536`, `TimerHandler.java:174-177`,
`config-common.xml:57`.

**Our state**: Caps lock requires a third tap (off → on → caps →
off). Users coming from stock keyboards expect double-tap.

**Action**: Add a 300 ms double-tap timer on shift. Two taps inside
the window → `capsLock`. Single tap → `on`. Long-press 1200 ms →
also engage caps lock.
**Priority**: P0.

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

**Our state**: None.

**Action**: Implement phantom space once we have a suggestion strip
(it's only meaningful after picking a suggestion). For now, skip.
**Priority**: P2 (blocked on §5.5).

---

## 4.5 Smart double-space → period

**LatinIME**: Inside a 1100 ms window of typing a space, typing
another space deletes the space and inserts `. ` (sentence separator

- space). Then sets `mSpaceState = DOUBLE` so the next backspace
  restores the original `  `.

Guards:

- User pref enabled.
- Char before the space must be letter/digit, or one of `'"()]}>+%`,
  or Unicode `OTHER_SYMBOL`. Excluded: punctuation (`,;:!?.-_` etc.).
- `mUseDoubleSpacePeriod = true` (default).

`InputLogic.java:1325-1359`, `config-common.xml:28` (1100 ms window),
`Constants.java:178`.

**Our state**: None. Double-space inserts two literal spaces.

**Action**: Implement. State machine on the space key with a 1100 ms
timer. On the second space within the window:

1. Read 2 chars before cursor.
2. If pos[len-1] is space AND pos[len-2] satisfies the char-class
   guard:
   - delete the trailing space
   - commit `. ` (use the user's locale sentence terminator if we
     want to be fancy; ASCII period is fine)
   - mark this so the next backspace reverts.

Backspace revert: read 3 chars back; if they are `. `, replace with
`  ` and reset.

**Priority**: P0.

---

## 4.6 Smart punctuation (swap weak space)

**LatinIME**: When committing punctuation, the engine strips or
swaps a preceding weak-space depending on the punctuation class:

- "Usually preceded by space" `( [ { &` → keep the space, no strip.
- "Usually followed by space" `. , ; : ! ? ) ] } &` → swap, drop the
  preceding space and emit `<punct><space>`.

`InputLogic.java:880-983`, `donottranslate-config-spacing-and-punctuations.xml:26-28`.

**Our state**: None.

**Action**: Implement once we ship a suggestion strip (the swap is
only meaningful when the space came from a strip pick). For
keyboard-typed punctuation only, the user already controls the
order, so this is mostly a no-op without §5.
**Priority**: P2 (blocked on §5.5).

---

## 4.7 Recapitalize (selection + shift)

**LatinIME**: When text is selected and shift is tapped, the
selection cycles through `ORIGINAL_MIXED_CASE → ALL_LOWER →
FIRST_WORD_UPPER → ALL_UPPER → ...`. If the original is already in
one of those forms, `ORIGINAL_MIXED_CASE` is skipped (3-state cycle).

Constraint: selection ≤ 102,400 chars.
Recapitalize disabled until first cursor move after input start.
Cursor move while rotating → cancels the rotation.

`InputLogic.java:1391-1422`, `RecapitalizeStatus.java`.

**Our state**: None. Shift on a selection does nothing useful.

**Action**: Implement the 4-state rotation. On iOS, read selection
via `selectedText`; on Android, use `getSelectedText`. Apply the case
transform locally, then `commitText` over the selection.
**Priority**: P1.

---

## 4.8 Sentence boundary detection

**LatinIME**:

- Sentence terminators: `. ? !`
- Sentence separator (the period commit char): `.`
- Word separators: `\t \n ()[]{}*&<>+=|.,;:!?/_"`
- Usually preceded by space: `( [ { &`
- Usually followed by space: `. , ; : ! ? ) ] } &`
- Newline = paragraph boundary = sentence start.

`SpacingAndPunctuations.java`, `donottranslate-config-spacing-and-punctuations.xml`.

**Our state**: Implicit / nonexistent.

**Action**: Centralize these constants in a shared
`SpacingAndPunctuations` model on each platform. Auto-cap, smart
double-space, recapitalize, and smart punctuation will all share it.
**Priority**: P0 (foundation for §4.2 / §4.5 / §4.7).

---

## 4.9 Symbols layout auto-return to alpha

**LatinIME**: After entering the symbols layout, the first symbol
typed transitions internal state to `SWITCH_STATE_SYMBOL`. The next
_space or enter_ automatically toggles back to alpha.
`KeyboardState.java:621-675`.

**Our state**: User must explicitly tap `ABC` to return.

**Action**: Add this auto-return. Tracking is trivial — keep a
boolean `typedNonSpaceInSymbols`; on space/enter, flip back to
letters if true.

This matches the muscle memory users have from stock Android.

**Priority**: P1.

---

## 4.10 Symbols-shifted (page 2 of symbols)

**LatinIME**: In symbol mode, tapping the shift-equivalent key flips
between `SYMBOLS` and `SYMBOLS_SHIFTED` (different sets of chars).
`KeyboardState.toggleShiftInSymbols()`.

**Our state**: Implemented as the `#+=` key — already covered.
**Priority**: ✅ done.

---

# 5. Smart input & suggestions

This section largely depends on building a suggestion backend. The
parts that don't (spacebar cursor, backspace acceleration, voice
delegation) are called out.

## 5.1 Spacebar cursor drag — NOT IN LATINIME

**Verdict**: AOSP LatinIME has no spacebar-drag-to-move-cursor
gesture. iOS users expect this from Apple's keyboard.

**Our state**: Not implemented.

**Action**: This is an _iOS_ convention. Implement on iOS only:

- On `touchesBegan` on the space key, start tracking.
- After 300 ms hold (the iOS threshold), enter "cursor mode": the
  preview balloon transforms into a cursor track indicator.
- During cursor mode, horizontal finger movement → `adjustTextPosition(byCharacterOffset: ±1)`
  for every ~10 pt of movement.
- On release, exit cursor mode without committing a space.

Android users don't expect it, so skip on Android.

**Priority**: P1 (iOS).

---

## 5.2 Backspace swipe-to-delete-word — NOT IN LATINIME

**Verdict**: No swipe gesture. LatinIME just has key repeat with
acceleration. We already have a more aggressive `DeleteRepeater`
that escalates to word-delete after 1.5 s.

**Action**: None — our hold escalation already covers the use case.
**Priority**: ✅ done.

---

## 5.3 Backspace acceleration

**LatinIME**: 2× per tick after 20 consecutive deletes
(`DELETE_ACCELERATE_AT = 20`). No interval acceleration, just doubles
the chars-per-tick.

**Our state**: Switches from 80 ms char-rate to 200 ms word-rate
after 1.5 s. Different model — ours is more visible to the user.

**Action**: Keep ours. Document why we diverge.
**Priority**: ✅ done (validated).

---

## 5.4 Undo auto-correction on backspace

**LatinIME**: After committing an auto-corrected word, the original
typed word is preserved in `LastComposedWord`. Pressing backspace
deletes the corrected word and re-inserts the original with a
`SuggestionSpan` so the user can long-press to pick the correction
back. Also unlearns the correction from the user-history dictionary.
`InputLogic.java:1038, 1634`, `LastComposedWord.java`.

**Our state**: We have no auto-correction, so this is moot.

**Action**: Implement when we ship auto-correction (§5.10).
**Priority**: P2 (blocked on §5.10).

---

## 5.5 Suggestion strip

**LatinIME**: Strip above the keyboard shows top N word
suggestions during composition.

- Tap → `pickSuggestionManually`, commits word, sets `PHANTOM` space.
- Long-press → opens `MoreSuggestionsView` with more candidates.
- Swipe up → also opens more suggestions.
- Auto-commit on space when an auto-correction is selected.

`SuggestionStripView.java:294, 345, 449`, `InputLogic.onPickSuggestionManually:290-340`.

**Our state**: We have no suggestion strip. The top bar is a
voice-record affordance.

**Action**: This is the biggest "smart" feature gap. Two options:
(a) Show suggestions in a strip _above_ the QWERTY rows but _below_
the voice top bar; (b) repurpose the top bar to show suggestions
when the user is typing and revert to the voice button when idle.

Either way: requires a suggestion _source_. The cheapest source is
the system spellchecker (iOS `UITextChecker`, Android
`SpellCheckerSession`), which gives spell corrections but not
next-word predictions.

**Priority**: P1 (UX win for actual typing); requires architecture
decision first.

---

## 5.6 Predictive next-word (no prefix)

**LatinIME**: After committing a word with `SpaceState.PHANTOM`,
the strip shows predictions with no typed prefix.
Built from `NgramContext` of previous words.
`Suggest.java:269-276`.

**Action**: Tied to §5.5 + §5.9. Skip until those exist.
**Priority**: P2.

---

## 5.7 Dynamic key resizing by language model

**Verdict**: See §1.7 — myth, drop.
**Priority**: SKIP.

---

## 5.8 Personal dictionary (user history)

**LatinIME**: `UserHistoryDictionary` records typed words +
n-gram context with a forgetting curve. `isValidWord = false` so
words never count as authoritative dictionary entries, only as
suggestion-ranking signals. Unlearn fires on backspace-into-word,
rejecting a batch suggestion, reverting an auto-correction.
`UserHistoryDictionary.java`, `InputLogic.java:1229, 1665`.

**Action**: Defer until §5.5 lands. Then a simple SQLite-backed
"recently typed" table with timestamp decay scores covers most of
the value. Stay strictly on-device; no upload.

Privacy: we run encrypted SQLCipher already. This table would live
inside that store.
**Priority**: P2.

---

## 5.9 Bigram / trigram / n-gram

**LatinIME**: Up to 4-gram (3 prev words). `BinaryDictionary.java:61`.
**Action**: Defer to §5.8.
**Priority**: P2.

---

## 5.10 Auto-correct threshold

**LatinIME**: Three threshold levels (modest 0.185, aggressive 0.067,
very aggressive -∞). Blocked when word contains digits, is mostly
caps, is a shortcut, etc.
`config-auto-correction-thresholds.xml`,
`Suggest.java:200-248`, `AutoCorrectionUtils.java`.

**Action**: Tied to §5.5. Skip until suggestion backend exists.
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

## 5.12 Cursor / selection awareness

**LatinIME**:

- `onUpdateSelection` resets composing state when cursor moves
  outside the composing word.
- Typing into a selection: framework replaces selection via
  `InputConnection.commitText`.
- Recapitalize gated until first cursor move; cursor move while
  rotating cancels the rotation.

**Our state**: We don't track cursor/selection state at all.

**Action**: On Android, override `onUpdateSelection` to clear any
in-flight state (auto-cap timer, double-space timer). On iOS, use
`textWillChange`/`textDidChange` for the same purpose. Required
foundation for any of §4.2 / §4.5 / §4.7 to work reliably.
**Priority**: P0 (foundation for state-machine work).

---

## 5.13 Voice input

**LatinIME**: Delegates to system shortcut IME via `switchToShortcutIme`.
**Our state**: We already own voice via Sherpa on-device.
**Action**: None — our story is stronger than AOSP's.
**Priority**: ✅ done.

---

# 6. Quick-reference constants we should adopt

| Constant                     | LatinIME value          | Our value                     | Action                |
| ---------------------------- | ----------------------- | ----------------------------- | --------------------- |
| Long-press default           | 300 ms                  | 400 ms                        | Drop to 300 ms        |
| Long-press shift → caps lock | 1200 ms                 | n/a                           | Add                   |
| Long-press in sliding        | × 3                     | n/a                           | Add when §3.5 lands   |
| Key repeat start (delete)    | 400 ms                  | 400 ms                        | ✅                    |
| Key repeat interval          | 50 ms                   | 80 ms char / 200 ms word      | Keep ours             |
| Key preview show-up          | 17 ms                   | unmeasured                    | Verify                |
| Key preview linger           | 70 ms                   | 50 ms                         | Bump to 70 ms         |
| Double-space-period window   | 1100 ms                 | n/a                           | Add (P0)              |
| Double-tap-shift window      | 300 ms (system)         | n/a                           | Add (P0)              |
| Key hysteresis               | 8 dp                    | 10 dp (Android) / 12 pt (iOS) | ✅                    |
| Touch-noise time/dist        | 40 ms / 12.6 dp         | n/a                           | P2                    |
| Proximity grid               | 32 × 16                 | linear                        | Defer until gesture   |
| Touch-pos correction Y bias  | -0.0006 / 0.038 / 0.088 | none                          | Add per-row (P1)      |
| `DELETE_ACCELERATE_AT`       | 20 chars                | hold-time-based               | Keep ours             |
| EDITOR_CONTENTS_CACHE        | 1024 chars              | n/a                           | Use 1024 for auto-cap |

---

# 7. Implementation roadmap (suggested order)

Bottom-up, each step compounds with the last:

**Phase 1 — State foundation (P0):**

1. `SpacingAndPunctuations` model on both platforms (§4.8).
2. Cursor/selection observers in IME service / view controller (§5.12).
3. Auto-cap engine (§4.2).
4. Double-tap-for-caps + 6-state shift machine (§4.1, §4.3).
5. Smart double-space → period (§4.5).

**Phase 2 — Hit & UX polish (P1):** 6. Edge-key hitbox extension (§1.4). 7. Per-row sweet-spot Y bias (§1.5). 8. Long-press default 300 ms; long-press shift 1200 ms (§3.1). 9. Period key punctuation popup (§3.11). 10. Recapitalize on selection (§4.7). 11. Symbols auto-return to alpha (§4.9). 12. iOS spacebar cursor drag (§5.1). 13. Multi-row accent variants popup (§3.3).

**Phase 3 — Suggestion backend (P1/P2):** 14. Decide architecture: spellchecker-only vs. own n-gram backend. 15. Suggestion strip UI (§5.5) — top bar or new row. 16. Auto-correct with revert-on-backspace (§5.4, §5.10). 17. Phantom-space (§4.4), smart punctuation (§4.6), next-word (§5.6). 18. Personal dictionary (§5.8, §5.9).

**Phase 4 — Gesture typing (P2):** 19. Glide-typing recognizer (§2). Multi-week project; reconsider need.

**Skip outright:**

- Dead keys (§3.10).
- Dynamic key resizing by LM (§1.7).
- Phrase gestures across spaces (§2.9).
- Bogus-move detector (§1.9).
- Important-notice strip (§5.11).

---

# 8. Files we'll touch

iOS:

- `plugins/keyboard/ios/templates/EchosKeyboardViewController.swift` — auto-cap, double-space, cursor, selection observers
- `plugins/keyboard/ios/templates/KeyboardView.swift` — shift state, period popup, edge inflation, sweet spots
- `plugins/keyboard/ios/templates/KeyButton.swift` — auto-shift visual state
- New: `AutoCapEngine.swift`, `SpacingAndPunctuations.swift`, `RecapitalizeEngine.swift`, `DoubleSpacePeriod.swift`

Android:

- `plugins/keyboard/android/templates/EchosInputMethodService.kt` — auto-cap, double-space, selection observers
- `plugins/keyboard/android/templates/EchosKeyboardView.kt` — shift state, period popup, edge inflation, sweet spots
- New: `AutoCapEngine.kt`, `SpacingAndPunctuations.kt`, `RecapitalizeEngine.kt`, `DoubleSpacePeriod.kt`

Shared:

- This file's constants table should become a shared markdown
  reference; each implementation file should cross-link to its
  section number.
