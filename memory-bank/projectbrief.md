# Project Brief

## Project Name
**DolphinEcho** - A transcription app using local models

## Overview
DolphinEcho is a Flutter-based transcription application that provides offline transcription capabilities using local AI models. The app focuses on privacy and performance by processing audio locally without requiring internet connectivity for transcription services.

## Key Features
- **Local Transcription**: Uses Vosk and Whisper models for offline transcription
- **Session Management**: Organize transcriptions into user-defined sessions
- **Real-time Processing**: Live transcription with Vosk model
- **Post-processing**: High-quality transcription with Whisper model
- **Audio Recording**: Built-in recording functionality with waveform visualization
- **Data Security**: Local storage with encryption capabilities
- **Model Switching**: Dynamic switching between transcription models
- **Material Design 3**: Modern UI following Material Design principles

## Technical Stack
- **Framework**: Flutter 3.7.2+
- **State Management**: Provider pattern
- **Local Storage**: SharedPreferences, Flutter Secure Storage
- **Audio Processing**: Record package for audio capture
- **Transcription Models**: Vosk Flutter, Whisper Flutter New
- **UI Components**: Custom design system (aqua-design-system)
- **File Management**: Path Provider for local file storage

## Target Platforms
- Android
- iOS

## Development Status
- **Current Phase**: Documentation and Architecture Analysis
- **Completion**: ~85% of core architecture documented
- **Next Phase**: Feature enhancement and optimization

## Project Structure
- **lib/**: Main source code directory
  - **constants/**: Application constants
  - **managers/**: Business logic managers
  - **models/**: Data models
  - **providers/**: State management providers
  - **repositories/**: Data access layer
  - **screens/**: UI screens
  - **services/**: Services for external functionality
  - **utils/**: Utility functions
  - **widgets/**: Reusable UI components

## Current Status
Initial application structure is set up with basic navigation between home screen and settings screen. The app has integrated transcription capabilities using both Vosk and Whisper models. 