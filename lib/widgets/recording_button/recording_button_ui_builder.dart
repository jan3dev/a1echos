import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:ui_components/ui_components.dart';
import '../../providers/local_transcription_provider.dart';
import '../../providers/transcription_state_manager.dart';
import '../../utils/utils.dart';

/// Mixin that handles all UI building logic for the RecordingButton
/// Manages widget rendering for different transcription states
mixin RecordingButtonUIBuilder<T extends StatefulWidget> on State<T> {
  Animation<double> get scaleAnimation;
  double get dragOffsetY;
  bool get isDebouncing;
  bool get gestureIsolationActive;
  bool get isLocked;

  void Function(LongPressStartDetails, LocalTranscriptionProvider?)
  get onLongPressStartHandler;
  void Function(LongPressMoveUpdateDetails) get onLongPressMoveUpdateHandler;
  void Function(LongPressEndDetails, LocalTranscriptionProvider?)
  get onLongPressEndHandler;
  Future<void> Function(LocalTranscriptionProvider?)
  get handleStopLockedRecordingHandler;
  Future<void> Function(LocalTranscriptionProvider?)
  get handleStopRecordingHandler;

  /// Builds the button widget with proper animations and transforms
  Widget buildButtonForState(
    TranscriptionState state,
    AquaColors colors,
    LocalTranscriptionProvider? provider,
  ) {
    return AnimatedBuilder(
      animation: scaleAnimation,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, dragOffsetY),
          child: Transform.scale(
            scale: scaleAnimation.value,
            child: buildButtonContainer(state, colors, provider),
          ),
        );
      },
    );
  }

  /// Builds the button container based on the current transcription state
  Widget buildButtonContainer(
    TranscriptionState state,
    AquaColors colors,
    LocalTranscriptionProvider? provider,
  ) {
    switch (state) {
      case TranscriptionState.loading:
      case TranscriptionState.transcribing:
        return buildLoadingButton(colors);

      case TranscriptionState.error:
        return buildErrorButton(colors, provider);

      case TranscriptionState.recording:
        return buildRecordingButton(colors, provider);

      case TranscriptionState.ready:
        return buildReadyButton(colors, provider);
    }
  }

  /// Builds the button for loading/transcribing states
  Widget buildLoadingButton(AquaColors colors) {
    return Container(
      width: 64,
      height: 64,
      decoration: BoxDecoration(
        color: colors.glassInverse.withOpacity(0.5),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: colors.glassInverse.withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 0),
          ),
        ],
      ),
      child: Center(
        child: SvgPicture.asset(
          'assets/icons/mic.svg',
          width: 24,
          height: 24,
          colorFilter: ColorFilter.mode(colors.textInverse, BlendMode.srcIn),
        ),
      ),
    );
  }

  /// Builds the button for error state
  Widget buildErrorButton(
    AquaColors colors,
    LocalTranscriptionProvider? provider,
  ) {
    return Container(
      width: 64,
      height: 64,
      decoration: BoxDecoration(
        color: colors.accentDanger,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: colors.surfaceInverse.withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 0),
          ),
        ],
      ),
      child: IconButton(
        onPressed: (isDebouncing || gestureIsolationActive)
            ? null
            : () {
                if (provider != null) {
                  showModelErrorDialog(context, provider.error);
                }
              },
        icon: Icon(Icons.error_outline, color: colors.textInverse),
      ),
    );
  }

  /// Builds the button for recording state
  Widget buildRecordingButton(
    AquaColors colors,
    LocalTranscriptionProvider? provider,
  ) {
    return GestureDetector(
      onLongPressEnd: (details) => onLongPressEndHandler(details, provider),
      onLongPressMoveUpdate: onLongPressMoveUpdateHandler,
      child: Container(
        width: 64,
        height: 64,
        decoration: BoxDecoration(
          color: colors.accentBrand,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: colors.accentBrand.withOpacity(0.3),
              blurRadius: 24,
              offset: const Offset(0, 0),
            ),
          ],
        ),
        child: IconButton(
          onPressed: (isDebouncing || gestureIsolationActive)
              ? null
              : () => isLocked
                    ? handleStopLockedRecordingHandler(provider)
                    : handleStopRecordingHandler(provider),
          icon: SvgPicture.asset(
            'assets/icons/rectangle.svg',
            width: 14,
            height: 14,
            colorFilter: ColorFilter.mode(colors.textInverse, BlendMode.srcIn),
          ),
        ),
      ),
    );
  }

  /// Builds the button for ready state
  Widget buildReadyButton(
    AquaColors colors,
    LocalTranscriptionProvider? provider,
  ) {
    return GestureDetector(
      onLongPressStart: (details) => onLongPressStartHandler(details, provider),
      onLongPressMoveUpdate: onLongPressMoveUpdateHandler,
      onLongPressEnd: (details) => onLongPressEndHandler(details, provider),
      child: Container(
        width: 64,
        height: 64,
        decoration: BoxDecoration(
          color: colors.glassInverse,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: colors.glassInverse.withOpacity(0.04),
              blurRadius: 16,
              offset: const Offset(0, 0),
            ),
          ],
        ),
        child: IconButton(
          onPressed: null,
          icon: SvgPicture.asset(
            'assets/icons/mic.svg',
            width: 24,
            height: 24,
            colorFilter: ColorFilter.mode(colors.textInverse, BlendMode.srcIn),
          ),
        ),
      ),
    );
  }

  /// Shows error dialog for model issues
  void showModelErrorDialog(BuildContext context, String? errorMessage) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.loc.modelNotReady),
        content: Text(errorMessage ?? context.loc.modelInitFailure),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(context.loc.ok),
          ),
        ],
      ),
    );
  }
}
