# TASKS - SOURCE OF TRUTH

## Active Task Status
**Current Phase:** VAN Mode - Task In Progress  
**Current Task:** Add Edit Mode to Transcription Item  
**Status:** 🚧 IN PROGRESS - VAN MODE

## 🚀 NEW TASK: Add Edit Mode to Transcription Item (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:**  
Add an edit mode to the transcription item. When the edit icon is pressed, the item switches to a textarea (matching Figma), with the content focused for editing. User can save edits using the native keyboard.

**Figma Reference:**  
[Edit Mode Design](https://www.figma.com/design/9rnvs9nW71VAxiXeDBTcL1/Aqua-Flows?node-id=6764-7873&t=clbTB5p2aA5BuenE-4)

### 🔍 CONTEXT & ANALYSIS
- Editing is a key part of the "Review & Edit" user journey.
- Must match Figma for visual and interaction details.
- Should use native keyboard for save/submit.
- Needs to integrate with existing state management and update logic.

### 🧩 CHECKLIST (VAN Mode)
- [ ] Review Figma for edit mode UI/UX (icon, textarea, buttons, focus, etc).
- [ ] Update `TranscriptionItem` widget to support "edit mode" state.
- [ ] When edit icon is pressed:
  - [ ] Switch to a textarea (TextField/TextFormField) with current content.
  - [ ] Autofocus the textarea.
- [ ] Allow user to edit text and save using the native keyboard (submit action).
- [ ] Update the transcription in state/store on save.
- [ ] Provide a way to cancel edit (if present in Figma).
- [ ] Ensure UI matches Figma (spacing, colors, icons, etc).
- [ ] Test on both iOS and Android for keyboard and focus behavior.

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