import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n/I18nProvider';
import { initializeHealthKit, importHistoricalData } from '../../utils/healthKit';
import { saveHealthSyncEnabled } from '../../utils/storage';
import { useColorScheme } from 'react-native';
import { getTheme } from '../../utils/theme';

export default function HealthKitPermissionScreen({ navigation, route }) {
  const ENABLE_HEALTHKIT_IMPORT = true; // 初回にサイレントで過去データを取り込み（ユーザー通知なし）
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const { gender, age, height, weight, goalSteps } = route.params;
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const navigateToCalorieGoal = () => {
    navigation.navigate('CalorieGoal', {
      gender,
      age,
      height,
      weight,
      goalSteps,
    });
  };

  const handleContinue = async () => {
    setIsLoading(true);
    let enabled = false;
    try {
      const success = await initializeHealthKit();

      if (success) {
        await saveHealthSyncEnabled(true);
        enabled = true;
        if (ENABLE_HEALTHKIT_IMPORT) {
          try {
            console.log('📊 [HealthKitPermission] 過去データの取り込みを開始...');
            const result = await importHistoricalData(30);
            console.log('📊 [HealthKitPermission] インポート完了:', JSON.stringify(result, null, 2));
          } catch (err) {
            console.error('❌ [HealthKitPermission] インポートエラー:', err);
            console.error('❌ [HealthKitPermission] エラー詳細:', err.message, err.stack);
          }
        }
      }
    } catch (error) {
      console.error('HealthKit初期化エラー:', error);
    } finally {
      if (!enabled) {
        await saveHealthSyncEnabled(false);
      }
      setIsLoading(false);
      navigateToCalorieGoal();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
          isLargeScreen && styles.scrollContentTablet,
        ]}
      >
        <View style={[styles.contentWrapper, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              {t('onboarding.health.title')}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t('onboarding.health.subtitle')}
            </Text>
          </View>

          <View style={[styles.permissionCard, { borderColor: theme.border }]}>
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
                {t('onboarding.health.importNote') || '端末に保存されている歩数を取り込む場合があります'}
              </Text>
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

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handleContinue}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {t('common.continue') || '続ける'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  scrollContentTablet: {
    paddingHorizontal: 40,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 640,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    gap: 20,
  },
  header: {
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
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
  },
  iconContainer: {
    marginRight: 16,
  },
  icon: {
    fontSize: 32,
  },
  permissionContent: {
    flex: 1,
    gap: 8,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  permissionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'left',
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
