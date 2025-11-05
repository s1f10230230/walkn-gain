import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { I18nProvider } from './src/i18n/I18nProvider';
import { initAnalytics, logEvent } from './src/utils/analytics';
import { initializeHealthKit } from './src/utils/healthKit';
import { registerBackgroundStepsTask } from './src/tasks/backgroundStepsTask';

// React Native Screensを完全に無効化
try {
  const { enableScreens } = require('react-native-screens');
  enableScreens(false);
} catch (e) {
  // react-native-screensがない場合は無視
}

export default function App() {
  // initialize lightweight analytics once
  initAnalytics().then(() => {
    logEvent('app_open', { source: 'direct' });
  });

  // 起動時に HealthKit を初期化（オプトインで権限リクエストするため、ここでは初期化のみ）
  useEffect(() => {
    console.log('🔵 [App.js] HealthKit初期化を試みます（静的初期化）');
    initializeHealthKit()
      .then((success) => {
        if (success) {
          console.log('✅ [App.js] HealthKit初期化成功（アプリ起動時）');
          // HealthKit初期化成功後、バックグラウンドタスクを登録
          registerBackgroundStepsTask()
            .then((registered) => {
              if (registered) {
                console.log('✅ [App.js] バックグラウンドタスク登録成功');
              } else {
                console.log('ℹ️ [App.js] バックグラウンドタスク登録スキップ');
              }
            })
            .catch((error) => {
              console.log('⚠️ [App.js] バックグラウンドタスク登録エラー:', error);
            });
        } else {
          console.log('ℹ️ [App.js] HealthKit初期化スキップ（権限は後でリクエスト）');
        }
      })
      .catch((error) => {
        console.log('⚠️ [App.js] HealthKit初期化エラー（非致命的）:', error);
      });
  }, []);
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </I18nProvider>
    </SafeAreaProvider>
  );
}
