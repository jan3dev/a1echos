# Project Brief: dolphinecho - Transcription App

## Overview
dolphinecho is a Flutter-based mobile application for transcribing audio using local models. The application provides users with the ability to record audio and generate transcriptions without relying on cloud-based services, ensuring privacy and offline functionality.

## Key Features
- Audio recording functionality
- Local transcription using Vosk and Whisper models
- Session management for organizing recordings and transcriptions
- Settings configuration for transcription models and parameters
- File management for recordings and transcriptions

## Technical Stack
- Flutter (SDK ^3.7.2) for cross-platform mobile development
- Provider package for state management
- Local storage for data persistence
- Audio recording capabilities via the record package
- Transcription via vosk_flutter and whisper_flutter_new packages

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