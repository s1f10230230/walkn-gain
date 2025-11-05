// React Native Screens のモック
// boolean型エラーを回避するため、すべての機能を無効化

export const enableScreens = () => {};
export const screensEnabled = () => false;

export const Screen = ({ children }) => children;
export const ScreenContainer = ({ children }) => children;
export const NativeScreen = ({ children }) => children;
export const NativeScreenContainer = ({ children }) => children;

export default {
  enableScreens,
  screensEnabled,
  Screen,
  ScreenContainer,
  NativeScreen,
  NativeScreenContainer,
};
