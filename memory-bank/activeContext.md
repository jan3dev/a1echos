# Active Context

## Current Focus
Analyzing the transcription app structure and understanding key components with special focus on:
1. Provider-based state management implementation
2. Transcription orchestration between different model types
3. Audio recording and processing workflow

## Key Components Under Review
- SessionProvider for managing user sessions
- LocalTranscriptionProvider for handling transcription functionality
- Transcription models integration (Vosk and Whisper)
- Audio recording and processing
- TranscriptionOrchestrator for coordinating transcription workflow
- SessionTranscriptionManager for handling session-based filtering

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

## Data Models
- Session model with id, name, timestamp, lastModified, and isTemporary fields
- Transcription model with id, sessionId, text, timestamp, and audioPath
- ModelType enum for differentiating between Vosk and Whisper

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