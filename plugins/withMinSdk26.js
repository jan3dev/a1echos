const { withGradleProperties } = require('expo/config-plugins');

const withMinSdk26 = (config) => {
  return withGradleProperties(config, (config) => {
    const minSdkProp = config.modResults.find(
      (item) => item.type === 'property' && item.key === 'android.minSdkVersion'
    );

    if (minSdkProp) {
      minSdkProp.value = '26';
    } else {
      config.modResults.push({
        type: 'property',
        key: 'android.minSdkVersion',
        value: '26',
      });
    }

    return config;
  });
};

module.exports = withMinSdk26;
