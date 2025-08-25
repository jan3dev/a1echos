import 'dart:io';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import '../logger.dart';

@pragma('vm:entry-point')
void startBackgroundCallback() {
  FlutterForegroundTask.setTaskHandler(BackgroundRecordingTaskHandler());
}

class BackgroundRecordingTaskHandler extends TaskHandler {
  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {}

  @override
  void onRepeatEvent(DateTime timestamp) {}

  @override
  Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {}

  @override
  void onReceiveData(Object data) {}

  @override
  void onNotificationButtonPressed(String id) {
    if (id == 'stop_recording') {
      FlutterForegroundTask.sendDataToMain({
        'command': 'stop_recording',
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });
    }
  }

  @override
  void onNotificationPressed() {}

  @override
  void onNotificationDismissed() {}
}

class BackgroundRecordingService {
  static BackgroundRecordingService? _instance;
  static BackgroundRecordingService get instance =>
      _instance ??= BackgroundRecordingService._();

  BackgroundRecordingService._();

  bool _isServiceRunning = false;
  bool _isActuallyRecording = false;
  Function()? _onStopRecordingCallback;

  Future<void> initialize() async {
    final notificationPermission =
        await FlutterForegroundTask.checkNotificationPermission();
    if (notificationPermission != NotificationPermission.granted) {
      await FlutterForegroundTask.requestNotificationPermission();
    }

    FlutterForegroundTask.addTaskDataCallback(_handleTaskData);

    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'echos_recording',
        channelName: 'Echos Recording',
        channelDescription: 'Background recording service for Echos',
        channelImportance: NotificationChannelImportance.LOW,
        priority: NotificationPriority.LOW,
        onlyAlertOnce: true,
        showWhen: false,
        visibility: NotificationVisibility.VISIBILITY_SECRET,
      ),
      iosNotificationOptions: const IOSNotificationOptions(
        showNotification: false,
        playSound: false,
      ),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(5000),
        autoRunOnBoot: false,
        autoRunOnMyPackageReplaced: true,
        allowWakeLock: true,
        allowWifiLock: true,
      ),
    );
  }

  void _handleTaskData(Object data) {
    if (data is Map<String, dynamic>) {
      final String? command = data['command'];
      if (command == 'stop_recording') {
        _onStopRecordingCallback?.call();
      }
    }
  }

  void setOnStopRecordingCallback(Function() callback) {
    _onStopRecordingCallback = callback;
  }

  void updateRecordingState(bool isRecording) {
    _isActuallyRecording = isRecording;

    if (_isServiceRunning) {
      FlutterForegroundTask.updateService(
        notificationTitle: 'Echos',
        notificationText: isRecording
            ? 'Recording in background'
            : 'Ready to record',
      );
    }
  }

  Future<bool> startBackgroundService() async {
    if (_isServiceRunning) {
      return true;
    }

    try {
      if (Platform.isAndroid) {
        final hasNotificationPermission =
            await FlutterForegroundTask.checkNotificationPermission();
        if (hasNotificationPermission != NotificationPermission.granted) {
          logger.error(
            'Missing notification permission',
            flag: FeatureFlag.service,
          );
          return false;
        }
      }

      await FlutterForegroundTask.startService(
        serviceId: 256,
        notificationTitle: 'Echos - Recording',
        notificationText: 'Tap to return to the app',
        callback: startBackgroundCallback,
        serviceTypes: [ForegroundServiceTypes.microphone],
        notificationButtons: [
          const NotificationButton(
            id: 'stop_recording',
            text: 'Stop Recording',
          ),
        ],
      );

      _isServiceRunning = true;
      return true;
    } catch (e, stackTrace) {
      logger.error(
        'Failed to start background service: $e',
        stackTrace: stackTrace,
        flag: FeatureFlag.service,
      );
      _isServiceRunning = false;
      return false;
    }
  }

  Future<bool> stopBackgroundService() async {
    if (!_isServiceRunning) {
      return true;
    }

    try {
      await FlutterForegroundTask.stopService();
      _isServiceRunning = false;
      return true;
    } catch (e, stackTrace) {
      logger.error(
        'Failed to stop background service: $e',
        stackTrace: stackTrace,
        flag: FeatureFlag.service,
      );
      _isServiceRunning = false;
      return false;
    }
  }

  bool get isServiceRunning => _isServiceRunning;
  bool get isActuallyRecording => _isActuallyRecording;

  void dispose() {
    FlutterForegroundTask.removeTaskDataCallback(_handleTaskData);
  }
}
