import type { WhisperContext, WhisperVadContext } from "whisper.rn";
import type { RealtimeTranscriber as RealtimeTranscriberInstance } from "whisper.rn/src/realtime-transcription";
import type { AudioPcmStreamAdapter as AudioPcmStreamAdapterInstance } from "whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter";

// --- Audio PCM Stream (@fugood/react-native-audio-pcm-stream) ---

export interface AudioPcmStreamConfig {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  audioSource: number;
  bufferSize: number;
}

export interface IAudioPcmStream {
  init(config: AudioPcmStreamConfig): void;
  on(event: "data", callback: (data: string) => void): void;
  start(): void;
  stop(): Promise<void>;
}

// --- AES-GCM Crypto (react-native-aes-gcm-crypto) ---

export interface EncryptResult {
  iv: string;
  content: string;
  tag: string;
}

export interface IAesGcmCrypto {
  encrypt(plainText: string, aad: boolean, key: string): Promise<EncryptResult>;
  decrypt(
    content: string,
    key: string,
    iv: string,
    tag: string,
    aad: boolean,
  ): Promise<string>;
}

// --- File System (react-native-fs) ---

export interface IFileSystem {
  writeFile(path: string, content: string, encoding: string): Promise<void>;
  appendFile(path: string, content: string, encoding: string): Promise<void>;
  readFile(path: string, encoding: string): Promise<string>;
  unlink(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

// --- Whisper (whisper.rn) ---

export interface WhisperInitOptions {
  filePath: string;
  useGpu?: boolean;
  useCoreMLIos?: boolean;
  useFlashAttn?: boolean;
  nThreads?: number;
}

export interface WhisperVadInitOptions {
  filePath: string;
  useGpu?: boolean;
  nThreads?: number;
}

export interface RealtimeTranscribeEvent {
  type: "error" | "start" | "transcribe" | "end";
  sliceIndex: number;
  data?: { result: string };
  isCapturing: boolean;
  processTime: number;
  recordingTime: number;
}

export interface IWhisperModule {
  initWhisper(options: WhisperInitOptions): Promise<WhisperContext>;
  initWhisperVad(options: WhisperVadInitOptions): Promise<WhisperVadContext>;
  createRealtimeTranscriber(
    config: {
      whisperContext: WhisperContext;
      vadContext: WhisperVadContext;
      audioStream: AudioPcmStreamAdapterInstance;
      fs: IFileSystem;
    },
    options: Record<string, unknown>,
    callbacks: {
      onTranscribe: (event: RealtimeTranscribeEvent) => void;
      onError: (error: string) => void;
      onStatusChange: (isActive: boolean) => void;
    },
  ): RealtimeTranscriberInstance;
  createAudioPcmStreamAdapter(): AudioPcmStreamAdapterInstance;
}

// --- Aggregate ---

export interface NativeModules {
  audioPcmStream: IAudioPcmStream;
  aesGcmCrypto: IAesGcmCrypto;
  fileSystem: IFileSystem;
  whisperModule: IWhisperModule;
}
