#import "EchosSpeakerEmbedder.h"

#include "sherpa-onnx/c-api/c-api.h"

static const unsigned long long kWavHeaderSize = 44;
static const int32_t kSampleRate = 16000;
// ponytail: fixed thread count; tune from an on-device benchmark if speaker
// identification is too slow.
static const int32_t kNumThreads = 2;

@implementation EchosSpeakerEmbedder {
  const SherpaOnnxSpeakerEmbeddingExtractor *_extractor;
}

- (nullable instancetype)initWithModel:(NSString *)modelPath {
  if ((self = [super init])) {
    SherpaOnnxSpeakerEmbeddingExtractorConfig config;
    memset(&config, 0, sizeof(config));
    config.model = modelPath.fileSystemRepresentation;
    config.num_threads = kNumThreads;
    config.provider = "cpu";
    _extractor = SherpaOnnxCreateSpeakerEmbeddingExtractor(&config);
    if (!_extractor) return nil;
  }
  return self;
}

- (void)dealloc {
  if (_extractor) SherpaOnnxDestroySpeakerEmbeddingExtractor(_extractor);
}

- (nullable NSArray<NSArray<NSNumber *> *> *)embedWavFile:(NSString *)path
                                                  ranges:(NSArray<NSNumber *> *)ranges
                                                   error:(NSError **)error {
  NSFileHandle *handle = [NSFileHandle fileHandleForReadingAtPath:path];
  if (!handle) {
    if (error) {
      *error = [NSError errorWithDomain:@"EchosDiarization"
                                   code:1
                               userInfo:@{NSLocalizedDescriptionKey : @"Cannot open audio file"}];
    }
    return nil;
  }

  int32_t dim = SherpaOnnxSpeakerEmbeddingExtractorDim(_extractor);
  NSMutableArray<NSArray<NSNumber *> *> *embeddings =
      [NSMutableArray arrayWithCapacity:ranges.count / 2];

  for (NSUInteger r = 0; r + 1 < ranges.count; r += 2) {
    @autoreleasepool {
      long long start = ranges[r].longLongValue;
      long long end = ranges[r + 1].longLongValue;
      NSData *pcm = nil;
      if (start >= 0 && end > start &&
          [handle seekToOffset:kWavHeaderSize + (unsigned long long)start * 2 error:error]) {
        pcm = [handle readDataUpToLength:(NSUInteger)(end - start) * 2 error:error];
      }
      NSUInteger count = pcm.length / 2;
      NSMutableArray<NSNumber *> *embedding = [NSMutableArray array];
      if (count > 0) {
        float *samples = malloc(count * sizeof(float));
        const int16_t *raw = pcm.bytes;
        for (NSUInteger i = 0; i < count; i++) samples[i] = (float)raw[i] / 32768.0f;

        const SherpaOnnxOnlineStream *stream =
            SherpaOnnxSpeakerEmbeddingExtractorCreateStream(_extractor);
        SherpaOnnxOnlineStreamAcceptWaveform(stream, kSampleRate, samples, (int32_t)count);
        SherpaOnnxOnlineStreamInputFinished(stream);
        free(samples);
        if (SherpaOnnxSpeakerEmbeddingExtractorIsReady(_extractor, stream)) {
          const float *vector =
              SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding(_extractor, stream);
          if (vector) {
            for (int32_t d = 0; d < dim; d++) [embedding addObject:@(vector[d])];
            SherpaOnnxSpeakerEmbeddingExtractorDestroyEmbedding(vector);
          }
        }
        SherpaOnnxDestroyOnlineStream(stream);
      }
      [embeddings addObject:embedding];
    }
  }
  [handle closeAndReturnError:nil];
  return embeddings;
}

@end
