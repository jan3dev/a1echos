#import "WhisperBridge.h"
#import <rnwhisper/whisper.h>
#import <whisper-rn/RNWhisperAudioUtils.h>

@implementation WhisperBridge {
    struct whisper_context *_ctx;
    NSLock *_lock;
}

+ (instancetype)shared {
    static WhisperBridge *instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[WhisperBridge alloc] init];
    });
    return instance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _ctx = NULL;
        _lock = [[NSLock alloc] init];
    }
    return self;
}

- (BOOL)loadModel:(NSString *)modelPath {
    [_lock lock];
    if (_ctx != NULL) {
        [_lock unlock];
        return YES; // Already loaded
    }

    NSLog(@"[WhisperBridge] Loading model from: %@", modelPath);

    struct whisper_context_params cparams = whisper_context_default_params();
    cparams.use_gpu = false;     // Disable GPU for stability in background
    cparams.flash_attn = false;

    _ctx = whisper_init_from_file_with_params([modelPath UTF8String], cparams);
    [_lock unlock];

    if (_ctx == NULL) {
        NSLog(@"[WhisperBridge] Failed to load model");
        return NO;
    }

    NSLog(@"[WhisperBridge] Model loaded successfully");
    return YES;
}

- (BOOL)isModelLoaded {
    return _ctx != NULL;
}

- (NSString *)transcribeFile:(NSString *)audioPath language:(NSString *)language {
    [_lock lock];
    if (_ctx == NULL) {
        [_lock unlock];
        NSLog(@"[WhisperBridge] Model not loaded");
        return nil;
    }

    NSLog(@"[WhisperBridge] Transcribing file: %@", audioPath);

    // Decode WAV file to float samples using whisper.rn's audio utility
    int sampleCount = 0;
    float *samples = [RNWhisperAudioUtils decodeWaveFile:audioPath count:&sampleCount];

    if (samples == NULL || sampleCount == 0) {
        [_lock unlock];
        NSLog(@"[WhisperBridge] Failed to decode audio file");
        return nil;
    }

    NSLog(@"[WhisperBridge] Decoded %d samples", sampleCount);

    // Configure transcription parameters
    struct whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    params.print_realtime = false;
    params.print_progress = false;
    params.print_timestamps = false;
    params.print_special = false;
    params.n_threads = 2;
    params.no_timestamps = true;
    params.single_segment = false;

    if (language != nil && language.length > 0) {
        params.language = [language UTF8String];
    } else {
        params.language = "en";
    }

    // Run transcription
    int result = whisper_full(_ctx, params, samples, sampleCount);
    free(samples);

    if (result != 0) {
        [_lock unlock];
        NSLog(@"[WhisperBridge] Transcription failed with code: %d", result);
        return nil;
    }

    // Extract text from segments
    int nSegments = whisper_full_n_segments(_ctx);
    NSMutableString *text = [NSMutableString string];

    for (int i = 0; i < nSegments; i++) {
        const char *segmentText = whisper_full_get_segment_text(_ctx, i);
        if (segmentText != NULL) {
            [text appendString:[NSString stringWithUTF8String:segmentText]];
        }
    }

    [_lock unlock];

    NSString *trimmed = [text stringByTrimmingCharactersInSet:
                         [NSCharacterSet whitespaceAndNewlineCharacterSet]];
    NSLog(@"[WhisperBridge] Transcription result: %@", trimmed);
    return trimmed;
}

- (void)unloadModel {
    [_lock lock];
    if (_ctx != NULL) {
        whisper_free(_ctx);
        _ctx = NULL;
        NSLog(@"[WhisperBridge] Model unloaded");
    }
    [_lock unlock];
}

- (void)dealloc {
    [self unloadModel];
}

@end
