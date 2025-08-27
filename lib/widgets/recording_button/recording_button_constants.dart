import 'package:flutter/material.dart';

/// Constants used by the recording button and its components
class RecordingButtonConstants {
  // Timing constants
  static const Duration debounceDuration = Duration(milliseconds: 800);
  static const Duration minimumActionInterval = Duration(milliseconds: 1200);
  static const Duration gestureIsolationDuration = Duration(milliseconds: 2000);
  static const Duration longPressDuration = Duration(milliseconds: 500);
  
  // Animation durations
  static const Duration scaleAnimationDuration = Duration(milliseconds: 200);
  static const Duration lockIndicatorAnimationDuration = Duration(milliseconds: 300);
  
  // Swipe to lock constants
  static const double lockThreshold = 80.0; // Distance to swipe up to lock
  static const double maxSlideDistance = 96.0; // Maximum slide distance
  
  // Animation values
  static const double scaleAnimationBegin = 1.0;
  static const double scaleAnimationEnd = 1.1;
  static const double lockIndicatorAnimationBegin = 0.0;
  static const double lockIndicatorAnimationEnd = 1.0;
  
  // Animation curves
  static const Curve scaleAnimationCurve = Curves.easeInOut;
  static const Curve lockIndicatorAnimationCurve = Curves.easeOut;
}
