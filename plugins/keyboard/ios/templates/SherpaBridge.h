#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Supported sherpa-onnx acoustic model families.
typedef NS_ENUM(NSInteger, SherpaModelType) {
    SherpaModelTypeWhisper = 0,
    SherpaModelTypeNemoTransducer = 1,
};

/// File set describing a sherpa-onnx offline ASR model on disk. Populated by
/// the caller and validated in `[SherpaBridge loadModel:]`.
@interface SherpaModelFiles : NSObject
/// Directory that contains the model files.
@property (nonatomic, copy, nullable) NSString *modelDir;
/// Acoustic model family.
@property (nonatomic, assign) SherpaModelType modelType;
/// Encoder ONNX file name (relative to `modelDir`).
@property (nonatomic, copy, nullable) NSString *encoder;
/// Decoder ONNX file name (relative to `modelDir`).
@property (nonatomic, copy, nullable) NSString *decoder;
/// Tokens file name (relative to `modelDir`).
@property (nonatomic, copy, nullable) NSString *tokens;
/// Joiner ONNX file name for transducer models (relative to `modelDir`).
/// Required for `SherpaModelTypeNemoTransducer`; ignored otherwise.
@property (nonatomic, copy, nullable) NSString *joiner;
/// Whisper language (e.g. `"en"`, `"zh"`). Required for Whisper; ignored for
/// transducer models that detect language automatically.
@property (nonatomic, copy, nullable) NSString *language;
@end

/// ObjC++ bridge to the sherpa-onnx offline recognizer for use from Swift.
///
/// The keyboard extension runs in its own sandboxed process that we keep thin
/// — it records audio and hands it off via App Group IPC. Transcription runs
/// in the main app process where the sherpa-onnx framework is linked.
@interface SherpaBridge : NSObject

/// Shared singleton instance.
+ (instancetype)shared;

/// Initializes the offline recognizer from the given model files.
/// Returns `YES` on success. If a model is already loaded with a different
/// configuration, it is released first.
- (BOOL)loadModel:(SherpaModelFiles *)files;

/// Returns `YES` when a recognizer is loaded and ready for transcription.
- (BOOL)isModelLoaded;

/// Transcribes a 16 kHz mono PCM WAV file and returns the decoded text.
/// Returns `nil` on failure (file unreadable, decode error, empty result).
- (nullable NSString *)transcribeFile:(NSString *)audioPath;

/// Releases the recognizer and frees memory.
- (void)unloadModel;

@end

NS_ASSUME_NONNULL_END
