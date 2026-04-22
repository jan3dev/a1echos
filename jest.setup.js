/* eslint-disable no-undef */
/**
 * jest.setup.js — Global mocks for all native modules used by Echos.
 *
 * Provides in-memory implementations of AsyncStorage and SecureStore
 * that reset between tests via beforeEach.
 */

// ---------------------------------------------------------------------------
// In-memory stores — prefixed with "mock" so jest.mock() hoisting allows access
// ---------------------------------------------------------------------------
let mockAsyncStorageStore = {};
let mockSecureStoreStore = {};

const { useThemeStore } = require("./theme");

// ---------------------------------------------------------------------------
// Expo modules
// ---------------------------------------------------------------------------
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid"),
  getRandomBytesAsync: jest.fn(async (size) => new Uint8Array(size)),
  digestStringAsync: jest.fn(async () => "mock-digest"),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));

jest.mock("expo-audio", () => ({
  AudioRecorder: jest.fn().mockImplementation(() => ({
    prepareToRecordAsync: jest.fn(),
    record: jest.fn(),
    stop: jest.fn(),
    getAvailableInputs: jest.fn().mockResolvedValue([]),
    currentTime: 0,
  })),
  AudioModule: {
    setAudioModeAsync: jest.fn(),
  },
  setAudioModeAsync: jest.fn(),
  getRecordingPermissionsAsync: jest.fn(async () => ({
    granted: true,
    status: "granted",
    canAskAgain: true,
  })),
  requestRecordingPermissionsAsync: jest.fn(async () => ({
    granted: true,
    status: "granted",
    canAskAgain: true,
  })),
  PermissionStatus: {
    GRANTED: "granted",
    DENIED: "denied",
    UNDETERMINED: "undetermined",
  },
}));

jest.mock("expo-file-system", () => {
  const mockFile = jest.fn().mockImplementation((...args) => ({
    uri: args.join("/"),
    exists: true,
    text: jest.fn().mockResolvedValue(""),
    textSync: jest.fn(() => ""),
    write: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue(undefined),
    copy: jest.fn().mockResolvedValue(undefined),
    move: jest.fn().mockResolvedValue(undefined),
    downloadAsync: jest.fn().mockResolvedValue(undefined),
    size: 0,
    md5: "mock-md5",
    base64: jest.fn().mockResolvedValue(""),
    base64Sync: jest.fn(() => ""),
  }));
  const mockDirectory = jest.fn().mockImplementation((...args) => ({
    uri: args.join("/"),
    exists: true,
    create: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
  }));
  return {
    File: mockFile,
    Directory: mockDirectory,
    Paths: {
      document: "/mock/document",
      cache: "/mock/cache",
      appleSharedContainers: {},
    },
  };
});

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key) => mockSecureStoreStore[key] ?? null),
  setItemAsync: jest.fn(async (key, value) => {
    mockSecureStoreStore[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key) => {
    delete mockSecureStoreStore[key];
  }),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));

jest.mock("expo-linking", () => ({
  openSettings: jest.fn(),
  openURL: jest.fn(),
  createURL: jest.fn((path) => `echos://${path}`),
}));

jest.mock("expo-asset", () => ({
  Asset: {
    fromModule: jest.fn(() => ({
      localUri: "/mock/asset/path",
      downloadAsync: jest.fn(),
      uri: "/mock/asset/uri",
    })),
  },
}));

jest.mock("expo-font", () => ({
  useFonts: jest.fn(() => [true, null]),
  loadAsync: jest.fn(),
  isLoaded: jest.fn(() => true),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  useSegments: jest.fn(() => []),
  usePathname: jest.fn(() => "/"),
  Link: "Link",
  Stack: {
    Screen: "Screen",
  },
  Slot: "Slot",
}));

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [{ languageCode: "en", regionCode: "US" }]),
  locale: "en-US",
}));

jest.mock("expo-blur", () => ({
  BlurView: "BlurView",
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn(async () => ""),
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: "StatusBar",
}));

// ---------------------------------------------------------------------------
// Whisper
// ---------------------------------------------------------------------------
jest.mock("whisper.rn", () => ({
  initWhisper: jest.fn(async () => ({
    ptr: 1,
    id: 1,
    gpu: false,
    reasonNoGPU: "mock",
    transcribe: jest.fn(() => ({
      stop: jest.fn(),
      promise: Promise.resolve({
        result: "mock transcription",
        segments: [],
        isAborted: false,
      }),
    })),
    transcribeData: jest.fn(() => ({
      stop: jest.fn(),
      promise: Promise.resolve({
        result: "mock transcription",
        segments: [],
        isAborted: false,
      }),
    })),
    bench: jest.fn(),
    release: jest.fn(),
  })),
  initWhisperVad: jest.fn(async () => ({
    id: 1,
    gpu: false,
    reasonNoGPU: "mock",
    detectSpeech: jest.fn(async () => []),
    detectSpeechData: jest.fn(async () => []),
    release: jest.fn(),
  })),
  releaseAllWhisper: jest.fn(),
  releaseAllWhisperVad: jest.fn(),
  toggleNativeLog: jest.fn(),
  addNativeLogListener: jest.fn(() => ({ remove: jest.fn() })),
  libVersion: "0.0.0-mock",
  isUseCoreML: false,
  isCoreMLAllowFallback: false,
}));

jest.mock("whisper.rn/src/realtime-transcription", () => ({
  RealtimeTranscriber: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    nextSlice: jest.fn(),
    reset: jest.fn(),
    release: jest.fn(),
    updateCallbacks: jest.fn(),
    updateVadOptions: jest.fn(),
    updateAutoSliceOptions: jest.fn(),
    updateVadThrottleOptions: jest.fn(),
    getStatistics: jest.fn(() => ({
      isActive: false,
      isTranscribing: false,
      vadEnabled: false,
      audioStats: {},
      vadStats: {},
      sliceStats: {},
      autoSliceConfig: {},
    })),
    getTranscriptionResults: jest.fn(() => []),
  })),
  SliceManager: jest.fn().mockImplementation(() => ({
    addAudioData: jest.fn(() => ({ slice: null })),
    forceNextSlice: jest.fn(() => ({ slice: null })),
    getSliceByIndex: jest.fn(),
    getAudioDataForTranscription: jest.fn(),
    getCurrentSliceInfo: jest.fn(() => ({
      currentSliceIndex: 0,
      memoryUsage: { slicesInMemory: 0, totalSamples: 0, estimatedMB: 0 },
    })),
    getMemoryUsage: jest.fn(() => ({
      slicesInMemory: 0,
      totalSamples: 0,
      estimatedMB: 0,
    })),
    reset: jest.fn(),
  })),
  VAD_PRESETS: {
    default: {},
    sensitive: {},
    "very-sensitive": {},
    conservative: {},
    "very-conservative": {},
    continuous: {},
    meeting: {},
    noisy: {},
  },
}));

jest.mock(
  "whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter",
  () => ({
    AudioPcmStreamAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      isRecording: jest.fn(() => false),
      onData: jest.fn(),
      onError: jest.fn(),
      onStatusChange: jest.fn(),
      release: jest.fn(),
    })),
  }),
);

// ---------------------------------------------------------------------------
// AsyncStorage (in-memory)
// ---------------------------------------------------------------------------
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key) => mockAsyncStorageStore[key] ?? null),
    setItem: jest.fn(async (key, value) => {
      mockAsyncStorageStore[key] = value;
    }),
    removeItem: jest.fn(async (key) => {
      delete mockAsyncStorageStore[key];
    }),
    multiGet: jest.fn(async (keys) =>
      keys.map((k) => [k, mockAsyncStorageStore[k] ?? null]),
    ),
    multiSet: jest.fn(async (pairs) =>
      pairs.forEach(([k, v]) => {
        mockAsyncStorageStore[k] = v;
      }),
    ),
    multiRemove: jest.fn(async (keys) =>
      keys.forEach((k) => {
        delete mockAsyncStorageStore[k];
      }),
    ),
    getAllKeys: jest.fn(async () => Object.keys(mockAsyncStorageStore)),
    clear: jest.fn(async () => {
      mockAsyncStorageStore = {};
    }),
  },
}));

// ---------------------------------------------------------------------------
// React Native third-party native modules
// ---------------------------------------------------------------------------
jest.mock("react-native-aes-gcm-crypto", () => ({
  __esModule: true,
  default: {
    encrypt: jest.fn(async (plainText, _isBase64, _key) => ({
      iv: "mock-iv-0123456789ab",
      content: "encrypted-" + plainText,
      tag: "-mock-tag",
    })),
    decrypt: jest.fn(async () => "decrypted-content"),
  },
}));

jest.mock("@dr.pogodin/react-native-fs", () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: "/mock/document",
    CachesDirectoryPath: "/mock/cache",
    exists: jest.fn(async () => true),
    readFile: jest.fn(async () => ""),
    writeFile: jest.fn(),
    appendFile: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn(async () => ({
      size: 0,
      isFile: () => true,
      isDirectory: () => false,
    })),
    copyFile: jest.fn(),
    moveFile: jest.fn(),
    readDir: jest.fn(async () => []),
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }) => children,
  SafeAreaProvider: ({ children }) => children,
}));

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {
    call: jest.fn(),
    createAnimatedComponent: jest.fn((component) => component),
    View: require("react-native").View,
    Value: jest.fn(),
    event: jest.fn(),
    add: jest.fn(),
    eq: jest.fn(),
    set: jest.fn(),
    cond: jest.fn(),
    interpolate: jest.fn(),
    Extrapolate: { CLAMP: "clamp" },
    useAnimatedGestureHandler: jest.fn(),
    useAnimatedScrollHandler: jest.fn(),
    useSharedValue: jest.fn((v) => ({ value: v })),
    useAnimatedStyle: jest.fn(() => ({})),
    useDerivedValue: jest.fn((fn) => ({ value: fn() })),
    useAnimatedRef: jest.fn(() => ({ current: null })),
    withTiming: jest.fn((v) => v),
    withSpring: jest.fn((v) => v),
    withDecay: jest.fn((v) => v),
    withDelay: jest.fn((_, v) => v),
    withSequence: jest.fn((...args) => args[args.length - 1]),
    withRepeat: jest.fn((v) => v),
    cancelAnimation: jest.fn(),
    measure: jest.fn(),
    Easing: {
      linear: jest.fn(),
      ease: jest.fn(),
      bezier: jest.fn(() => jest.fn()),
      in: jest.fn(),
      out: jest.fn(),
      inOut: jest.fn(),
    },
    runOnUI: jest.fn((fn) => fn),
    runOnJS: jest.fn((fn) => fn),
  },
  useSharedValue: jest.fn((v) => ({ value: v })),
  useAnimatedStyle: jest.fn(() => ({})),
  useDerivedValue: jest.fn((fn) => ({ value: fn() })),
  useAnimatedRef: jest.fn(() => ({ current: null })),
  withTiming: jest.fn((v) => v),
  withSpring: jest.fn((v) => v),
  withDelay: jest.fn((_, v) => v),
  withSequence: jest.fn((...args) => args[args.length - 1]),
  withRepeat: jest.fn((v) => v),
  cancelAnimation: jest.fn(),
  Easing: {
    linear: jest.fn(),
    ease: jest.fn(),
    bezier: jest.fn(() => jest.fn()),
    in: jest.fn(),
    out: jest.fn(),
    inOut: jest.fn(),
  },
  runOnUI: jest.fn((fn) => fn),
  runOnJS: jest.fn((fn) => fn),
  createAnimatedComponent: jest.fn((component) => component),
  FadeIn: { duration: jest.fn().mockReturnThis() },
  FadeOut: { duration: jest.fn().mockReturnThis() },
  SlideInDown: { duration: jest.fn().mockReturnThis() },
  SlideOutDown: { duration: jest.fn().mockReturnThis() },
  Layout: { duration: jest.fn().mockReturnThis() },
}));

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: "Svg",
  Svg: "Svg",
  Circle: "Circle",
  Ellipse: "Ellipse",
  G: "G",
  Text: "SvgText",
  TSpan: "TSpan",
  TextPath: "TextPath",
  Path: "Path",
  Polygon: "Polygon",
  Polyline: "Polyline",
  Line: "Line",
  Rect: "Rect",
  Use: "Use",
  Image: "SvgImage",
  Symbol: "SvgSymbol",
  Defs: "Defs",
  LinearGradient: "SvgLinearGradient",
  RadialGradient: "RadialGradient",
  Stop: "Stop",
  ClipPath: "ClipPath",
  Pattern: "Pattern",
  Mask: "Mask",
  SvgProps: {},
}));

jest.mock("react-native-logs", () => ({
  logger: {
    createLogger: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      extend: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
      getExtensions: jest.fn(() => ({})),
      setSeverity: jest.fn(),
      getSeverity: jest.fn(() => "debug"),
      enable: jest.fn(),
      disable: jest.fn(),
    })),
  },
  mapConsoleTransport: jest.fn(),
  transportFunctions: {
    consoleSync: jest.fn(),
  },
}));

jest.mock("react-native-gesture-handler", () => {
  const View = require("react-native").View;
  return {
    GestureHandlerRootView: View,
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: View,
    gestureHandlerRootHOC: jest.fn((c) => c),
    Directions: {},
    Gesture: {
      Tap: jest.fn(() => ({
        onStart: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
      })),
      Pan: jest.fn(() => ({
        onStart: jest.fn().mockReturnThis(),
        onUpdate: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
      })),
    },
    GestureDetector: View,
  };
});

// ---------------------------------------------------------------------------
// Sherpa-ONNX (on-device STT engine)
// ---------------------------------------------------------------------------
jest.mock("react-native-sherpa-onnx/audio", () => ({
  createPcmLiveStream: jest.fn(async () => ({
    start: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    setOnSamples: jest.fn(),
    setOnError: jest.fn(),
  })),
  convertAudioToFormat: jest.fn(async () => "/mock/audio/out.wav"),
  convertAudioToWav16k: jest.fn(async () => "/mock/audio/out.wav"),
  decodeAudioFileToFloatSamples: jest.fn(async () => ({
    samples: new Float32Array(0),
    sampleRate: 16000,
  })),
}));

jest.mock("react-native-sherpa-onnx/stt", () => ({
  detectSttModel: jest.fn(async () => null),
  createSTT: jest.fn(async () => ({
    transcribeFile: jest.fn(async () => ({ text: "", segments: [] })),
    transcribeSamples: jest.fn(async () => ({ text: "", segments: [] })),
    createStream: jest.fn(() => ({
      acceptWaveform: jest.fn(),
      getResult: jest.fn(() => ({ text: "" })),
      isEndpoint: jest.fn(() => false),
      reset: jest.fn(),
      finish: jest.fn(),
      free: jest.fn(),
    })),
    release: jest.fn(async () => undefined),
  })),
  ONLINE_STT_MODEL_TYPES: [],
}));

// ---------------------------------------------------------------------------
// Audio PCM stream (Android)
// ---------------------------------------------------------------------------
jest.mock("@fugood/react-native-audio-pcm-stream", () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(async () => "/mock/audio/path.wav"),
    on: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Android foreground service
// ---------------------------------------------------------------------------
jest.mock("@supersami/rn-foreground-service", () => ({
  __esModule: true,
  default: {
    register: jest.fn(),
    start: jest.fn(),
    update: jest.fn(),
    stop: jest.fn(),
    stopAll: jest.fn(),
    eventListener: jest.fn(() => jest.fn()),
    add_task: jest.fn(() => "mock-task-id"),
    update_task: jest.fn(() => "mock-task-id"),
    remove_task: jest.fn(),
    is_task_running: jest.fn(() => false),
    remove_all_tasks: jest.fn(),
    get_task: jest.fn(() => null),
    get_all_tasks: jest.fn(() => ({})),
  },
}));

// ---------------------------------------------------------------------------
// Shopify Skia
// ---------------------------------------------------------------------------
jest.mock("@shopify/react-native-skia", () => ({
  Canvas: "Canvas",
  Path: "SkiaPath",
  Skia: {
    Path: { Make: jest.fn() },
    Color: jest.fn(),
  },
  useValue: jest.fn(() => ({ current: 0 })),
  useTiming: jest.fn(),
  useComputedValue: jest.fn(() => ({ current: 0 })),
  useClockValue: jest.fn(() => ({ current: 0 })),
  useDerivedValue: jest.fn(() => ({ current: 0 })),
}));

// ---------------------------------------------------------------------------
// i18next
// ---------------------------------------------------------------------------
jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: jest.fn((key) => key),
    i18n: {
      language: "en",
      changeLanguage: jest.fn(),
    },
  })),
  initReactI18next: {
    type: "3rdParty",
    init: jest.fn(),
  },
  Trans: ({ children }) => children,
}));

// ---------------------------------------------------------------------------
// base64-js
// ---------------------------------------------------------------------------
jest.mock("base64-js", () => ({
  fromByteArray: jest.fn((bytes) => Buffer.from(bytes).toString("base64")),
  toByteArray: jest.fn((str) => new Uint8Array(Buffer.from(str, "base64"))),
  byteLength: jest.fn((str) => Math.ceil((str.length * 3) / 4)),
}));

// ---------------------------------------------------------------------------
// Reset in-memory stores between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  mockAsyncStorageStore = {};
  mockSecureStoreStore = {};
  useThemeStore.setState({ currentTheme: "light", selectedTheme: "auto" });
});
