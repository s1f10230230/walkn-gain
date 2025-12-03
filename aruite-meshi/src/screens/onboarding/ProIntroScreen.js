import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSettings, saveSettings, saveUserProfile, saveOnboardingComplete } from '../../utils/storage';
import { CommonActions } from '@react-navigation/native';
import { getTheme } from '../../utils/theme';
import { useI18n } from '../../i18n/I18nProvider';
import { useSubscription } from '../../contexts/SubscriptionContext';

// Pro機能の紹介（簡潔に）
const PRO_FEATURES = [
  { icon: 'calendar', titleKey: 'historyUnlimited' },
  { icon: 'trophy', titleKey: 'personalBestRanking' },
  { icon: 'stats-chart', titleKey: 'weeklyPattern' },
  { icon: 'analytics', titleKey: 'environmentAnalysis' },
  { icon: 'notifications', titleKey: 'rankingNotification' },
  { icon: 'book', titleKey: 'storyFullAccess' },
  { icon: 'camera', titleKey: 'morePhotos' },
];

export default function ProIntroScreen({ navigation, route }) {
  const { gender, age, height, weight, goalSteps, goalCalories } = route.params;
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { t, formatNumber } = useI18n();
  const { presentPaywall } = useSubscription();

  const handleComplete = async () => {
    try {
      console.log('🚀 オンボーディング完了処理開始');

      // プロフィールを保存
      await saveUserProfile({
        gender,
        age,
        height,
        weight,
        stride: gender === 'male' ? 78 : 70,
      });
      console.log('✅ プロフィール保存完了');

      // 既存設定を取り込み、上書き
      const current = await getSettings();
      await saveSettings({
        ...current,
        dailyGoal: goalSteps,
        goalCalories: goalCalories,
        defaultFood: 'ramen',
      });
      console.log('✅ 設定保存完了');

      // オンボーディング完了フラグを保存
      const onboardingSaved = await saveOnboardingComplete(true);
      console.log('✅ オンボーディング完了フラグ保存:', onboardingSaved);

      // メインアプリへ遷移
      const parent = navigation.getParent?.() || navigation;
      parent.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'MainApp' }],
        })
      );
    } catch (error) {
      console.error('❌ Error saving settings:', error);
    }
  };

  const handleViewPro = async () => {
    try {
      // プロフィールを保存
      await saveUserProfile({
        gender,
        age,
        height,
        weight,
        stride: gender === 'male' ? 78 : 70,
      });

      // 設定を保存
      const current = await getSettings();
      await saveSettings({
        ...current,
        dailyGoal: goalSteps,
        goalCalories: goalCalories,
        defaultFood: 'ramen',
      });

      // オンボーディング完了
      await saveOnboardingComplete(true);

      // RevenueCat Paywallを表示
      await presentPaywall();

      // Paywall閉じた後、MainAppへ遷移
      const parent = navigation.getParent?.() || navigation;
      parent.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'MainApp' }],
        })
      );
    } catch (error) {
      console.error('❌ Error:', error);
      // エラーでもMainAppへ遷移
      const parent = navigation.getParent?.() || navigation;
      parent.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'MainApp' }],
        })
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            {t('onboarding.proIntro.title')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('onboarding.proIntro.subtitle')}
          </Text>
        </View>

        <View style={styles.mainSection}>
          {/* Pro機能カード */}
          <View style={[styles.featuresCard, { backgroundColor: theme.card }]}>
            <View style={styles.proHeader}>
              <Text style={[styles.proLabel, { color: theme.accent }]}>Pro</Text>
              <Text style={[styles.proTitle, { color: theme.text }]}>
                {t('onboarding.proIntro.proFeatures')}
              </Text>
            </View>

            <View style={styles.featuresList}>
              {PRO_FEATURES.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <View style={[styles.featureIconContainer, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                    <Ionicons name={feature.icon} size={20} color="#FFC8A2" />
                  </View>
                  <Text style={[styles.featureText, { color: theme.text }]}>
                    {t(`onboarding.proIntro.features.${feature.titleKey}`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          {/* メインCTA: Proを体験する */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handleViewPro}
          >
            <Text style={styles.primaryButtonText}>
              {t('onboarding.proIntro.startPro')}
            </Text>
          </TouchableOpacity>

          {/* サブリンク: 今は無料で始める */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleComplete}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>
              {t('onboarding.proIntro.startFree')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  mainSection: {
    flex: 1,
  },
  featuresCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  proHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  proLabel: {
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0, 168, 150, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 10,
  },
  proTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  featuresList: {
    gap: 14,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    paddingBottom: 32,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#FF7043',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
