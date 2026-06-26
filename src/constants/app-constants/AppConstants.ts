export const AppConstants = {
  SESSION_NAME_MAX_LENGTH: 30,
  AUDIO_SAMPLE_RATE: 16000,
  AUDIO_NUM_CHANNELS: 1,
  WORDS_PER_PARAGRAPH: 30,
  SENTENCES_PER_PARAGRAPH: 3,
  APP_BAR_HEIGHT: 60,
  APP_BAR_ICON_BUTTON_SIZE: 40,
  RECORDING_CONTROLS_HEIGHT: 96,
  SMART_SPLIT_LONG_PAUSE_MS: 3000,
  SMART_SPLIT_MAX_ITEM_MS: 60000,
  SMART_SPLIT_SILENCE_ENERGY_THRESHOLD: 0.02,
  LIST_PAGE_SIZE: 30,
  SCROLL_TO_EDGE_THRESHOLD_RATIO: 0.5,
  // Scroll offset (px) past which an app bar switches from a solid surface that
  // blends into the screen to its glass/blur background. A few px avoids
  // sub-pixel jitter flipping the state at the very top.
  APP_BAR_SCROLL_BLUR_THRESHOLD: 4,
} as const;
