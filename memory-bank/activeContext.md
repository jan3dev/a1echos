# Active Context

## Current Focus
Analyzing the transcription app structure and understanding key components with special focus on provider-based state management implementation.

## Key Components Under Review
- SessionProvider for managing user sessions
- LocalTranscriptionProvider for handling transcription functionality
- Transcription models integration (Vosk and Whisper)
- Audio recording and processing

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

## Active Questions
1. How are audio recordings captured and stored?
2. What is the exact flow for transcription using local models?
3. How is the transcription data structured in the models?
4. What are the key differences between Vosk and Whisper implementation?
5. How is error handling implemented across the application?

## Current Task Focus
- Examining SessionProvider and LocalTranscriptionProvider implementation
- Understanding model switching and initialization logic
- Analyzing the relationship between sessions and transcriptions

## Recent Insights
- SessionProvider uses UUID for unique session identification
- LocalTranscriptionProvider coordinates multiple services (VoskService, WhisperService, AudioService)
- Application allows switching between Vosk and Whisper models
- TranscriptionState enum manages application state
- SessionTranscriptionManager handles filtering transcriptions by session 