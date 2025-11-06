import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n/I18nProvider';
import { initializeHealthKit, importHistoricalData } from '../../utils/healthKit';
import { saveHealthSyncEnabled, saveOnboardingComplete } from '../../utils/storage';
import { useColorScheme } from 'react-native';
import { getTheme } from '../../utils/theme';

export default function HealthKitPermissionScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const { gender, age, height, weight, goalSteps } = route.params;
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  const navigateToCalorieGoal = () => {
    navigation.navigate('CalorieGoal', {
      gender,
      age,
      height,
      weight,
      goalSteps,
    });
  };

  const handleAllow = async () => {
    setIsLoading(true);
    let debugInfo = '';

    // react-native-health ライブラリの確認
    try {
      const { NativeModules } = require('react-native');
      const RNHealth = require('react-native-health');

      debugInfo += `📦 react-native-health: ${RNHealth ? 'loaded' : 'NOT LOADED'}\n`;
      debugInfo += `📦 RNHealth.default: ${RNHealth.default ? 'exists' : 'missing'}\n`;
      debugInfo += `📦 RNHealth.HealthKit: ${RNHealth.HealthKit ? 'exists' : 'missing'}\n`;

      // RNHealthの中身を詳しく確認
      if (RNHealth) {
        const keys = Object.keys(RNHealth);
        debugInfo += `📦 RNHealth keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}\n`;
      }

      // NativeModulesから直接確認
      if (NativeModules.AppleHealthKit) {
        debugInfo += `✅ NativeModules.AppleHealthKit: exists\n`;
        const methods = Object.keys(NativeModules.AppleHealthKit);
        debugInfo += `📦 Native methods (${methods.length}): ${methods.slice(0, 5).join(', ')}...\n`;
        debugInfo += `📦 Has initHealthKit: ${!!NativeModules.AppleHealthKit.initHealthKit}\n`;
      } else {
        debugInfo += `❌ NativeModules.AppleHealthKit: NOT FOUND\n`;
        // すべてのNativeModulesをリスト
        const allModules = Object.keys(NativeModules);
        const healthRelated = allModules.filter(k => k.toLowerCase().includes('health'));
        debugInfo += `📦 Total NativeModules: ${allModules.length}\n`;
        debugInfo += `📦 Health-related modules: ${healthRelated.length > 0 ? healthRelated.join(', ') : 'none'}\n`;
        debugInfo += `📦 Sample modules: ${allModules.slice(0, 10).join(', ')}...\n`;
      }

      // 最終的に使用されるモジュール
      const AppleHealthKit = RNHealth.default || RNHealth.HealthKit || RNHealth;
      if (AppleHealthKit) {
        debugInfo += `📦 Final AppleHealthKit: exists\n`;
        debugInfo += `📦 Type: ${typeof AppleHealthKit}\n`;
        debugInfo += `📦 initHealthKit: ${typeof AppleHealthKit.initHealthKit}\n`;
        debugInfo += `📦 isAvailable: ${typeof AppleHealthKit.isAvailable}\n`;
        debugInfo += `📦 getStepCount: ${typeof AppleHealthKit.getStepCount}\n`;
        debugInfo += `📦 Constants: ${AppleHealthKit.Constants ? 'exists' : 'missing'}\n`;

        if (AppleHealthKit.Constants?.Permissions) {
          const perms = Object.keys(AppleHealthKit.Constants.Permissions);
          debugInfo += `📦 Permissions count: ${perms.length}\n`;
          debugInfo += `📦 Has StepCount: ${!!AppleHealthKit.Constants.Permissions.StepCount}\n`;
          debugInfo += `📦 Has Steps: ${!!AppleHealthKit.Constants.Permissions.Steps}\n`;
        }
      } else {
        debugInfo += `❌ Final AppleHealthKit が存在しません\n`;
      }
    } catch (e) {
      debugInfo += `❌ ライブラリエラー: ${e.message}\n`;
      debugInfo += `❌ Stack: ${e.stack?.slice(0, 200)}\n`;
      Alert.alert('デバッグ情報（ステップ1）', debugInfo);
      setIsLoading(false);
      return;
    }

    try {
      const success = await initializeHealthKit();
      debugInfo += `\n🔵 initHealthKit結果: ${success}\n`;

      if (success) {
        await saveHealthSyncEnabled(true);
        // 過去30日をインポート（失敗しても続行）
        try {
          console.log('📊 [HealthKitPermission] 過去30日分のデータインポートを開始...');
          const result = await importHistoricalData(30);
          console.log('📊 [HealthKitPermission] インポート結果:', JSON.stringify(result, null, 2));

          const msg = result?.success
            ? `過去${result.totalDays ?? 30}日中 ${result.importedDays ?? 0}日をインポートしました。`
            : `過去データのインポートに失敗しました\nエラー: ${result?.errors?.[0] || '不明'}`;
          Alert.alert('✅ 連携完了', `${msg}`);
        } catch (err) {
          console.error('❌ [HealthKitPermission] インポートエラー:', err);
          console.error('❌ [HealthKitPermission] エラー詳細:', err.message, err.stack);
          Alert.alert('✅ 連携完了', '過去データのインポートに失敗しましたが、連携は成功しました。');
        }
        navigateToCalorieGoal();
      } else {
        Alert.alert(
          '❌ 接続失敗',
          'ヘルスケアへの接続に失敗しました。\n\n詳細:\n' + debugInfo,
          [
            { text: 'スキップ', onPress: handleSkip },
            { text: '再試行', onPress: () => setIsLoading(false) },
          ]
        );
      }
    } catch (error) {
      debugInfo += `❌ エラー: ${error.message || error}\n`;
      debugInfo += `❌ Stack: ${error.stack?.slice(0, 200)}\n`;
      Alert.alert('エラー詳細', debugInfo);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    await saveHealthSyncEnabled(false);
    navigateToCalorieGoal();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Text style={styles.emoji}>❤️</Text>
        <Text style={[styles.title, { color: theme.text }]}>{t('onboarding.health.title')}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t('onboarding.health.subtitle')}
        </Text>

        <View style={styles.benefitsContainer}>
          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>⭐</Text>
            <Text style={[styles.benefitText, { color: theme.text }]}>{t('onboarding.health.benefit1')}</Text>
          </View>
          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>🔔</Text>
            <Text style={[styles.benefitText, { color: theme.text }]}>{t('onboarding.health.benefit2')}</Text>
          </View>
          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>🔄</Text>
            <Text style={[styles.benefitText, { color: theme.text }]}>{t('onboarding.health.benefit3')}</Text>
          </View>
        </View>

        <View
          style={[
            styles.infoBox,
            {
              backgroundColor: theme.isDark ? '#2A1B14' : '#FFF3E0',
              borderLeftColor: theme.primary,
            },
          ]}
        >
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            {t('onboarding.health.privacy')}
          </Text>
          <Text style={[styles.infoText, { color: theme.textSecondary, marginTop: 6 }]}>
            {t('onboarding.health.importNote')}
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[styles.allowButton, { backgroundColor: theme.primary }]}
          onPress={handleAllow}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.allowButtonText}>{t('onboarding.health.allow') || '連携する（推奨）'}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={isLoading}
        >
          <Text style={[styles.skipButtonText, { color: theme.textSecondary }]}>{t('onboarding.health.skip') || 'スキップ'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emoji: {
    fontSize: 100,
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 15,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
  },
  benefitsContainer: {
    width: '100%',
    marginBottom: 30,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  benefitIcon: { fontSize: 24, marginRight: 15, fontWeight: '700' },
  benefitText: { fontSize: 16, fontWeight: '500' },
  privacyNote: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  infoBox: {
    width: '100%',
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'left',
  },
  footer: {
    paddingHorizontal: 30,
  },
  allowButton: { paddingVertical: 18, borderRadius: 30, alignItems: 'center', marginBottom: 15 },
  allowButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#9E9E9E',
    fontSize: 16,
    fontWeight: '600',
  },
});
