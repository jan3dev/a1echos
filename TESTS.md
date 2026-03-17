# TESTS.md — Test Coverage Task List

Complete task list for achieving 100% test coverage in Echos. 88 unit/integration test files across 10 phases, plus 7 Maestro E2E tasks. Place test files next to source files (co-located).

## Implementation Notes

- **Zustand testing**: Use `useXxxStore.getState()` for direct state access, reset with `useXxxStore.setState(initialState)` in `beforeEach`
- **Platform branching**: Set `Platform.OS = 'ios'` or `'android'` within describe blocks
- **Singleton services**: Already mocked globally in `jest.setup.js`; `clearMocks: true` in config resets all mocks between tests
- **transcriptionStore**: Depends on sessionStore and settingsStore — pre-populate those in `beforeEach`
- **Co-located tests**: Place `*.test.ts(x)` next to source files for discoverability
- **React Native Testing Library**: Use `render`, `screen`, `fireEvent`, `waitFor` from `@testing-library/react-native`

---

## Phase 1: Models (7 tasks, ~55 tests)

Pure data types, enums, and serialization helpers. Zero dependencies on native modules.

- **1. `models/AppTheme.test.ts`** — Test enum values (AUTO, LIGHT, DARK), `getThemeName()` returns correct display names, `getThemeByName()` round-trips correctly, unknown name handling
- **2. `models/ModelType.test.ts`** — Test enum values (WHISPER_FILE, WHISPER_REALTIME), exhaustive match
- **3. `models/TranscriptionState.test.ts`** — Test all state enum values (LOADING, READY, RECORDING, TRANSCRIBING, STREAMING, ERROR), verify no missing states
- **4. `models/Session.test.ts`** — `createSession()` generates unique IDs and timestamps, `sessionToJSON()` serializes all fields, `sessionFromJSON()` deserializes correctly, round-trip fidelity, handles missing optional fields, `isIncognito` flag
- **5. `models/Transcription.test.ts`** — `createTranscription()` generates unique IDs, `transcriptionToJSON()` serializes all fields including `text`, `audioUri`, `duration`, `transcriptionFromJSON()` deserializes correctly, round-trip fidelity
- **6. `models/SpokenLanguage.test.ts`** — `SupportedLanguages` array has expected entries, `findByCode()` returns correct language, `findByCode()` with unknown code, `countryCodeFor()` returns correct flag codes, `transcribeOptionsFor()` returns valid Whisper options
- **7. `constants/AppConstants.test.ts`** — Verify `SESSION_NAME_MAX_LENGTH`, `AUDIO_SAMPLE_RATE` (16000), `AUDIO_BIT_RATE`, `AUDIO_NUM_CHANNELS` (1), `WORDS_PER_PARAGRAPH`, `SENTENCES_PER_PARAGRAPH`

## Phase 2: Utils (6 tasks, ~55 tests)

Utility functions with minimal dependencies. Some require fake timers.

- **8. `utils/delay.test.ts`** — `delay(ms)` resolves after specified ms (use `jest.useFakeTimers()`), resolves with undefined
- **9. `utils/TranscriptionFormatter.test.ts`** — `formatTranscriptionText()`: empty string, single word, trims whitespace, handles punctuation normalization, paragraph splitting at `WORDS_PER_PARAGRAPH` boundary, multiple sentences, special characters
- **10. `utils/ripple.test.ts`** — `iosPressed()`: returns pressed style on iOS, returns empty/null on Android, handles `pressed=true` and `pressed=false`
- **11. `utils/log.test.ts`** — `FeatureFlag` enum has all expected keys (recording, transcription, session, settings, model, storage, ui, service, store, general), `logFor()` returns logger, `logDebug/logInfo/logWarn/logError` call underlying logger, `logError` handles Error objects and strings
- **12. `utils/WavWriter.test.ts`** — `createPcmStreamWriter()`: returns writer object, `write()` appends data, `finalize()` produces valid WAV header, `abort()` cleans up, `getByteCount()` tracks bytes written, error handling on write after finalize
- **13. `utils/index.test.ts`** — `formatDate()` formats dates correctly, `formatSessionSubtitle()` returns formatted subtitle string with duration/transcription count, edge cases (zero duration, no transcriptions)

## Phase 3: Theme (7 tasks, ~40 tests)

Theme system including Zustand store and React hook.

- **14. `theme/colors.test.ts`** — `AquaPrimitiveColors` object has expected color keys, values are valid hex/rgb strings
- **15. `theme/themeColors.test.ts`** — `lightColors` and `darkColors` have matching keys, all values are strings, specific semantic colors exist (background, text, primary, etc.)
- **16. `theme/typography.test.ts`** — Typography scale has expected keys (display, headline, title, body, label), each entry has `fontSize`, `lineHeight`, `fontFamily`, `fontWeight`
- **17. `theme/spacing.test.ts`** — Spacing object has expected keys, values are numbers, values increase monotonically
- **18. `theme/shadows.test.ts`** — Shadow definitions exist for expected keys, `getShadow()` returns iOS shadow props on iOS, returns Android elevation on Android, platform-specific behavior
- **19. `theme/useThemeStore.test.ts`** — Zustand store initializes with default theme (AUTO), `setTheme()` updates state, persists to AsyncStorage, `getTheme()` resolves AUTO to system preference
- **20. `theme/useTheme.test.ts`** — Hook returns complete theme object with `colors`, `typography`, `spacing`, `shadows`, `isDark` boolean, responds to theme changes

## Phase 4: Services (8 tasks, ~130 tests)

Core business logic services. All native modules mocked in `jest.setup.js`.

- **21. `services/PermissionService.test.ts`** — `getRecordPermission()` returns granted/denied/undetermined, `requestRecordPermission()` calls expo-audio, `ensureRecordPermission()` checks then requests if needed, `openAppSettings()` calls Linking, error handling for permission check failure
- **22. `services/AudioSessionService.test.ts`** — `ensureRecordingMode()` calls `setAudioModeAsync` on iOS, no-op on Android, idempotency (second call reuses promise), error recovery (retries after failure), correct audio mode options
- **23. `services/ShareService.test.ts`** — `shareTranscriptions()` formats single transcription, formats multiple transcriptions joined by double newline, calls `Share.share()` with correct message, throws on empty array
- **24. `services/EncryptionService.test.ts`** — `encrypt()` calls AesGcmCrypto with key, returns `iv:content+tag` format, `decrypt()` parses format and calls AesGcmCrypto, key generation on first use, key caching from SecureStore, error handling for encryption/decryption failures
- **25. `services/BackgroundRecordingService.test.ts`** — `start()` launches foreground service on Android, no-op on iOS, `stop()` stops service, notification permission request on Android 13+, error handling, `registerForegroundService()`
- **26. `services/StorageService.test.ts`** — Session CRUD: save/load/delete sessions via AsyncStorage, Transcription CRUD: save/load/delete transcriptions via file system, audio file encryption on save, decryption on load, pending deletes queue, corruption recovery (invalid JSON), active session persistence, directory creation
- **27. `services/AudioService.test.ts`** — `startRecording()` on iOS uses AudioRecorder, on Android uses AudioRecord PCM stream, `stopRecording()` returns file URI, amplitude reporting, `dispose()` cleanup, error handling for recording failures, permission check before recording
- **28. `services/WhisperService.test.ts`** — `initialize()` loads model assets and creates WhisperContext, `transcribeFile()` transcribes audio file via context, realtime transcription setup with RealtimeTranscriber, `dispose()` releases contexts, error handling for model load failure, VAD initialization

## Phase 5: Stores (4 tasks, ~120 tests)

Zustand stores — the most complex testing targets.

- **29. `stores/settingsStore.test.ts`** — `initializeSettingsStore()` loads persisted settings, `setTheme()` updates and persists, `setModelType()` updates and persists, `setLanguage()` updates and persists, `setIncognitoMode()` updates and persists, default values on first load, corrupted storage recovery
- **30. `stores/uiStore.test.ts`** — Selection mode: `enterSelectionMode()`, `exitSelectionMode()`, `toggleItemSelection()`, `selectAll()`, `clearSelection()`, Toast: `showToast()` with variants (success, error, info), auto-dismiss timer, Tooltip: `showGlobalTooltip()`, `hideGlobalTooltip()`, Recording controls: `showRecordingControls()`, `hideRecordingControls()`, visibility state
- **31. `stores/sessionStore.test.ts`** — `initializeSessionStore()` loads sessions from storage, `createSession()` adds session and persists, `deleteSession()` removes and persists, `renameSession()` updates name, `switchSession()` sets active session, `getActiveSession()` returns current, incognito session creation/cleanup, session naming (auto-generated names), session sorting (most recent first), duplicate session prevention
- **32. `stores/transcriptionStore.test.ts`** — State machine transitions: IDLE→RECORDING_STARTING→RECORDING→RECORDING_STOPPING→TRANSCRIBING→TRANSCRIPTION_COMPLETE→IDLE, invalid transitions rejected, operation locking (prevent concurrent recordings), `startRecording()` coordinates PermissionService→AudioSessionService→WhisperService→AudioService, `stopRecordingAndSave()` stops audio→transcribes→saves, transcription CRUD (add/delete/get by session), live preview updates during recording, error state handling and recovery, audio level updates

## Phase 6: Hooks (4 tasks, ~30 tests)

React hooks — test with `renderHook` from `@testing-library/react-native`.

- **33. `hooks/usePermissions.test.ts`** — Mount triggers permission check, `requestPermission()` calls PermissionService, AppState change to active re-checks permission, returns `{ granted, status, canAskAgain, requestPermission }`
- **34. `hooks/useBackgroundRecording.test.ts`** — AppState transition to background starts background service, AppState transition to foreground stops background service, amplitude pause/resume on background/foreground, no-op when not recording
- **35. `hooks/useLocalization.test.ts`** — Returns `t` function that translates keys, returns `loc` object with i18n instance, language switching works
- **36. `hooks/useSessionOperations.test.ts`** — `deleteSession()` deletes session and all associated transcriptions, `endIncognitoSession()` clears incognito session data, error handling and toast notifications

## Phase 7: UI Components (23 tasks, ~120 tests)

Primitive UI components. Test rendering, props, and user interactions.

- **37. `components/ui/text/Text.test.tsx`** — Renders children text, applies variant styles (body, headline, etc.), applies custom style prop, handles numberOfLines
- **38. `components/ui/button/Button.test.tsx`** — Renders label text, onPress fires callback, disabled state prevents onPress and applies styles, loading state shows indicator, variant styles (primary, secondary, text)
- **39. `components/ui/checkbox/Checkbox.test.tsx`** — Renders unchecked by default, toggles on press, controlled mode with `checked` and `onChange`, disabled state, accessibility label
- **40. `components/ui/radio/Radio.test.tsx`** — Renders unselected by default, selects on press, controlled mode, disabled state, group behavior (only one selected), accessibility
- **41. `components/ui/toggle/Toggle.test.tsx`** — Renders off by default, toggles on press, controlled mode with `value` and `onValueChange`, disabled state, accessibility
- **42. `components/ui/textfield/TextField.test.tsx`** — Renders with placeholder, text input fires onChangeText, error state styling, label rendering, multiline support, max length
- **43. `components/ui/slider/Slider.test.tsx`** — Renders with default value, value change callback, min/max bounds, step increments, disabled state
- **44. `components/ui/icon/Icon.test.tsx`** — Renders with icon name, applies size prop, applies color prop, handles missing icon gracefully
- **45. `components/ui/icon/FlagIcon.test.tsx`** — Renders flag for country code, handles unknown country code, applies size prop
- **46. `components/ui/divider/Divider.test.tsx`** — Renders horizontal line, applies custom style, vertical orientation if supported
- **47. `components/ui/skeleton/Skeleton.test.tsx`** — Renders placeholder shape, applies width/height, animation runs
- **48. `components/ui/surface/Surface.test.tsx`** — Renders children, applies elevation/shadow, applies background color from theme
- **49. `components/ui/card/Card.test.tsx`** — Renders children, applies elevation, onPress makes it pressable, applies custom style
- **50. `components/ui/modal/Modal.test.tsx`** — Renders when visible=true, hidden when visible=false, renders children content, close button/backdrop press calls onClose
- **51. `components/ui/modal/useModal.test.ts`** — `open()` sets visible=true, `close()` sets visible=false, `toggle()` flips state, initial state is closed
- **52. `components/ui/modal/Dimmer.test.tsx`** — Renders semi-transparent overlay, onPress calls onDismiss, applies custom opacity
- **53. `components/ui/toast/Toast.test.tsx`** — Renders message text, applies variant styling (success, error, info), action button fires callback, auto-dismiss after timeout
- **54. `components/ui/toast/useToast.test.ts`** — `show()` adds toast, `dismiss()` removes toast, auto-dismiss timer, multiple toasts queue
- **55. `components/ui/tooltip/Tooltip.test.tsx`** — Renders tooltip content, positions relative to anchor, dismiss on backdrop press
- **56. `components/ui/tooltip/useTooltip.test.ts`** — `show()` makes tooltip visible, `hide()` hides tooltip, position tracking
- **57. `components/ui/top-app-bar/TopAppBar.test.tsx`** — Renders title, renders back button when navigable, back button fires navigation, renders action buttons, applies theme styling
- **58. `components/ui/progress/ProgressIndicator.test.tsx`** — Renders with progress value (0-1), indeterminate mode animation, applies color prop, accessibility value
- **59. `components/ui/ripple-pressable/RipplePressable.test.tsx`** — Renders children, onPress fires callback, Android shows ripple effect, iOS shows opacity feedback, disabled state

## Phase 8: Shared Components (7 tasks, ~35 tests)

Cross-feature reusable components.

- **60. `components/shared/error-view/AppErrorBoundary.test.tsx`** — Catches render errors, displays fallback UI, error info passed to fallback, recovery action works
- **61. `components/shared/error-view/ErrorView.test.tsx`** — Renders error message, renders retry button, retry calls onRetry callback, renders icon
- **62. `components/shared/list-item/ListItem.test.tsx`** — Renders title and subtitle, onPress fires callback, renders leading/trailing elements, long press fires callback, selection state styling
- **63. `components/shared/recording-controls/RecordingButton.test.tsx`** — Renders microphone icon, onPress starts/stops recording, visual state changes (idle, recording, processing), disabled state, haptic feedback trigger
- **64. `components/shared/recording-controls/RecordingControlsView.test.tsx`** — Renders recording button, shows timer during recording, shows audio level indicator, lock indicator interaction, visibility controlled by uiStore
- **65. `components/shared/recording-controls/LockIndicator.test.tsx`** — Renders lock icon, visual state (locked/unlocked), animation on state change
- **66. `components/shared/recording-controls/ThreeWaveLines.test.tsx`** — Renders SVG wave lines, amplitude prop controls wave height, animation active during recording

## Phase 9: Domain Components (15 tasks, ~75 tests)

Feature-specific components. May require store pre-population.

- **67. `components/domain/home/EmptyStateView.test.tsx`** — Renders empty state illustration, renders instructional text, renders CTA button
- **68. `components/domain/home/HomeAppBar.test.tsx`** — Renders app title, renders settings icon button, settings button navigates to settings, renders incognito indicator when active
- **69. `components/domain/home/HomeContent.test.tsx`** — Shows empty state when no sessions, renders session list when sessions exist, pull-to-refresh triggers reload
- **70. `components/domain/home/IncognitoExplainerModal.test.tsx`** — Renders explanation text, renders enable/cancel buttons, enable button activates incognito mode, close/cancel dismisses modal
- **71. `components/domain/session/SessionAppBar.test.tsx`** — Renders session name, back button navigates back, more menu button opens menu, edit name interaction
- **72. `components/domain/session/SessionInputModal.test.tsx`** — Renders text input with current session name, save button calls rename, cancel dismisses, validates name length against `SESSION_NAME_MAX_LENGTH`, empty name handling
- **73. `components/domain/session/SessionList.test.tsx`** — Renders list of sessions, empty list shows empty component, scroll behavior, selection mode multi-select
- **74. `components/domain/session/SessionListItem.test.tsx`** — Renders session name, renders subtitle with date/transcription count, onPress navigates to session detail, long press enters selection mode, selection checkbox in selection mode
- **75. `components/domain/session/SessionMoreMenu.test.tsx`** — Renders menu options (rename, delete, share), rename opens input modal, delete shows confirmation, share calls ShareService
- **76. `components/domain/settings/InAppBanner.test.tsx`** — Renders banner content, renders action button, dismiss hides banner
- **77. `components/domain/settings/SettingsFooter.test.tsx`** — Renders version info, renders support links, links open correctly
- **78. `components/domain/transcription/LiveTranscriptionView.test.tsx`** — Renders live transcription text, updates with new text, shows streaming indicator, empty state when no text yet
- **79. `components/domain/transcription/TranscriptionContentView.test.tsx`** — Renders transcription text, renders timestamp, copy to clipboard action, share action
- **80. `components/domain/transcription/TranscriptionItem.test.tsx`** — Renders transcription preview, onPress navigates to detail, long press enters selection mode, selection state, timestamp display
- **81. `components/domain/transcription/TranscriptionList.test.tsx`** — Renders list of transcriptions for session, empty state message, multi-select toolbar with delete/share actions, scroll behavior

## Phase 10: App Screens (7 tasks, ~40 tests)

Full screen integration tests. Require store and navigation mocking.

- **82. `app/(pages)/index.test.tsx`** — Renders home screen with HomeContent, shows recording controls, navigation to session detail works, incognito mode visual indicator
- **83. `app/(pages)/session/[id].test.tsx`** — Renders session detail with transcription list, shows session app bar with name, recording controls visible, handles missing session ID gracefully, live transcription view during recording
- **84. `app/(pages)/settings/index.test.tsx`** — Renders settings list (theme, model, language, incognito), each item navigates to sub-screen, incognito toggle works, contact support link
- **85. `app/(pages)/settings/theme.test.tsx`** — Renders theme options (Auto, Light, Dark), selecting theme updates settingsStore, current theme is highlighted, preview of theme change
- **86. `app/(pages)/settings/model.test.tsx`** — Renders model options (File, Realtime), selecting model updates settingsStore, current model is highlighted, description text for each option
- **87. `app/(pages)/settings/language.test.tsx`** — Renders language list, selecting language updates settingsStore, current language is highlighted, flag icons display correctly
- **88. `app/_layout.test.tsx`** — Root layout renders without crash, store initialization order (settings→session→transcription), global components rendered (recording controls, tooltip renderer, background handler), error boundary wraps content, splash screen hide after init

## Phase 11: Maestro E2E (7 tasks)

End-to-end flows on a running development build using Maestro.

- **89. Set up `.maestro/` directory** — Create `config.yaml`, `flows/` directory structure, shared helpers
- **90. Recording flows** — File mode: tap record → wait → tap stop → verify transcription appears. Realtime mode: long-press record → verify live text → release → verify save
- **91. Session flows** — Auto-session creation on first recording, rename session via menu, delete session with confirmation, switch between sessions
- **92. Settings flows** — Navigate to settings, change theme (verify visual change), change model type, change language, toggle incognito mode
- **93. Transcription flows** — Delete single transcription, share transcription, multi-select and batch delete, multi-select and batch share
- **94. Onboarding flows** — First launch permission prompt, grant permission → recording enabled, deny permission → settings redirect
- **95. Integration flows** — Full cycle: open app → record → transcribe → view → share → delete session → verify cleanup

---

## Progress Tracking

| Phase                | Tasks  | Tests (est.) | Status      |
| -------------------- | ------ | ------------ | ----------- |
| 1. Models            | 7      | ~55          | Done        |
| 2. Utils             | 6      | ~55          | Done        |
| 3. Theme             | 7      | ~40          | Not started |
| 4. Services          | 8      | ~130         | Not started |
| 5. Stores            | 4      | ~120         | Not started |
| 6. Hooks             | 4      | ~30          | Not started |
| 7. UI Components     | 23     | ~120         | Not started |
| 8. Shared Components | 7      | ~35          | Not started |
| 9. Domain Components | 15     | ~75          | Not started |
| 10. App Screens      | 7      | ~40          | Not started |
| 11. Maestro E2E      | 7      | —            | Not started |
| **Total**            | **95** | **~700**     |             |
