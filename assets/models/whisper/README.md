# Whisper Model Files

This directory contains the local Whisper model files for both Android and iOS platforms.

## Required Model Files

### Android Platform
**Location:** `android/ggml-tiny.bin`
**Source:** https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin
**Format:** GGML binary format

### iOS Platform  
**Location:** `ios/openai_whisper-tiny/`
**Source:** https://huggingface.co/argmaxinc/whisperkit-coreml/tree/main/openai_whisper-tiny
**Format:** CoreML model directory structure

The iOS model should contain the following files:
```
ios/openai_whisper-tiny/
├── AudioEncoder.mlmodelc/
├── TextDecoder.mlmodelc/
├── MelSpectrogram.mlmodelc/
└── [additional CoreML files and metadata]
```

## Download Instructions

### Android Model
```bash
cd assets/models/whisper/android/
curl -L -o ggml-tiny.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin
```

### iOS Model
```bash
cd assets/models/whisper/ios/
git clone https://huggingface.co/argmaxinc/whisperkit-coreml temp_repo
mv temp_repo/openai_whisper-tiny ./
rm -rf temp_repo
```

## Verification

After downloading, verify the structure:
```
assets/models/whisper/
├── android/
│   └── ggml-tiny.bin (~39MB)
└── ios/
    └── openai_whisper-tiny/
        ├── AudioEncoder.mlmodelc/
        ├── TextDecoder.mlmodelc/
        ├── MelSpectrogram.mlmodelc/
        └── [other files]
```

## Usage

Once the model files are in place, the WhisperService will automatically:
1. Copy models from assets to local app storage on first run
2. Use local models for all transcription operations
3. Eliminate the need for runtime model downloads

## Notes

- Models are copied to app documents directory on first initialization
- Subsequent app launches will use the cached local models
- No internet connection required after initial setup
- Models are platform-specific and cannot be shared between Android/iOS 