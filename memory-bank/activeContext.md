# Active Context

## Current Focus
Analyzing the transcription app structure with detailed understanding of:
1. Transcription orchestration between different model types
2. Audio recording and processing workflow
3. Data persistence patterns across the application

## Key Components Under Review
- TranscriptionOrchestrator for coordinating transcription workflow
- SessionTranscriptionManager for handling session-based filtering
- Vosk and Whisper model integration differences
- Error handling patterns throughout the application

## Provider Analysis
### SessionProvider
- Manages user-created sessions for organizing transcriptions
- Uses SharedPreferences for persistent storage
- Stores session data in JSON format
- Includes functionality for creating, renaming, switching, and deleting sessions

### LocalTranscriptionProvider
- Complex provider coordinating multiple services and components
- Handles different transcription models (Vosk and Whisper)
- Manages recording state (loading, ready, recording, transcribing, error)
- Includes session-based filtering of transcriptions
- Coordinates with SessionProvider for organizing transcriptions
- Uses TranscriptionOrchestrator and SessionTranscriptionManager for business logic
- Manages model switching through the changeModel method
- Persists model selection preference using SharedPreferences

## Transcription Orchestration
- TranscriptionOrchestrator class coordinates the recording and transcription process
- Different workflows for Vosk and Whisper models:
  - Vosk: Real-time streaming transcription with partial results during recording
  - Whisper: Post-recording transcription of saved audio file
- StreamController used to broadcast partial transcription updates
- Audio file management for Whisper includes temporary file handling
- Accumulated text management for Vosk to build complete transcriptions

## Data Models
- Session model with id, name, timestamp, lastModified, and isTemporary fields
- Transcription model with id, sessionId, text, timestamp, and audioPath
- ModelType enum for differentiating between Vosk and Whisper
- TranscriptionOutput class for capturing transcription results and audio paths

## Core Services
- AudioService: Handles recording functionality and audio file management
- VoskService: Interfaces with the Vosk transcription model
- WhisperService: Interfaces with the Whisper transcription model
- StorageService: Manages file storage for audio recordings and transcriptions
- EncryptionService: Provides encryption functionality for sensitive data

## UI Architecture
- Material Design 3 implementation
- HomeScreen as the main interface with drawer for session management
- Settings screen for model configuration
- Custom widgets for specific functionality like AudioWaveVisualization and RecordingButton
- External UI components from aqua-design-system repository

## State Management
- TranscriptionState enum manages application state:
  - loading: Initial state during initialization
  - ready: Model loaded and ready for recording
  - recording: Actively recording audio
  - transcribing: Processing recorded audio (especially for Whisper)
  - error: Error state with associated error message

## Error Handling
- Dedicated error state in TranscriptionState enum
- Error messages stored with corresponding state
- try/catch blocks throughout the codebase with detailed error logging
- Developer logging for debugging and error tracking
- UI feedback for error states

## Current Task Focus
- Documenting the complete transcription process flow from recording to saving
- Mapping error handling patterns across the application
- Analyzing data persistence approaches for transcriptions and audio files

## Recent Insights
- TranscriptionOrchestrator handles different workflows for Vosk and Whisper models
- Vosk provides real-time streaming transcription while Whisper processes complete recordings
- Error handling includes comprehensive logging and user feedback
- Model selection is persisted using SharedPreferences
- Audio file management differs between models (Whisper saves audio files, Vosk doesn't)

## Active Questions
1. How are audio recordings captured and stored?
2. What is the exact flow for transcription using local models?
3. How is the transcription data structured and persisted?
4. What are the key differences between Vosk and Whisper implementation?
5. How is error handling implemented across the application?
6. How does the SessionTranscriptionManager filter transcriptions?
7. What is the initialization process for transcription models?

## Current Task Focus
- Understanding transcription orchestration and model switching logic
- Analyzing the relationship between TranscriptionOrchestrator and services
- Mapping the audio recording and processing workflow
- Documenting data persistence approaches

## Recent Insights
- SessionProvider uses UUID for unique session identification
- LocalTranscriptionProvider coordinates multiple services (VoskService, WhisperService, AudioService)
- Application allows switching between Vosk and Whisper models
- TranscriptionState enum manages application state
- SessionTranscriptionManager handles filtering transcriptions by session
- Error handling includes dedicated UI components and error state management
- Multiple specialized views depending on the transcription state 