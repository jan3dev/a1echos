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

declare module '@supersami/rn-foreground-service' {
  interface RegisterConfig {
    config: {
      alert: boolean;
      onServiceErrorCallBack?: () => void;
    };
  }

  interface StartConfig {
    id: number;
    title: string;
    message: string;
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
    serviceType?:
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
