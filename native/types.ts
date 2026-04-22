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

// --- Aggregate ---

export interface NativeModules {
  audioPcmStream: IAudioPcmStream;
  aesGcmCrypto: IAesGcmCrypto;
  fileSystem: IFileSystem;
}
