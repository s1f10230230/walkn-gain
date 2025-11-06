import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, Animated, Image, View, useColorScheme } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { I18nProvider } from './src/i18n/I18nProvider';
import { initAnalytics, logEvent } from './src/utils/analytics';
import { initializeHealthKit } from './src/utils/healthKit';
import { registerBackgroundStepsTask } from './src/tasks/backgroundStepsTask';
import { getTheme } from './src/utils/theme';

// React Native Screensを完全に無効化
try {
  const { enableScreens } = require('react-native-screens');
  enableScreens(false);
} catch (e) {
  // react-native-screensがない場合は無視
}

export default function App() {
  // 🌙 ダーク/ライトに応じたテーマ
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  // 復帰時の短いスプラッシュ（ブランドオーバーレイ）
  const [resumeSplashVisible, setResumeSplashVisible] = useState(false);
  const resumeFade = useRef(new Animated.Value(0)).current;
  const resumeScale = useRef(new Animated.Value(0.9)).current;
  const appStateRef = useRef(AppState.currentState);

  // initialize lightweight analytics once
  useEffect(() => {
    initAnalytics().then(() => {
      logEvent('app_open', { source: 'direct' });
    });
  }, []);

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

  // アプリ復帰（background/inactive -> active）時に短いスプラッシュを表示
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if ((prev === 'background' || prev === 'inactive') && next === 'active') {
        try {
          setResumeSplashVisible(true);
          resumeFade.setValue(0);
          resumeScale.setValue(0.9);
          Animated.parallel([
            Animated.timing(resumeFade, { toValue: 1, duration: 160, useNativeDriver: true }),
            Animated.spring(resumeScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
          ]).start(() => {
            setTimeout(() => {
              Animated.timing(resumeFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
                setResumeSplashVisible(false);
              });
            }, 420);
          });
        } catch (_) {}
      }
    });
    return () => {
      try { sub.remove(); } catch (_) {}
    };
  }, []);
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <RootNavigator />
        <StatusBar style="auto" />
        {resumeSplashVisible && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
              justifyContent: 'center', alignItems: 'center',
              backgroundColor: theme.background,
            }}
          >
            <Animated.View style={{ opacity: resumeFade, transform: [{ scale: resumeScale }] }}>
              <Image source={require('./assets/splash-icon.png')} style={{ width: 500, height: 500 }} resizeMode="contain" />
            </Animated.View>
          </View>
        )}
      </I18nProvider>
    </SafeAreaProvider>
  );
}
