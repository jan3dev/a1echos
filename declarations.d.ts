declare module "*.svg" {
  import { FC } from "react";
  import { SvgProps } from "react-native-svg";
  const content: FC<SvgProps>;
  export default content;
}

declare module "*.onnx" {
  const content: number;
  export default content;
}

declare module "@fugood/react-native-audio-pcm-stream" {
  export interface IAudioRecord {
    init: (options: Options) => void;
    start: () => void;
    stop: () => Promise<string>;
    on: (event: "data", callback: (data: string) => void) => void;
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

declare module "@supersami/rn-foreground-service" {
  interface RegisterConfig {
    config: {
      alert: boolean;
      onServiceErrorCallBack?: () => void;
    };
  }

  type ForegroundServiceType =
    | "camera"
    | "connectedDevice"
    | "dataSync"
    | "health"
    | "location"
    | "mediaPlayback"
    | "mediaProjection"
    | "microphone"
    | "phoneCall"
    | "remoteMessaging"
    | "shortService"
    | "specialUse"
    | "systemExempted";

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
