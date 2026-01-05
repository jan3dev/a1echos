const { withAndroidManifest } = require('expo/config-plugins');

const withRnForegroundService = (config) => {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (!mainApplication) {
      console.warn(
        'withRnForegroundService: No <application> found in AndroidManifest.xml'
      );
      return config;
    }

    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    const foregroundServiceName =
      'com.supersami.foregroundservice.ForegroundService';
    const foregroundServiceTaskName =
      'com.supersami.foregroundservice.ForegroundServiceTask';

    const hasForegroundService = mainApplication.service.some(
      (s) => s.$?.['android:name'] === foregroundServiceName
    );
    const hasForegroundServiceTask = mainApplication.service.some(
      (s) => s.$?.['android:name'] === foregroundServiceTaskName
    );

    if (!hasForegroundService) {
      mainApplication.service.push({
        $: {
          'android:name': foregroundServiceName,
          'android:foregroundServiceType': 'microphone',
          'android:exported': 'false',
        },
      });
    }

    if (!hasForegroundServiceTask) {
      mainApplication.service.push({
        $: {
          'android:name': foregroundServiceTaskName,
          'android:foregroundServiceType': 'microphone',
          'android:exported': 'false',
        },
      });
    }

    if (!mainApplication['meta-data']) {
      mainApplication['meta-data'] = [];
    }

    const channelNameKey =
      'com.supersami.foregroundservice.notification_channel_name';
    const channelDescKey =
      'com.supersami.foregroundservice.notification_channel_description';

    const hasChannelName = mainApplication['meta-data'].some(
      (m) => m.$?.['android:name'] === channelNameKey
    );
    const hasChannelDesc = mainApplication['meta-data'].some(
      (m) => m.$?.['android:name'] === channelDescKey
    );

    if (!hasChannelName) {
      mainApplication['meta-data'].push({
        $: {
          'android:name': channelNameKey,
          'android:value': 'Echos Recording',
        },
      });
    }

    if (!hasChannelDesc) {
      mainApplication['meta-data'].push({
        $: {
          'android:name': channelDescKey,
          'android:value': 'Keeps the app running while recording audio',
        },
      });
    }

    return config;
  });
};

module.exports = withRnForegroundService;
