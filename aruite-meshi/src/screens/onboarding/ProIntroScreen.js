import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSettings, saveSettings, saveUserProfile, saveOnboardingComplete } from '../../utils/storage';
import { CommonActions } from '@react-navigation/native';
import { getTheme } from '../../utils/theme';
import { useI18n } from '../../i18n/I18nProvider';
import { useSubscription } from '../../contexts/SubscriptionContext';
import ScreenContainer from '../../components/ScreenContainer';

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
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

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
    <ScreenContainer scroll style={{ backgroundColor: theme.background }} contentStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}>
        <View style={[styles.content, isTablet && styles.contentTablet]}>
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <Text style={[styles.title, isTablet && styles.titleTablet, { color: theme.text }]}>
              {t('onboarding.proIntro.title')}
            </Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet, { color: theme.textSecondary }]}>
              {t('onboarding.proIntro.subtitle')}
            </Text>
          </View>

          <View style={[styles.mainSection, isTablet && styles.mainSectionTablet]}>
            {/* Pro機能カード */}
            <View style={[styles.featuresCard, isTablet && styles.featuresCardTablet, { backgroundColor: theme.card }]}>
              <View style={styles.proHeader}>
                <Text style={[styles.proLabel, { color: theme.accent }]}>Pro</Text>
                <Text style={[styles.proTitle, { color: theme.text }]}>
                  {t('onboarding.proIntro.proFeatures')}
                </Text>
              </View>

              <View style={[styles.featuresList, isTablet && styles.featuresListTablet]}>
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

          <View style={[styles.footer, isTablet && styles.footerTablet]}>
            {/* メインCTA: Proを体験する */}
            <TouchableOpacity
              style={[styles.primaryButton, isTablet && styles.primaryButtonTablet, { backgroundColor: theme.primary }]}
              onPress={handleViewPro}
            >
              <Text style={[styles.primaryButtonText, isTablet && styles.primaryButtonTextTablet]}>
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentTablet: {
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  contentTablet: {
    paddingHorizontal: 48,
  },
  header: {
    marginTop: 40,
    marginBottom: 32,
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: 720,
  },
  headerTablet: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  titleTablet: {
    fontSize: 36,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  subtitleTablet: {
    fontSize: 17,
    textAlign: 'center',
  },
  mainSection: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
  },
  mainSectionTablet: {
    alignSelf: 'center',
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
  featuresCardTablet: {
    width: '100%',
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
  featuresListTablet: {
    width: '100%',
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
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  footerTablet: {
    paddingHorizontal: 12,
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
  primaryButtonTablet: {
    paddingVertical: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  primaryButtonTextTablet: {
    fontSize: 20,
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
