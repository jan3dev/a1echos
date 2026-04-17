#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// ObjC bridge to the whisper.rn C API for use from Swift.
@interface WhisperBridge : NSObject

/// Shared singleton instance.
+ (instancetype)shared;

/// Initializes the Whisper context with the given model file path.
- (BOOL)loadModel:(NSString *)modelPath;

/// Returns YES if the model is loaded and ready for transcription.
- (BOOL)isModelLoaded;

/// Transcribes a WAV audio file and returns the recognized text.
- (nullable NSString *)transcribeFile:(NSString *)audioPath
                             language:(nullable NSString *)language;

/// Releases the Whisper context and frees memory.
- (void)unloadModel;

@end

NS_ASSUME_NONNULL_END
