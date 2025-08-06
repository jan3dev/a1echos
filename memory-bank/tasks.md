# TASKS - SOURCE OF TRUTH

## Active Task Status
**Current Phase:** VAN Mode - Task Complete  
**Current Task:** Add Edit Mode to Transcription Item  
**Status:** ✅ TASK COMPLETE - VAN MODE

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
- [x] Review Figma for edit mode UI/UX (icon, textarea, buttons, focus, etc).
- [x] Update `TranscriptionItem` widget to support "edit mode" state.
- [x] When edit icon is pressed:
  - [x] Switch to a textarea (TextField/TextFormField) with current content.
  - [x] Autofocus the textarea.
- [x] Allow user to edit text and save using the native keyboard (submit action).
- [x] Update the transcription in state/store on save.
- [x] Provide a way to cancel edit (if present in Figma).
- [x] Ensure UI matches Figma (spacing, colors, icons, etc).
- [x] Test on both iOS and Android for keyboard and focus behavior.

---

### ✅ REFLECTION STATUS
- Implementation matches Figma and user requirements.
- Only one item can be edited at a time; all others are disabled.
- Edits save on keyboard, focus loss, or tap outside.
- Provider and state sync issues resolved.
- No regressions to live preview or selection features.
- Ready for ARCHIVE.

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
   - Use `AquaTypography.caption1` and `AquaColor.textTertiary` for both.
   - Ensure correct padding/margin per Figma.
3. **Formatting**
   - For "Created": Use `DateFormat('MMM d, yyyy').format(session.timestamp)`.
   - For "Last Modified": Use `formatSessionSubtitle(now: DateTime.now(), created: session.timestamp, lastModified: session.lastModified, modifiedPrefix: AppStrings.modifiedPrefix)`.
4. **Testing**
   - Test with sessions where created == modified (should only show created, or "Modified" label omitted).
   - Test with sessions where modified > created (should show "Modified" label).
   - Confirm no regression to menu actions (rename/delete).
   - Visual check: UI matches Figma.

#### 🧩 Subtasks
- [ ] Review Figma for date placement, spacing, and style.
- [ ] Update `SessionMoreMenu` to display both dates with correct formatting and style.
- [ ] Use `AquaTypography.caption1` and `AquaColor.textTertiary` for both.
- [ ] Ensure correct padding/margin per Figma.
- [ ] Test with different session date scenarios.
- [ ] Confirm menu actions (rename/delete) still work.
- [ ] Update tasks.md with progress.

#### 🔗 Dependencies
- Figma design reference
- `ui_components` package for typography/color
- `intl` package for date formatting

#### ⚠️ Challenges & Mitigations
- **Challenge:** Ensuring date formatting matches Figma and is consistent with session list items.
  - **Mitigation:** Use the same util and formatting logic as session list item.
- **Challenge:** Menu layout may be tight; risk of crowding.
  - **Mitigation:** Follow Figma for spacing, use subtle style.
- **Challenge:** Regression to menu actions.
  - **Mitigation:** Test all menu actions after change.

#### 🛠️ Technology Stack
- **Framework:** Flutter
- **Build Tool:** Flutter build system
- **Language:** Dart
- **Storage:** N/A (UI-only change)

#### ✅ Technology Validation Checkpoints
- [x] Project initialization command verified
- [x] Required dependencies identified and installed
- [x] Build configuration validated
- [x] Hello world verification completed
- [x] Test build passes successfully

#### 🎨 Creative Phases Required
- [ ] UI/UX Design (Figma reference, but no new creative work required)

#### 📈 Status
- [x] Initialization complete
- [x] Planning complete
- [ ] Technology validation complete
- [ ] Implementation steps

---

# Tasks

## Active Enhancements

## Enhancement Details

## Completed Enhancements
- [X] Settings Screen Footer & Banner Spacing (2024-07-15)

### Settings Screen Footer & Banner Spacing Enhancement

**Status**: Complete
**Priority**: Medium
**Estimated Effort**: Medium

### Description
Update the settings screen to:
- Position the in-app banner 24px below the settings toggles (per Figma).
- Add a footer with the app logo, "Follow us" tags (no links yet), and the app version, matching Figma design.

### Requirements
- Banner must be 24px below the settings toggles.
- Footer must include:
  - App logo (existing asset)
  - "Follow us" tags (placeholders, no links yet)
  - App version (dynamically fetched)
- Footer layout and spacing must match Figma (node 6764-7367).
- Responsive layout for different device sizes.
- All changes must be tested on iOS and Android.

### Subtasks
- [X] Review Figma for banner/toggle spacing and footer design.
- [X] Update settings screen layout for 24px banner spacing.
- [X] Add footer widget to settings screen.
- [X] Display logo in footer.
- [X] Add "Follow us" tags (no links yet).
- [X] Display app version (dynamic).
- [X] Test layout and spacing on iOS and Android.

### Dependencies
- Figma design reference (node 6764-7367)
- Existing logo asset
- package_info_plus (for app version, if not already present)

### Notes
- Use url_launcher for links in the future, but not needed yet.
- Use package_info_plus to fetch app version dynamically.
- Footer links will be added in a later step.

### Challenges & Mitigations
- Ensuring spacing matches Figma exactly: Use Figma inspect tool for pixel-perfect values.
- Footer layout may be tight on small screens: Use responsive layout and test on multiple devices.
- Fetching app version dynamically: Use package_info_plus.

### Progress
[#######--] 100% Complete

### Reflection Status
- Implementation matches Figma and user requirements.
- All subtasks completed and verified.
- See reflection document for detailed analysis.

# Task: Settings Screen Refactor (Model & Theme Selection)
- Status: ARCHIVED/COMPLETE
- Reflection: [reflection/reflection-settings-refactor.md](reflection/reflection-settings-refactor.md)
- Archive: In progress

---

## 🚀 NEW TASK: Implement Theme Support (Dark Theme & Switching) (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:**
Implement dark theme support and theme switching in the app, with the switching logic working on the theme selection screen. Use Riverpod for state management, persist the theme selection, and ensure the UI updates accordingly. Create new files for app_theme, theme_provider, and extensions.

### 🧩 CHECKLIST (VAN Mode)
- [ ] **Add Theme Model**
  - [ ] Create `AppTheme` enum and extension in `lib/models/app_theme.dart`.
- [ ] **Add Theme Providers**
  - [ ] Create `lib/providers/theme_provider.dart` with `themeProvider`, `prefsProvider`, `sharedPreferencesProvider`, and `UserPreferencesNotifier`.
- [ ] **Add Extensions**
  - [ ] Create `lib/extensions/context_extensions.dart` for `ContextX` and `AppThemeEx` extensions.
- [ ] **Integrate Provider in main.dart**
  - [ ] Wrap app with `ProviderScope`.
  - [ ] Use `themeProvider` for the app's `theme` and `darkTheme`.
- [ ] **Update Theme Selection Screen**
  - [ ] Use `ref.watch(prefsProvider).selectedTheme` to get the current theme.
  - [ ] Add a button or UI to switch theme using `ref.read(prefsProvider.notifier).switchTheme(...)`.
  - [ ] Ensure the UI updates immediately on theme change.
- [ ] **AquaColors Integration**
  - [ ] Use `AquaColors.lightColors`, `AquaColors.darkColors`, etc., as needed.
  - [ ] Add `AppThemeEx` extension for easy color access.
- [ ] **SharedPreferences Initialization**
  - [ ] Ensure `SharedPreferences` is initialized before use (async init in main or via provider).
- [ ] **Test & Verify**
  - [ ] Verify theme switching works and persists across app restarts.
  - [ ] Ensure all screens respond to theme changes.

### 📁 Files to Create/Update
- `lib/models/app_theme.dart` (new)
- `lib/providers/theme_provider.dart` (new)
- `lib/extensions/context_extensions.dart` (new)
- `lib/main.dart` (update)
- `lib/screens/theme_selection_screen.dart` (update)

---

## 🚀 NEW TASK: Centralized Error Logging with talker_flutter (VAN Mode, Level 1)

### 📝 TASK SUMMARY
**User Request:**  
Errors are currently caught silently throughout the app. Implement a centralized logging system using the `talker_flutter` package, following the logging architecture described in `LOGGING_REPORT.md` (AQUA app). Ensure all caught errors are logged.

### 🔍 CONTEXT & ANALYSIS
- Multiple try/catch blocks and `.catchError` handlers suppress exceptions without visibility.
- The AQUA app uses `talker_flutter` with `CustomLogger` and `FeatureFlag` for granular, filterable logs.
- Adopting the same pattern will improve debugging, monitoring, and maintenance.

### 🧩 CHECKLIST (VAN Mode)
- [ ] Add `talker_flutter` (and any peers like `talker_dio_logger`) to `pubspec.yaml`.
- [ ] Create `lib/logger.dart` implementing:
  - `FeatureFlag` enum listing major domains (Recording, Transcription, Session, Settings, Models, Storage, Networking, UI).
  - `CustomLogger` singleton wrapping a `TalkerFlutter` instance.
  - `enabledLogFlags` list for developer-controlled filtering.
- [ ] Initialize `CustomLogger` early in `main.dart` so logs are available app-wide (no extra UI).
- [ ] Scan the codebase for `catch` blocks / `.catchError`; replace silent handling with `logger.error(...)`.
- [ ] Add logging to `onError` callbacks in streams/providers.
- [ ] (If using Dio) Integrate `CurlLogInterceptor` to output API calls as `cURL` commands via logger.
- [ ] Smoke-test: intentionally trigger common error paths; verify logs appear in the console during debug builds.
- [ ] Update tasks.md with progress.

### 📁 Files to Create/Update
- `pubspec.yaml`