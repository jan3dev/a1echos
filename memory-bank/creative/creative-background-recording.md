🎨🎨🎨 ENTERING CREATIVE PHASE: ARCHITECTURE & UI/UX DESIGN

# Background Recording Feature – Creative Design Document

## 1. Component Description
Enable continuous audio recording—even when the application is in the background—while maintaining the existing real-time transcription flow. The component spans three primary concerns:
1. **Service Architecture** – Integrating `AudioService` with a foreground/background service.
2. **User Experience** – Providing clear feedback, controls, and smooth state transitions.
3. **Error Recovery** – Ensuring resilience against OS interruptions and user actions.

## 2. Requirements & Constraints
- **Functional**
  - Recording must persist when the user backgrounds the app or locks the device.
  - Transcription pipeline should continue without data loss.
  - User must be able to stop or return to the recording via system notification.
- **Technical**
  - Use `flutter_foreground_task` for Android; iOS limited background execution (~30 s/15 min).
  - Maintain existing `AudioService` API for start/stop/streaming.
  - Two-way isolate communication for state sync.
- **UX / Compliance**
  - Persistent notification (Android) showing recording status + actionable buttons.
  - On iOS, fallback guidance if background limits are hit.
  - Honour microphone & battery-optimization permissions.
- **Non-Functional**
  - Minimal battery impact (LOW notification channel, wake-lock only when recording).
  - Resilient to process kills—service restart & state restoration.

## 3. Options Exploration
### Option A – **Service Wrapper Pattern** (Recommended)
```
UI ←→ Provider State ←→ BackgroundRecordingService ↔ FlutterForegroundTask ↔ BackgroundRecordingTaskHandler ↔ AudioService
```
• A thin wrapper (`BackgroundRecordingService`) mediates between UI/Providers and `flutter_foreground_task`, encapsulating all background logic.
• `AudioService` remains single-source of truth for audio APIs; task handler calls it directly.
• State changes are sent over the communication port and merged into providers.

### Option B – **Dual AudioService Instances**
Separate `AudioService` instances in main-isolate and background isolate. Each manages its own recorder.
• Simpler initial glue but risks file collisions and race conditions.
• Complex state reconciliation.

### Option C – **Dedicated Platform Channels**
Bypass `flutter_foreground_task`; implement native platform services (Android Foreground, iOS BGAudio) via MethodChannels.
• Maximum control & performance.
• Significantly higher maintenance cost & platform code.

## 4. Pros & Cons Analysis
| Option | Pros | Cons |
|--------|------|------|
|A – Wrapper|• Keeps current Dart-only architecture.<br>• Clear single responsibility per class.<br>• Easy unit testing of wrapper.<br>• Minimal changes to existing code.|• Requires careful isolate communication design.<br>• Still subject to iOS BG limits.|
|B – Dual Service|• Very little wrapper code.<br>• Background isolate fully owns audio.|• Duplicate recorder instances.<br>• Sync complexity & potential data loss.<br>• Harder debugging.|
|C – Platform Channels|• Full native power.<br>• Potentially better iOS handling.|• Large native codebase.<br>• Higher QA surface.<br>• Divergent feature parity across OS.|

## 5. Recommended Approach – **Option A: Service Wrapper Pattern**
The wrapper balances maintainability with capability, leverages existing Dart packages, and limits native code exposure.

### Justification
- Aligns with current Flutter-centric stack.
- Enables future reuse (e.g., background uploads, analytics) via same wrapper.
- Minimises app store review risk—uses approved plugin.

## 6. Implementation Guidelines
1. **Wrapper Responsibilities**
   - Initialise permissions & `FlutterForegroundTask.init`.
   - Expose `startBackgroundRecording()` and `stopBackgroundRecording()`.
   - Translate provider events into messages for background isolate.
2. **Task Handler Responsibilities**
   - On `onStart`, call `AudioService.startRecording()`.
   - On `onRepeatEvent`, update notification & stream VAD if needed.
   - On `onDestroy`, safely stop recording & flush buffers.
3. **State Synchronisation**
   - Use `FlutterForegroundTask.sendDataToMain` every 5 s with `{status, timestamp}`.
   - Providers listen and update UI (recording controls, banners).
4. **iOS Strategy**
   - Use background fetch; record short chunks (≤30 s) then pause.
   - Display dialog the first time informing users of limitations.
   - Offer “Keep App Open” banner when user starts long recordings on iOS.
5. **Notification UX**
   - Title: “Echos – Recording in Background”.
   - Text cycles timestamps; button: “Stop”.
   - Tapping notification navigates to session screen.
6. **Error Handling**
   - Listen to `onTaskRemoved` / `onDestroy` events; attempt graceful shutdown.
   - On restart (`autoRunOnBoot == false`), restore session from persistent storage.
7. **Testing Matrix**
   - Android 12, 13, 14 (microphone service type).
   - iOS 15+ background fetch window.
   - Battery-optimization off/on.
   - Screen-lock, app-switch, incoming call.

## 7. Verification Checkpoint
- [ ] Architecture aligns with wrapper pattern.
- [ ] Notification design reviewed & approved.
- [ ] Error recovery flow diagram created.
- [ ] iOS limitation messaging finalised.

🎨🎨🎨 EXITING CREATIVE PHASE
