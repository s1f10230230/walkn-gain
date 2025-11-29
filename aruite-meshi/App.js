import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, Animated, Image, View, useColorScheme } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { I18nProvider } from './src/i18n/I18nProvider';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';
import { initAnalytics, logEvent } from './src/utils/analytics';
// HealthKitの初期化はオンボーディング/設定で行う
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
  const lastBackgroundAtRef = useRef(null);

  // initialize lightweight analytics once
  useEffect(() => {
    initAnalytics().then(() => {
      logEvent('app_open', { source: 'direct' });
    });
  }, []);

  // リマインダーは設定画面とオンボーディングでのみスケジュールする
  // アプリ起動時の再スケジュールは意図しない通知発火を防ぐため削除

  // HealthKit初期化はオンボーディング/設定で実施し、起動直後の許可ダイアログは出さない

  // アプリ復帰（background -> active）時に短いスプラッシュを表示
  // ・inactive（通知センター/許可ダイアログなど）からの復帰では表示しない
  // ・短時間のバックグラウンド復帰（< 1200ms）では表示しない
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev === 'background' && next === 'active') {
        try {
          const now = Date.now();
          const lastBg = lastBackgroundAtRef.current || 0;
          const elapsed = now - lastBg;
          const MIN_BG_MS = 1200; // 1.2s 以上の実バックグラウンドでのみ表示
          lastBackgroundAtRef.current = null;
          if (elapsed >= MIN_BG_MS) {
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
          }
        } catch (_) {}
      } else if (next === 'background') {
        // 背景に行った時刻を記録
        lastBackgroundAtRef.current = Date.now();
      }
    });
    return () => {
      try { sub.remove(); } catch (_) {}
    };
  }, []);
  return (
    <SafeAreaProvider>
      <SubscriptionProvider>
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
      </SubscriptionProvider>
    </SafeAreaProvider>
  );
}
