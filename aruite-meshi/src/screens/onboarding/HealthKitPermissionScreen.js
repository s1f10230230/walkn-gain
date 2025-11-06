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
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            {t('onboarding.health.title')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('onboarding.health.subtitle')}
          </Text>
        </View>

        {/* HealthKit Permission Card */}
        <View style={[styles.permissionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>❤️</Text>
          </View>
          <View style={styles.permissionContent}>
            <Text style={[styles.permissionTitle, { color: theme.text }]}>
              {t('onboarding.health.cardTitle') || 'ヘルスケア連携'}
            </Text>
            <Text style={[styles.permissionDescription, { color: theme.textSecondary }]}>
              {t('onboarding.health.benefit1') || '正確な歩数計測と自動同期'}
            </Text>
            <Text style={[styles.permissionDescription, { color: theme.textSecondary }]}>
              {t('onboarding.health.benefit2') || 'バックグラウンドでの自動更新'}
            </Text>
            <Text style={[styles.permissionDescription, { color: theme.textSecondary }]}>
              {t('onboarding.health.benefit3') || '過去30日分のデータをインポート'}
            </Text>
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: theme.primary }]}
              onPress={handleAllow}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.permissionButtonText}>
                  {t('onboarding.health.allow') || '連携する（推奨）'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Note */}
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

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={[styles.skipButton, { borderColor: theme.border }]}
          onPress={handleSkip}
          disabled={isLoading}
        >
          <Text style={[styles.skipButtonText, { color: theme.textSecondary }]}>
            {t('onboarding.health.skip') || 'スキップ'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  permissionCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    marginRight: 16,
  },
  icon: {
    fontSize: 32,
  },
  permissionContent: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  permissionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  permissionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'left',
  },
  bottomButtons: {
    gap: 12,
  },
  skipButton: {
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
