declare module '*.svg' {
  import { FC } from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: FC<SvgProps>;
  export default content;
}

declare module '*.bin' {
  const content: ArrayBuffer;
  export default content;
}

declare module 'whisper.rn' {
  export interface TranscribeOptions {
    language?: string;
    translate?: boolean;
    maxThreads?: number;
    nProcessors?: number;
    maxContext?: number;
    maxLen?: number;
    tokenTimestamps?: boolean;
    tdrzEnable?: boolean;
    wordThold?: number;
    offset?: number;
    duration?: number;
    temperature?: number;
    temperatureInc?: number;
    beamSize?: number;
    bestOf?: number;
    prompt?: string;
  }

  export interface TranscribeResult {
    result: string;
    segments: { text: string; t0: number; t1: number }[];
    isAborted: boolean;
  }

  export interface TranscribeFileOptions extends TranscribeOptions {
    onProgress?: (progress: number) => void;
    onNewSegments?: (result: TranscribeNewSegmentsResult) => void;
  }

  export interface TranscribeNewSegmentsResult {
    nNew: number;
    totalNNew: number;
    result: string;
    segments: TranscribeResult['segments'];
  }

  export interface VadOptions {
    threshold?: number;
    minSpeechDurationMs?: number;
    minSilenceDurationMs?: number;
    maxSpeechDurationS?: number;
    speechPadMs?: number;
    samplesOverlap?: number;
  }

  export interface VadSegment {
    t0: number;
    t1: number;
  }

  export interface ContextOptions {
    filePath: string | number;
    coreMLModelAsset?: { filename: string; assets: string[] | number[] };
    isBundleAsset?: boolean;
    useCoreMLIos?: boolean;
    useGpu?: boolean;
    useFlashAttn?: boolean;
  }

  export interface VadContextOptions {
    filePath: string | number;
    isBundleAsset?: boolean;
    useGpu?: boolean;
    nThreads?: number;
  }

  export class WhisperContext {
    ptr: number;
    id: number;
    gpu: boolean;
    reasonNoGPU: string;
    transcribe(
      filePathOrBase64: string | number,
      options?: TranscribeFileOptions
    ): { stop: () => Promise<void>; promise: Promise<TranscribeResult> };
    transcribeData(
      data: string | ArrayBuffer,
      options?: TranscribeFileOptions
    ): { stop: () => Promise<void>; promise: Promise<TranscribeResult> };
    bench(maxThreads: number): Promise<{
      config: string;
      nThreads: number;
      encodeMs: number;
      decodeMs: number;
      batchMs: number;
      promptMs: number;
    }>;
    release(): Promise<void>;
  }

  export class WhisperVadContext {
    id: number;
    gpu: boolean;
    reasonNoGPU: string;
    detectSpeech(
      filePathOrBase64: string | number,
      options?: VadOptions
    ): Promise<VadSegment[]>;
    detectSpeechData(
      audioData: string | ArrayBuffer,
      options?: VadOptions
    ): Promise<VadSegment[]>;
    release(): Promise<void>;
  }

  export function initWhisper(options: ContextOptions): Promise<WhisperContext>;
  export function initWhisperVad(
    options: VadContextOptions
  ): Promise<WhisperVadContext>;
  export function releaseAllWhisper(): Promise<void>;
  export function releaseAllWhisperVad(): Promise<void>;
  export function toggleNativeLog(enabled: boolean): Promise<void>;
  export function addNativeLogListener(
    listener: (level: string, text: string) => void
  ): { remove: () => void };

  export const libVersion: string;
  export const isUseCoreML: boolean;
  export const isCoreMLAllowFallback: boolean;
}

declare module 'whisper.rn/src/realtime-transcription' {
  import type {
    TranscribeOptions,
    TranscribeResult,
    VadOptions,
    WhisperContext,
    WhisperVadContext,
  } from 'whisper.rn';

  export interface AudioStreamData {
    data: Uint8Array;
    sampleRate: number;
    channels: number;
    timestamp: number;
  }

  export interface AudioStreamConfig {
    sampleRate?: number;
    channels?: number;
    bitsPerSample?: number;
    bufferSize?: number;
    audioSource?: number;
  }

  export interface AudioStreamInterface {
    initialize(config: AudioStreamConfig): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    isRecording(): boolean;
    onData(callback: (data: AudioStreamData) => void): void;
    onError(callback: (error: string) => void): void;
    onStatusChange(callback: (isRecording: boolean) => void): void;
    release(): Promise<void>;
  }

  export interface RealtimeVadEvent {
    type: 'speech_start' | 'speech_end' | 'speech_continue' | 'silence';
    timestamp: number;
    lastSpeechDetectedTime: number;
    confidence: number;
    duration: number;
    sliceIndex: number;
    currentThreshold?: number;
    environmentNoise?: number;
    analysis?: {
      averageAmplitude: number;
      peakAmplitude: number;
      spectralCentroid?: number;
      zeroCrossingRate?: number;
    };
  }

  export interface RealtimeTranscribeEvent {
    type: 'start' | 'transcribe' | 'end' | 'error';
    sliceIndex: number;
    data?: TranscribeResult;
    isCapturing: boolean;
    processTime: number;
    recordingTime: number;
    memoryUsage?: {
      slicesInMemory: number;
      totalSamples: number;
      estimatedMB: number;
    };
    vadEvent?: RealtimeVadEvent;
  }

  export interface RealtimeStatsEvent {
    timestamp: number;
    type: 'slice_processed' | 'vad_change' | 'memory_change' | 'status_change';
    data: {
      isActive: boolean;
      isTranscribing: boolean;
      vadEnabled: boolean;
      audioStats: unknown;
      vadStats: unknown;
      sliceStats: unknown;
    };
  }

  export interface RealtimeOptions {
    audioSliceSec?: number;
    audioMinSec?: number;
    maxSlicesInMemory?: number;
    vadOptions?: VadOptions;
    vadPreset?:
      | 'default'
      | 'sensitive'
      | 'very-sensitive'
      | 'conservative'
      | 'very-conservative'
      | 'continuous'
      | 'meeting'
      | 'noisy';
    autoSliceOnSpeechEnd?: boolean;
    autoSliceThreshold?: number;
    vadThrottleMs?: number;
    vadSkipRatio?: number;
    transcribeOptions?: TranscribeOptions;
    initialPrompt?: string;
    promptPreviousSlices?: boolean;
    audioOutputPath?: string;
    audioStreamConfig?: AudioStreamConfig;
    logger?: (message: string) => void;
  }

  export interface RealtimeTranscriberCallbacks {
    onBeginTranscribe?: (sliceInfo: {
      audioData: Uint8Array;
      sliceIndex: number;
      duration: number;
      vadEvent?: RealtimeVadEvent;
    }) => Promise<boolean>;
    onTranscribe?: (event: RealtimeTranscribeEvent) => void;
    onBeginVad?: (sliceInfo: {
      audioData: Uint8Array;
      sliceIndex: number;
      duration: number;
    }) => Promise<boolean>;
    onVad?: (event: RealtimeVadEvent) => void;
    onError?: (error: string) => void;
    onStatusChange?: (isActive: boolean) => void;
    onStatsUpdate?: (event: RealtimeStatsEvent) => void;
  }

  export interface AudioSlice {
    index: number;
    data: Uint8Array;
    sampleCount: number;
    startTime: number;
    endTime: number;
    isProcessed: boolean;
    isReleased: boolean;
  }

  export type AudioSliceNoData = Omit<AudioSlice, 'data'>;

  export interface MemoryUsage {
    slicesInMemory: number;
    totalSamples: number;
    estimatedMB: number;
  }

  export interface WavFileWriterFs {
    writeFile(
      filepath: string,
      contents: string,
      encoding?: string
    ): Promise<void>;
    appendFile(
      filepath: string,
      contents: string,
      encoding?: string
    ): Promise<void>;
    unlink(filepath: string): Promise<void>;
    exists(filepath: string): Promise<boolean>;
  }

  type WhisperContextLike = {
    transcribeData(
      data: ArrayBuffer,
      options: TranscribeOptions
    ): { stop: () => Promise<void>; promise: Promise<TranscribeResult> };
  };

  type WhisperVadContextLike = {
    detectSpeechData(
      data: ArrayBuffer,
      options: VadOptions
    ): Promise<{ t0: number; t1: number }[]>;
  };

  export interface RealtimeTranscriberDependencies {
    whisperContext: WhisperContext | WhisperContextLike;
    vadContext?: WhisperVadContext | WhisperVadContextLike;
    audioStream: AudioStreamInterface;
    fs?: WavFileWriterFs;
  }

  export class RealtimeTranscriber {
    constructor(
      dependencies: RealtimeTranscriberDependencies,
      options?: RealtimeOptions,
      callbacks?: RealtimeTranscriberCallbacks
    );
    start(): Promise<void>;
    stop(): Promise<void>;
    nextSlice(): Promise<void>;
    reset(): void;
    release(): Promise<void>;
    updateCallbacks(callbacks: Partial<RealtimeTranscriberCallbacks>): void;
    updateVadOptions(options: Partial<VadOptions>): void;
    updateAutoSliceOptions(options: {
      autoSliceOnSpeechEnd?: boolean;
      autoSliceThreshold?: number;
    }): void;
    updateVadThrottleOptions(options: {
      vadThrottleMs?: number;
      vadSkipRatio?: number;
    }): void;
    getStatistics(): {
      isActive: boolean;
      isTranscribing: boolean;
      vadEnabled: boolean;
      audioStats: unknown;
      vadStats: unknown;
      sliceStats: unknown;
      autoSliceConfig: unknown;
    };
    getTranscriptionResults(): {
      slice: AudioSliceNoData;
      transcribeEvent: RealtimeTranscribeEvent;
    }[];
  }

  export class SliceManager {
    constructor(audioSliceSec: number, maxSlicesInMemory: number);
    addAudioData(data: Uint8Array): { slice: AudioSlice | null };
    forceNextSlice(): { slice: AudioSlice | null };
    getSliceByIndex(index: number): AudioSlice | undefined;
    getAudioDataForTranscription(sliceIndex: number): Uint8Array | null;
    getCurrentSliceInfo(): {
      currentSliceIndex: number;
      memoryUsage: MemoryUsage;
    };
    getMemoryUsage(): MemoryUsage;
    reset(): void;
  }

  export const VAD_PRESETS: {
    default: VadOptions;
    sensitive: VadOptions;
    'very-sensitive': VadOptions;
    conservative: VadOptions;
    'very-conservative': VadOptions;
    continuous: VadOptions;
    meeting: VadOptions;
    noisy: VadOptions;
  };
}

declare module 'whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter' {
  import type {
    AudioStreamConfig,
    AudioStreamData,
    AudioStreamInterface,
  } from 'whisper.rn/src/realtime-transcription';

  export class AudioPcmStreamAdapter implements AudioStreamInterface {
    initialize(config: AudioStreamConfig): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    isRecording(): boolean;
    onData(callback: (data: AudioStreamData) => void): void;
    onError(callback: (error: string) => void): void;
    onStatusChange(callback: (isRecording: boolean) => void): void;
    release(): Promise<void>;
  }
}

declare module '@fugood/react-native-audio-pcm-stream' {
  export interface IAudioRecord {
    init: (options: Options) => void;
    start: () => void;
    stop: () => Promise<string>;
    on: (event: 'data', callback: (data: string) => void) => void;
  }

  export interface Options {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    audioSource?: number;
    wavFile?: string;
    bufferSize?: number;
  }

  const AudioRecord: IAudioRecord;
  export default AudioRecord;
}

declare module '@supersami/rn-foreground-service' {
  interface RegisterConfig {
    config: {
      alert: boolean;
      onServiceErrorCallBack?: () => void;
    };
  }

  type ForegroundServiceType =
    | 'camera'
    | 'connectedDevice'
    | 'dataSync'
    | 'health'
    | 'location'
    | 'mediaPlayback'
    | 'mediaProjection'
    | 'microphone'
    | 'phoneCall'
    | 'remoteMessaging'
    | 'shortService'
    | 'specialUse'
    | 'systemExempted';

  interface StartConfig {
    id: number;
    title: string;
    message: string;
    ServiceType: ForegroundServiceType;
    icon?: string;
    largeIcon?: string;
    visibility?: string;
    ongoing?: boolean;
    importance?: string;
    number?: string;
    button?: boolean;
    buttonText?: string;
    buttonOnPress?: string;
    button2?: boolean;
    button2Text?: string;
    button2OnPress?: string;
    mainOnPress?: string;
    setOnlyAlertOnce?: boolean;
    color?: string;
    progress?: {
      max: number;
      curr: number;
    };
  }

  interface TaskOptions {
    delay?: number;
    onLoop?: boolean;
    taskId: string;
    onSuccess?: () => void;
    onError?: (e: Error) => void;
  }

  interface ReactNativeForegroundService {
    register(config: RegisterConfig): void;
    start(config: StartConfig): Promise<void>;
    update(config: StartConfig): Promise<void>;
    stop(): Promise<void>;
    stopAll(): Promise<void>;
    eventListener(callback: () => void): () => void;
    add_task(task: () => void | Promise<void>, options: TaskOptions): string;
    update_task(task: () => void | Promise<void>, options: TaskOptions): string;
    remove_task(taskId: string): void;
    is_task_running(taskId: string): boolean;
    remove_all_tasks(): void;
    get_task(taskId: string): object | null;
    get_all_tasks(): object;
  }

  const ReactNativeForegroundService: ReactNativeForegroundService;
  export default ReactNativeForegroundService;
}
