const { withInfoPlist, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * iOS Widget Extension を追加する Config Plugin
 */
const withWidgetExtension = (config) => {
  // Info.plist にウィジェット関連の設定を追加
  config = withInfoPlist(config, (config) => {
    config.modResults.NSExtension = {
      NSExtensionPointIdentifier: 'com.apple.widgetkit-extension',
    };
    return config;
  });

  return config;
};

module.exports = withWidgetExtension;
