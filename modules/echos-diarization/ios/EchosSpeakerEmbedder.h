#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Speaker embeddings from the sherpa-onnx C API, which
/// react-native-sherpa-onnx links but does not expose.
@interface EchosSpeakerEmbedder : NSObject

- (nullable instancetype)initWithModel:(NSString *)modelPath;

/// One embedding per `[start, end)` sample pair in `ranges`, read from a
/// 16 kHz mono 16-bit WAV. A range too short for the model yields `@[]`.
- (nullable NSArray<NSArray<NSNumber *> *> *)embedWavFile:(NSString *)path
                                                  ranges:(NSArray<NSNumber *> *)ranges
                                                   error:(NSError **)error;

@end

NS_ASSUME_NONNULL_END
