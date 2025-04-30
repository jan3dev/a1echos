# Active Context

## Current Focus
Analyzing the transcription app structure and establishing a clear understanding of the codebase organization, architecture, and functionality.

## Key Components Under Review
- Main application structure and navigation flow
- Provider-based state management implementation
- Audio recording and transcription mechanisms
- Session management for organizing recordings and transcriptions

## Active Questions
1. How are audio recordings captured and stored?
2. What is the flow for transcription using local models?
3. How is the session data structured and managed?
4. What permissions are required and how are they handled?
5. How are the different transcription models (Vosk/Whisper) implemented?

## Current Task Focus
- Analyzing and documenting the project structure
- Identifying the key components and their relationships
- Understanding the data flow between components
- Documenting the technical requirements and constraints

## Recent Insights
- Application uses Provider for state management
- Two main screens: HomeScreen and SettingsScreen
- Two key providers: SessionProvider and LocalTranscriptionProvider
- Local transcription is handled through vosk_flutter and whisper_flutter_new packages
- Material 3 design system is used for the UI 