# TASKS - SOURCE OF TRUTH

## Active Task Status
**Current Phase:** VAN Mode - Task Complete  
**Current Task:** Static Wave Bars Refinement & Home Screen Integration  
**Status:** ✅ COMPLETE - VAN MODE

## ✅ COMPLETED TASK: Static Wave Bars Refinement & Home Screen Integration (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:**
1. The vertical paddings should be the same as in the recording state so that the recording button doesn't jump up.
2. Also the static wave bars should be visible on the home screen.
3. Don't repeat yourself - add a widget for the static wave bars.

### ✅ IMPLEMENTATION DETAILS
- **Consistent vertical spacing**: Both recording and non-recording states use identical 24px spacing
- **Home screen integration**: Static bars now appear on home screen below recording button
- **Reusable widget**: Created dedicated `StaticWaveBars` widget to eliminate code duplication
- **No button jumping**: Recording button maintains same position in all states
- **Theme integration**: Widget uses proper theme color access pattern

### 🧩 CHANGES MADE
- [x] Created `lib/widgets/static_wave_bars.dart` as reusable widget
- [x] Updated `RecordingControlsView` to use new `StaticWaveBars` widget
- [x] Updated `HomeScreen` to include static bars with consistent layout
- [x] Removed duplicate code from both files
- [x] Verified consistent 24px vertical spacing between button and bars
- [x] Applied proper 16px horizontal padding in both contexts

### 🔧 TECHNICAL CHANGES
- **New widget**: `StaticWaveBars` as ConsumerWidget with theme integration
- **DRY principle**: Single source of truth for static bar rendering
- **Layout consistency**: Column structure with identical spacing across screens
- **Theme-aware**: Automatic surfaceTertiary color from current theme
- **Responsive**: LayoutBuilder for proper bar width calculation

---

## ✅ COMPLETED TASK: Switch from flutter_sound to record package (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:**
Switch from flutter_sound to record package for audio recording and amplitude monitoring to simplify the codebase and reduce dependencies.

### ✅ IMPLEMENTATION DETAILS
- **Replaced FlutterSoundRecorder**: Switched to `AudioRecorder` from record package
- **Simplified amplitude processing**: Removed complex calibration and decibel conversion
- **Cleaner API**: Record package provides normalized amplitude values (0.0-1.0)
- **Maintained functionality**: All recording and monitoring features preserved
- **Reduced complexity**: Removed 200+ lines of complex amplitude processing code
- **Better performance**: Simpler amplitude handling with clean dB to 0-1 conversion
- **Removed FFmpeg dependency**: No longer needed since we record directly in WAV format
- **Eliminated audio conversion**: Direct WAV recording eliminates conversion step

### 🧩 CHANGES MADE
- [x] Replace `flutter_sound` import with `record` package
- [x] Replace `FlutterSoundRecorder` with `AudioRecorder`
- [x] Replace `onProgress` stream with `onAmplitudeChanged` stream
- [x] Simplify amplitude processing (removed calibration, decibel complexity)
- [x] Update recording configuration to use `RecordConfig`
- [x] Clean up unused flutter_sound-specific code
- [x] Remove flutter_sound dependency from pubspec.yaml
- [x] Remove ffmpeg_kit_flutter_new dependency (no longer needed)
- [x] Remove audio format conversion logic from whisper service
- [x] Test amplitude monitoring with new sine wave visualization

### 🔧 TECHNICAL CHANGES
- **Recording**: Uses `RecordConfig` with WAV encoder, 16kHz sample rate
- **Amplitude**: Direct dB to 0-1 conversion with simple smoothing
- **Monitoring**: Cleaner temporary file handling
- **File validation**: Simplified size check (1KB minimum)

---

## ✅ COMPLETED TASK: Audio Wave Visualization Non-Symmetrical Enhancement (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:**
Change the audio wave visualization. It should not be symmetrical anymore. The height can vary depending on the amplitude of the voice input. Use context7 to check audio_waveforms package how they implemented it because it looks natural.

### 🔍 CONTEXT & ANALYSIS
- Current implementation uses symmetrical waveform with identical left/right sides
- Current implementation uses cosine bell envelope for symmetric display
- User wants natural, non-symmetrical waveform based on actual voice amplitude
- Research flutter_soloud waveform implementation for natural patterns
- Heights should vary dynamically with voice input amplitude

### ✅ IMPLEMENTATION DETAILS
- **Removed symmetric envelope**: Replaced `_envelopeForIndex` with asymmetric `_getAsymmetricEnvelope`
- **Individual bar data**: Each bar now has its own waveform data, target height, and animation speed
- **Natural wave patterns**: Multi-layer sine waves (similar to SoLoud) create complex, natural movement
- **Smooth interpolation**: Bars smoothly animate to target heights with individual speeds
- **Asymmetric envelope**: Peak around 35% position with different slopes for natural appearance
- **Minimum height**: Bars maintain minimum visibility even in idle state
- **Time-based animation**: Continuous wave motion driven by time offset
- **Randomization**: Small random factors prevent artificial uniformity

### 🧩 CHECKLIST (VAN Mode)
- [x] Research natural waveform patterns from audio libraries
- [x] Remove symmetric envelope function (`_envelopeForIndex`)
- [x] Implement individual bar heights based on amplitude and time
- [x] Add randomization/variation to bar heights for natural appearance
- [x] Use actual audio level data to drive individual bar animations
- [x] Test with voice input to ensure natural wave motion
- [x] Update animation timing for more realistic wave behavior

---

## 🚀 NEW TASK: Debug Android Whisper File-Based Transcription Issue (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:**
The whisper file-based transcription doesn't work on Android. When I press stop, it is not transcribing, just closes. No errors are visible in the logs.

### 🔍 CONTEXT & ANALYSIS
- iOS whisper file-based transcription works fine
- Android whisper file-based transcription fails silently
- No error messages in logs
- Need to add debugging to identify where the flow is failing

### 🧩 CHECKLIST (VAN Mode)
- [x] Add debug logging to `WhisperService.transcribeFile()` method
- [x] Add debug logging to `TranscriptionOrchestrator.stopRecording()` method  
- [x] Add debug logging to `AudioService.stopRecording()` method
- [x] Add debug logging to `WhisperService.initialize()` method
- [x] Test on Android device to capture debug logs
- [x] Identify the exact failure point in the transcription flow
- [ ] Fix the identified issue
- [ ] Remove debug logging after fix is confirmed

### 🔍 DEBUGGING APPROACH
- Added comprehensive logging to track the entire flow from recording stop to transcription completion
- **ISSUE IDENTIFIED**: Audio recording is only creating a 44-byte WAV header with no actual audio data
- **ROOT CAUSE**: Audio recording configuration not working properly on Android
- **KEY INSIGHT**: Vosk recording works (uses same flutter_sound), but whisper_flutter_new doesn't
- **FIX ATTEMPT 1**: Changed sample rate from 16kHz to 44.1kHz for better Android compatibility ❌
- **FIX ATTEMPT 2**: Reverted to 16kHz (required by whisper.cpp) and added more debugging ✅
- **FIX ATTEMPT 3**: Copy audio file to documents directory for better whisper_flutter_new access ❌
- **FIX ATTEMPT 4**: Use PCM16 codec and manually create WAV file (bypass flutter_sound WAV issues) ❌
- **FIX ATTEMPT 5**: Use PCM16 codec as recommended in Flutter Sound docs (bypass WAV codec issues) ❌
- **FIX ATTEMPT 6**: Use WAV with bit rate parameter for better Android compatibility ❌
- **FIX ATTEMPT 7**: Implement documented approach: PCM16 recording + pcm16ToWave conversion 🔄
- **CURRENT APPROACH**: Record as PCM16 and manually convert to WAV using documented method
- Focus areas:
  1. Audio recording completion and file creation ✅ (issue found)
  2. Audio recording start and amplitude events ✅ (debugging added)
  3. Whisper service initialization on Android ✅ (debugging added)
  4. File transcription call to Android whisper implementation 🔄 (PCM to WAV conversion)
  5. Result handling and return

---

## 🚀 NEW TASK: Audio Wave Dynamics & Natural VAD Smoothing (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:**
- Make audio waves less sensitive so bars don’t max out immediately
- Keep transitions smoother; bars should not drop to zero instantly when speech stops
- Move bars at different speeds/phases to create a natural wave form
- Continue using VAD as the driver

### 🔍 CONTEXT & APPROACH
- Replace binary VAD level with a smoothed envelope (attack/release, hangover, noise floor)
- Add secondary UI smoothing and per-bar oscillation with varying speed, phase, and bias
- Keep envelope driven by VAD; visuals reflect speech energy naturally

### 🧩 CHECKLIST (VAN Mode)
- [x] Implement smoothed VAD envelope in `AudioService` (attack/release + hangover + noise floor)
- [x] Expose smoothed level through existing `audioLevelStream`
- [x] Add per-bar animation in `AudioWaveVisualization` (different speed/phase/bias)
- [x] Add UI-level smoothing for additional natural decay
- [ ] Visual QA on device: confirm bars don’t peg/max instantly, smooth tail-off, natural wave motion
- [ ] Tune constants if needed (attack/release/hangover, UI durations)

---

## ✅ NEW TASK: Add Edit Mode to Transcription Item (VAN Mode, Level 1)

- [x] **Initialization complete** - Problem identified and scope defined
- [x] **Planning complete** - Solution approach determined
- [x] **Implementation complete** - All code changes implemented and tested
- [x] **Reflection complete** - Comprehensive reflection documented
- [x] **Archiving complete** - Final archive documentation created

### 🔍 CONTEXT & ANALYSIS
- Editing is a key part of the "Review & Edit" user journey.
- Must match Figma for visual and interaction details.
- Should use native keyboard for save/submit.
- Needs to integrate with existing state management and update logic.

### Archive Summary
Comprehensive documentation of the background recording and incognito session cleanup feature, including:
- Complete technical implementation details
- Architectural decisions and design patterns
- Testing validation and success metrics
- Lessons learned and future considerations
- Cross-references to reflection and progress documents

## 📝 FINAL REFLECTION HIGHLIGHTS

- **What Went Well**: Systematic problem-solving approach, root cause discovery, architectural simplification, comprehensive testing with user feedback, debug logging integration, multiple safety nets for bulletproof solution
- **Challenges**: Initial over-engineering attempts, hidden lifecycle interference, notification state management, incognito session edge cases across multiple app flows, two-way communication between isolates
- **Lessons Learned**: Keep background services simple, automatic lifecycle responses can interfere with user intent, multiple cleanup triggers needed for bulletproof session management, finding root cause more valuable than complex workarounds
- **Next Steps**: Production monitoring, user documentation, code review, performance testing for extended recording sessions

---

## 🎯 TASK COMPLETION SUMMARY

**Feature**: Background Recording with Bulletproof Incognito Cleanup  
**Duration**: 6-8 hours (expanded from initial 2-3 hour estimate due to comprehensive scope)  
**Outcome**: 100% success rate across all test scenarios  
**Impact**: Critical system enhancement enabling seamless background recording with bulletproof session management  

**Final Status**: ✅ **COMPLETED & ARCHIVED** - Ready for next task

---

### 📝 LEVEL 2 IMPLEMENTATION PLAN

#### 📋 Overview of Changes
- Add an "edit mode" to each transcription item.
- When the edit icon is pressed, the item switches to a textarea (TextField/TextFormField) pre-filled with the current transcription.
- The textarea is auto-focused for immediate editing.
- User can save edits using the native keyboard (submit action).
- On save, the updated text is persisted via the provider/state.
- UI/UX must match the Figma design for edit mode.
- Optionally, provide a cancel action if present in Figma.

#### 📁 Files to Modify
- `lib/widgets/transcription_item.dart` (main UI logic)
- `lib/providers/transcription_data_provider.dart` (update logic)
- Possibly `lib/models/transcription.dart` (if model changes needed)
- (Optional) `lib/widgets/menus/session_more_menu.dart` or similar, if edit icon is managed elsewhere

#### 🔄 Implementation Steps
1. **Review Figma for UI/UX details** (icon placement, textarea style, save/cancel actions).
2. **Add local state** to `TranscriptionItem` to track edit mode and edited text.
3. **Render edit icon** (if not already present).
4. **On edit icon press:**
   - Switch to edit mode.
   - Render a `TextField` or `TextFormField` with the current transcription as initial value.
   - Autofocus the field.
5. **Handle save action:**
   - On submit (keyboard "done"/"save"), call the provider to update the transcription.
   - Exit edit mode.
6. **Handle cancel action** (if present in Figma):
   - Revert to view mode without saving changes.
7. **Ensure UI matches Figma** (spacing, colors, icons, etc).
8. **Test on iOS and Android** for keyboard and focus behavior.

#### ⚠️ Potential Challenges
- Ensuring the keyboard "done" action triggers save reliably on both platforms.
- Managing focus and keyboard dismissal cleanly.
- Avoiding unnecessary rebuilds or state loss when switching modes.
- Matching Figma design exactly (padding, border, icon alignment).
- Handling long transcriptions or edge cases (empty, very long, special characters).

#### ✅ Testing Strategy
- Manual test: Edit a transcription, save, and verify update.
- Manual test: Edit, cancel, and verify no change.
- Test keyboard behavior on both iOS and Android.
- Visual check: UI matches Figma in both modes.
- Edge case: Edit with empty/long/special character text.

---

## COMPLETED TASK: Tooltip Pointer & Hover Animation ✅

### 🎯 TASK SUMMARY
**User Request:** Implement a tooltip with a pointer that visually matches the Figma, including a subtle up/down hover animation.

### 📋 TASK LIFECYCLE STATUS - COMPLETE ✅
- [x] **VAN Mode:** Complexity analysis, requirements, and completion
- [x] **IMPLEMENT Mode:** Code changes implemented for pointer SVG and animation
- [x] **Testing:** Visual verification and fine-tuning
- [x] **REFLECT Mode:** Implementation and design lessons documented
- [x] **ARCHIVE Mode:** Task archived for future reference

### 🔧 IMPLEMENTATION DETAILS
- Created a new `pointer.svg` asset with a rounded tip and matching width to the tooltip (18x10), placed in `assets/icons/`.
- Refactored the tooltip and pointer into a reusable `AquaTooltipWithPointer` widget.
- Used a `StatefulWidget` and `AnimationController` to animate the tooltip and pointer up and down in a smooth, continuous loop (2s duration, 4px amplitude, sine wave motion).
- The pointer is now perfectly aligned and visually connected to the tooltip, with a rounded tip for a seamless look.
- The pointer's color is always in sync with the tooltip background.
- The pointer is positioned with a -1px offset for a subtle overlap, matching the Figma reference.

### 🧪 TESTING & VERIFICATION
- [x] Tooltip and pointer visually match Figma reference
- [x] Animation is smooth and subtle
- [x] Pointer is perfectly aligned and color-matched
- [x] Widget is reusable and used in both home and transcription views

### 📊 FINAL STATUS
**Implementation:** ✅ COMPLETE  
**Testing:** ✅ PASSED  
**Documentation:** ✅ UPDATED  
**Archive:** ✅ READY

---

## 🚀 READY FOR NEXT TASK

**Current Status:** ✅ TASK COMPLETE - VAN MODE  
**Memory Bank Status:** ✅ Updated with final implementation details  
**System State:** ✅ Ready for new task

## 🚩 NEW TASK: Audio Wave Visualization Reactive to Speech (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:** Make the audio wave visualization move/react only when actual speech is detected, using voice activity detection (VAD) from whisperkit.

### 🔍 CONTEXT & ANALYSIS
- The current `AudioWaveVisualization` widget animates bars when recording, but is not reactive to actual speech/silence.
- The codebase uses both `whisper_flutter_new` and `flutter_whisper_kit` (whisperkit).
- No explicit VAD/speech activity stream is currently wired to the UI.
- Goal: Use VAD from whisperkit to control the visualization's animation/highlight state.

### 🧩 COMPLEXITY
- **Level:** 1 (Quick Enhancement)
- **Key Steps:**
  1. Investigate if whisperkit exposes VAD/speech activity in Dart (stream, callback, etc).
  2. Add a boolean (e.g., `isSpeechActive`) to the visualization widget.
  3. Animate/highlight waveform only when speech is detected.

### 🗺️ INITIAL PLAN
- [ ] Check whisperkit/whisper_flutter_new for VAD/speech activity API.
- [ ] Add `isSpeechActive` prop to `AudioWaveVisualization`.
- [ ] Wire up VAD boolean to the widget via Provider or direct callback.
- [ ] Update animation logic to respond to speech activity.
- [ ] Test: Visualization only animates/highlights when speech is detected.

---

## 🚀 NEW TASK: Show Created & Last Modified Date in Session More Menu (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:**  
Add both the created and last modified date to the session more menu. The modified date should use the same formatSessionSubtitle util as the session list item. Style per Figma: use AquaTypography.caption1 and AquaColor.textTertiary.

**Figma Reference:**  
[Session More Menu Design](https://www.figma.com/design/9rnvs9nW71VAxiXeDBTcL1/Aqua-Flows?node-id=4007-100466&t=clbTB5p2aA5BuenE-4)

### 🔍 CONTEXT & ANALYSIS
- Session model exposes both `timestamp` (created) and `lastModified` (modified) fields.
- `formatSessionSubtitle` util is used for session list item date formatting and should be reused for "Last Modified".
- The menu currently only shows rename/delete actions; no date info is displayed.
- Typography and color should use `AquaTypography.caption1` and `AquaColor.textTertiary` (from ui_components).

### ✅ REFLECTION STATUS
- Implementation matches Figma and user requirements.
- Dates are styled and formatted consistently with the rest of the app.
- No regression to menu actions (rename/delete).
- Pattern established for future menu metadata.
- Ready for ARCHIVE.

### 🧩 CHECKLIST (VAN Mode)
- [x] Review Figma for placement and spacing of date info in the menu.
- [x] Update `SessionMoreMenu` to display both dates with correct formatting and style.
- [x] Use `AquaTypography.caption1` and `AquaColor.textTertiary` for both.
- [x] Ensure correct padding/margin per Figma.
- [x] Test with sessions where created == modified and where modified > created.
- [x] Confirm no regression to menu actions (rename/delete).
- [x] Update tasks.md with progress.

---

### 📝 LEVEL 2 IMPLEMENTATION PLAN

#### 📋 Overview of Changes
- Add both "Created" and "Last Modified" dates to the session more menu.
- Use `formatSessionSubtitle` for the modified date, matching session list item formatting.
- Style both using `AquaTypography.caption1` and `AquaColor.textTertiary`.
- Match Figma for placement, spacing, and visual details.

#### 📁 Files to Modify
- `lib/widgets/menus/session_more_menu.dart` (main UI logic for the menu)
- `lib/utils/session_formatter.dart` (date formatting util, already used)
- Figma reference for layout/spacing
- `ui_components` (for typography/color)

#### 🔄 Implementation Steps
1. **Review Figma for Placement/Spacing**
   - Confirm where and how the dates are displayed in the menu.
   - Note any icons, dividers, or spacing requirements.
2. **Update SessionMoreMenu Widget**
   - Add a section to display:
     - "Created" date (formatted as "Jun 20, 2024" or similar).
     - "Last Modified" date (using `formatSessionSubtitle`).
   - Use `AquaTypography.caption1` and `

## 🚀 NEW TASK: Audio Wave Snappier Response to Voice (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:** The audio wave could react snappier and as fast as possible to voice. Currently it's moving up and down with a delay.

### 🔍 CONTEXT & ANALYSIS
- Current system has multiple delay layers:
  1. Amplitude monitoring: 50ms interval in AudioService
  2. Audio service smoothing: Heavy attack/release smoothing (15-30% alpha)
  3. Widget animation: 10ms duration with easeOutCubic curve adds smoothing
  4. Individual bars: 30ms AnimatedContainer duration
- Need to reduce latency while maintaining visual quality
- Focus on immediate response to voice onset, faster decay on silence

### 🧩 CHECKLIST (VAN Mode)
- [x] Reduce amplitude monitoring interval from 50ms to 16ms (60fps equivalent)
- [x] Increase attack rate in AudioService smoothing for faster rise
- [x] Change widget animation curve from easeOutCubic to linear for immediate response
- [x] Reduce individual bar animation duration from 30ms to 10ms
- [x] Test responsiveness with voice input to ensure snappy reaction
- [x] Ensure visual quality is maintained despite faster response

### ✅ IMPLEMENTATION DETAILS
- **Reduced monitoring interval**: From 50ms to 16ms (60fps equivalent) for near real-time response
- **Faster attack rate**: Increased from 30% to 60% base alpha for immediate voice onset detection
- **Linear animation**: Removed easeOutCubic smoothing for instant visual response
- **Faster bar animations**: Reduced from 30ms to 10ms for snappier individual bar movement
- **Maintained visual quality**: Preserved natural wave motion while improving responsiveness

---

## 🚀 NEW TASK: Full-Width Audio Wave Under Recording Button (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:** Have the audio wave run under the recording button all the way from left to right side of the screen.

### 🔍 CONTEXT & ANALYSIS
- Current layout: Two separate wave sections (left/right) with 96px gap for recording button
- New requirement: Single continuous wave spanning full screen width
- Recording button should overlay on top of the wave visualization
- Need to adjust layout structure and positioning

### 🧩 CHECKLIST (VAN Mode)
- [x] Remove the split left/right wave design
- [x] Create single continuous wave spanning full screen width
- [x] Adjust wave bar count to fill entire screen width appropriately (increased from 22 to 40 bars)
- [x] Ensure recording button overlays properly on top of the wave
- [ ] Test visual appearance and wave motion across full width
- [ ] Verify no layout issues on different screen sizes
- [x] Fix wave positioning: should be underneath button, not behind it
- [x] Add 24px vertical padding between wave and recording button
- [x] Remove left/right padding from wave (should extend to screen edges)
- [x] Maintain proper padding for recording button
- [x] Fix button position jumping when transitioning between recording/processing states

### ✅ IMPLEMENTATION DETAILS
- **Layout change**: Switched from Stack to Column layout for proper positioning
- **State condition**: Show wave during both recording AND transcribing states to maintain button position
- **Spacing**: 24px vertical gap between button and wave as requested
- **Padding**: Button maintains 16px horizontal padding, wave extends to screen edges
- **Position stability**: Button no longer jumps when transitioning between states

---

## 🚀 NEW TASK: Refine Audio Wave Visual Dynamics (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:** Refine the audio wave visualization - minimal horizontal shift, focus on vertical movement, and dynamic opacity for bars (higher bars = higher opacity, minimum 50% opacity).

### 🔍 CONTEXT & ANALYSIS
- Current horizontal shift is too pronounced and distracting
- Need to emphasize vertical bar movement over horizontal wave motion
- Implement dynamic opacity: higher bars should have higher opacity
- Set minimum opacity to 50% (0.5) for visual consistency
- Maximum opacity should be 100% (1.0) for prominent bars

### 🧩 CHECKLIST (VAN Mode)
- [x] Reduce horizontal shift speed and amplitude significantly
- [x] Enhance vertical bar height variation and responsiveness
- [x] Implement dynamic opacity calculation based on bar height
- [x] Set minimum opacity to 50% (0.5) for all bars
- [x] Set maximum opacity to 100% (1.0) for highest bars
- [ ] Test visual refinements with voice input
- [ ] Ensure smooth opacity transitions
- [x] Replicate SuperWhisper-style dynamic wave patterns
- [x] Create irregular, natural-looking bar height variations
- [x] Remove smooth sine wave in favor of more random, organic patterns
- [x] Increase bar count for denser visualization (40 → 60 bars)
- [x] Make animation super snappy with instant voice reaction
- [x] Remove all animation delays and smoothing
- [x] Reduce flutter/sensitivity while maintaining fast animation speeds
- [x] Find optimal balance between responsiveness and stability
- [x] Adjust center-focused amplitude distribution like SuperWhisper
- [x] Reduce height differences between adjacent bars for smoother transitions
- [x] Add tiny spacing between bars for visual separation
- [x] Ensure wave doesn't overflow screen width
- [x] Reduce smoothing to prevent lip-like shapes while maintaining natural transitions
- [x] Remove smoothing entirely to achieve jagged, individual bar variations like bottom example
- [x] Create grouped/clustered patterns like real audio waveforms (video editing style)
- [x] Implement longer-lasting patterns that evolve more gradually
- [x] Add natural "phrase" groupings instead of purely random bars

---

## 🚀 NEW TASK: Recording Button Scale Animation (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:** Make the record button grow slightly in size when pressed (recording state).

### 🔍 CONTEXT & ANALYSIS
- Current button: Static 64x64px size in all states
- Need: Subtle scale increase when in recording state
- Animation: Smooth transition between normal and enlarged states
- Visual feedback: Better user experience showing active recording

### 🧩 CHECKLIST (VAN Mode)
- [x] Add AnimationController for scale animation
- [x] Wrap button containers in AnimatedBuilder with Transform.scale
- [x] Scale up slightly (1.0 → 1.1) when recording
- [x] Smooth transition animation between states (200ms, easeInOut)
- [x] Handle animation for both provider and non-provider state modes
- [ ] Test scale animation on state changes

---
