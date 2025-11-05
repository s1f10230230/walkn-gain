const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// React Native Screensを完全に無効化（モックに置き換え）
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-screens') {
    return {
      filePath: path.resolve(__dirname, 'react-native-screens-mock.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
