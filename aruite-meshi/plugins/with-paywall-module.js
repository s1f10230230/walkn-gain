const fs = require('fs');
const path = require('path');
const {
  withDangerousMod,
  withXcodeProject,
  IOSConfig,
  createRunOncePlugin,
} = require('@expo/config-plugins');

const PLUGIN_NAME = 'with-paywall-module';
const TEMPLATE_DIR = path.join(__dirname, 'ios');
const PAYWALL_FILES = ['PaywallView.swift', 'PaywallModule.swift', 'PaywallModule.m'];
const PAYWALL_IMAGE_NAME = 'paywall_header';
const PAYWALL_IMAGE_FILENAME = 'paywall.jpg';

const copyTemplate = (src, dest) => {
  if (!fs.existsSync(src)) {
    throw new Error(`[${PLUGIN_NAME}] Missing template: ${src}`);
  }
  const contents = fs.readFileSync(src, 'utf8');
  if (!fs.existsSync(dest) || fs.readFileSync(dest, 'utf8') !== contents) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, contents);
  }
};

const withPaywallModule = (config) => {
  config = withDangerousMod(config, ['ios', async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const iosRoot = config.modRequest.platformProjectRoot;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const targetDir = path.join(iosRoot, projectName);

    PAYWALL_FILES.forEach((file) => {
      copyTemplate(path.join(TEMPLATE_DIR, file), path.join(targetDir, file));
    });

    const sourceImage = path.join(projectRoot, 'assets', PAYWALL_IMAGE_FILENAME);
    const imagesetDir = path.join(
      targetDir,
      'Images.xcassets',
      `${PAYWALL_IMAGE_NAME}.imageset`
    );
    const imageDest = path.join(imagesetDir, PAYWALL_IMAGE_FILENAME);
    if (!fs.existsSync(sourceImage)) {
      throw new Error(`[${PLUGIN_NAME}] Missing image: ${sourceImage}`);
    }
    fs.mkdirSync(imagesetDir, { recursive: true });
    fs.copyFileSync(sourceImage, imageDest);
    const contents = {
      images: [
        { idiom: 'universal', filename: PAYWALL_IMAGE_FILENAME, scale: '1x' },
        { idiom: 'universal', scale: '2x' },
        { idiom: 'universal', scale: '3x' },
      ],
      info: { version: 1, author: 'xcode' },
    };
    fs.writeFileSync(
      path.join(imagesetDir, 'Contents.json'),
      JSON.stringify(contents, null, 2)
    );

    return config;
  }]);

  return withXcodeProject(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const basePath = projectName;

    PAYWALL_FILES.forEach((file) => {
      const filePath = path.join(basePath, file);
      const groupName = path.dirname(filePath);
      if (!config.modResults.hasFile(filePath)) {
        IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
          filepath: filePath,
          groupName,
          project: config.modResults,
          verbose: false,
        });
      }
    });

    return config;
  });
};

module.exports = createRunOncePlugin(withPaywallModule, PLUGIN_NAME, '1.0.0');
