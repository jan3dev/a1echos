#import "SherpaBridge.h"

#include <sherpa-onnx/c-api/cxx-api.h>

#include <memory>
#include <string>

// Public sherpa-onnx C++ API lives in `sherpa_onnx::cxx`. The RN module's
// own internal wrapper used `sherpaonnx::` — easy to confuse.
using sherpa_onnx::cxx::OfflineRecognizer;
using sherpa_onnx::cxx::OfflineRecognizerConfig;
using sherpa_onnx::cxx::OfflineRecognizerResult;
using sherpa_onnx::cxx::OfflineStream;
using sherpa_onnx::cxx::ReadWave;
using sherpa_onnx::cxx::Wave;

@implementation SherpaModelFiles
@end

namespace {

// Number of inference threads. The main app uses 2 on iOS (see
// SherpaTranscriptionService.IOS_NUM_THREADS); mirror that so the listener
// doesn't trip the device's energy budget while recording in the extension.
constexpr int32_t kNumThreads = 2;

std::string JoinPath(NSString *dir, NSString *name) {
    NSString *joined = [dir stringByAppendingPathComponent:name];
    return std::string(joined.UTF8String ?: "");
}

} // namespace

@implementation SherpaBridge {
    std::unique_ptr<OfflineRecognizer> _recognizer;
    NSLock *_lock;
    NSString *_loadedSignature;
}

+ (instancetype)shared {
    static SherpaBridge *instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[SherpaBridge alloc] init];
    });
    return instance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _lock = [[NSLock alloc] init];
    }
    return self;
}

- (void)dealloc {
    [self unloadModel];
}

// Signature used to decide whether to reuse an already-loaded recognizer when
// the caller requests initialization with the same config.
- (NSString *)signatureFor:(SherpaModelFiles *)files {
    return [NSString stringWithFormat:@"%ld|%@|%@|%@|%@|%@|%@",
            (long)files.modelType,
            files.modelDir ?: @"",
            files.encoder ?: @"",
            files.decoder ?: @"",
            files.tokens ?: @"",
            files.joiner ?: @"",
            files.language ?: @""];
}

- (BOOL)loadModel:(SherpaModelFiles *)files {
    if (!files.modelDir.length || !files.encoder.length ||
        !files.decoder.length || !files.tokens.length) {
        NSLog(@"[SherpaBridge] Invalid model file set");
        return NO;
    }

    NSString *signature = [self signatureFor:files];

    [_lock lock];
    if (_recognizer != nullptr && [signature isEqualToString:_loadedSignature]) {
        [_lock unlock];
        return YES;
    }
    // Reload with the new configuration — drop the old recognizer first.
    _recognizer.reset();
    _loadedSignature = nil;

    NSLog(@"[SherpaBridge] Loading model from %@ (type=%ld)",
          files.modelDir, (long)files.modelType);

    OfflineRecognizerConfig config;
    config.model_config.tokens = JoinPath(files.modelDir, files.tokens);
    config.model_config.num_threads = kNumThreads;
    config.model_config.provider = "cpu";

    switch (files.modelType) {
        case SherpaModelTypeWhisper: {
            config.model_config.whisper.encoder =
                JoinPath(files.modelDir, files.encoder);
            config.model_config.whisper.decoder =
                JoinPath(files.modelDir, files.decoder);
            config.model_config.whisper.language =
                std::string(files.language.UTF8String ?: "en");
            config.model_config.whisper.task = "transcribe";
            config.model_config.model_type = "whisper";
            break;
        }
        case SherpaModelTypeNemoTransducer: {
            if (!files.joiner.length) {
                [_lock unlock];
                NSLog(@"[SherpaBridge] Transducer model requires a joiner file");
                return NO;
            }
            config.model_config.transducer.encoder =
                JoinPath(files.modelDir, files.encoder);
            config.model_config.transducer.decoder =
                JoinPath(files.modelDir, files.decoder);
            config.model_config.transducer.joiner =
                JoinPath(files.modelDir, files.joiner);
            config.model_config.model_type = "nemo_transducer";
            break;
        }
    }

    try {
        _recognizer = std::make_unique<OfflineRecognizer>(
            OfflineRecognizer::Create(config));
    } catch (const std::exception &e) {
        _recognizer.reset();
        [_lock unlock];
        NSLog(@"[SherpaBridge] Failed to create recognizer: %s", e.what());
        return NO;
    }

    if (_recognizer == nullptr || _recognizer->Get() == nullptr) {
        _recognizer.reset();
        [_lock unlock];
        NSLog(@"[SherpaBridge] Recognizer creation returned null handle");
        return NO;
    }

    _loadedSignature = signature;
    [_lock unlock];

    NSLog(@"[SherpaBridge] Model loaded successfully");
    return YES;
}

- (BOOL)isModelLoaded {
    [_lock lock];
    BOOL loaded = (_recognizer != nullptr);
    [_lock unlock];
    return loaded;
}

- (NSString *)transcribeFile:(NSString *)audioPath {
    [_lock lock];
    if (_recognizer == nullptr) {
        [_lock unlock];
        NSLog(@"[SherpaBridge] Recognizer not loaded");
        return nil;
    }

    const std::string path = std::string(audioPath.UTF8String ?: "");
    Wave wave = ReadWave(path);
    if (wave.samples.empty()) {
        [_lock unlock];
        NSLog(@"[SherpaBridge] Failed to read wave file: %@", audioPath);
        return nil;
    }

    OfflineStream stream = _recognizer->CreateStream();
    stream.AcceptWaveform(wave.sample_rate, wave.samples.data(),
                          static_cast<int32_t>(wave.samples.size()));
    _recognizer->Decode(&stream);

    OfflineRecognizerResult result = _recognizer->GetResult(&stream);
    [_lock unlock];

    NSString *text = [NSString stringWithUTF8String:result.text.c_str()];
    NSString *trimmed = [text stringByTrimmingCharactersInSet:
                         [NSCharacterSet whitespaceAndNewlineCharacterSet]];
    NSLog(@"[SherpaBridge] Transcription result: %@", trimmed);
    return trimmed.length > 0 ? trimmed : nil;
}

- (void)unloadModel {
    [_lock lock];
    if (_recognizer != nullptr) {
        _recognizer.reset();
        _loadedSignature = nil;
        NSLog(@"[SherpaBridge] Model unloaded");
    }
    [_lock unlock];
}

@end
