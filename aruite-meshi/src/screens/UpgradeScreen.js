import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTheme } from '../utils/theme';
import { useI18n } from '../i18n/I18nProvider';
import { useSubscription } from '../contexts/SubscriptionContext';
import Purchases from 'react-native-purchases';
import ProTourModal from '../components/ProTourModal';
import { buildProTourSlides } from '../utils/proTourSlides';
import { PLAN_ORDER, PREMIUM_FEATURES, PRICING } from './upgrade/config';
import { getBillingDisclosure, pickPackage } from './upgrade/purchase';

function PlanCard({ pricing, selected, theme, onPress }) {
  return (
    <TouchableOpacity
      style={[
        styles.planCard,
        { backgroundColor: theme.card, borderColor: theme.border },
        selected && { borderColor: theme.primary, borderWidth: 2 },
      ]}
      onPress={onPress}
    >
      {pricing.discount && (
        <View style={[styles.discountBadge, { backgroundColor: theme.primary }]}>
          <Text style={styles.discountText}>{pricing.discount}</Text>
        </View>
      )}
      <View style={styles.planRadio}>
        <View
          style={[
            styles.radioOuter,
            { borderColor: selected ? theme.primary : theme.border },
          ]}
        >
          {selected && <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />}
        </View>
      </View>
      <View style={styles.planInfo}>
        <Text style={[styles.planPeriod, { color: theme.textSecondary }]}>
          {pricing.period}
        </Text>
        <Text style={[styles.planPrice, { color: theme.text }]}>
          {pricing.price}
        </Text>
        {pricing.note && (
          <Text style={[styles.planNote, { color: theme.textSecondary }]}>
            {pricing.note}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function UpgradeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { t } = useI18n();
  const { checkSubscription, restorePurchases, isInitialized, trialEligible } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [showProTour, setShowProTour] = useState(false);

  const proSlides = useMemo(() => buildProTourSlides(t), [t]);
  const selectedPricing = PRICING[selectedPlan];
  const billingDisclosure = getBillingDisclosure(selectedPlan, trialEligible);

  // 元の画面に戻る
  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleOpenEula = () => {
    const url = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
    Linking.openURL(url).catch(() => {
      Alert.alert(
        t('common.error'),
        t('settings.alerts.linkOpenError') || 'リンクを開けませんでした。'
      );
    });
  };

  // 購入処理（RevenueCat）
  const handlePurchase = async () => {
    if (!isInitialized) {
      Alert.alert('購入情報が利用できません', '課金設定がまだ準備できていません。');
      return;
    }
    setIsLoading(true);

    try {
      const offerings = await Purchases.getOfferings();
      const packages = offerings?.current?.availablePackages || [];
      if (!packages.length) {
        Alert.alert('購入情報が取得できません', 'しばらくしてからお試しください。');
        return;
      }

      const target = pickPackage(packages, selectedPlan);
      if (!target) {
        Alert.alert('購入プランが見つかりません', 'App Storeの設定をご確認ください。');
        return;
      }

      await Purchases.purchasePackage(target);
      await checkSubscription();

      Alert.alert(
        'アップグレード完了',
        'プレミアムプランへのアップグレードありがとうございます！',
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch (error) {
      if (error?.userCancelled) return;
      console.error('Purchase error:', error);
      Alert.alert('エラー', '購入処理中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // 復元処理
  const handleRestore = async () => {
    if (!isInitialized) {
      Alert.alert('購入情報が利用できません', '課金設定がまだ準備できていません。');
      return;
    }
    setIsLoading(true);

    try {
      const restored = await restorePurchases();
      await checkSubscription();
      Alert.alert(
        '復元',
        restored ? '購入を復元しました。' : '復元できる購入が見つかりませんでした。'
      );
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert('エラー', '復元処理中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ヘッダー */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: theme.textSecondary }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* タイトル */}
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: theme.text }]}>
            Walk'n Life Pro
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            AIとデータで、歩く毎日をフルブースト。
          </Text>
          <Text style={[styles.trialNote, { color: trialEligible ? theme.primary : theme.textSecondary }]}>
            {trialEligible ? '初回3日間の無料トライアル' : 'トライアルは適用対象外です'}
          </Text>
        </View>

        {/* 特典リスト */}
        <View style={[styles.featuresCard, { backgroundColor: theme.card }]}>
          {PREMIUM_FEATURES.map((feature, index) => (
            <View
              key={index}
              style={[
                styles.featureRow,
                index < PREMIUM_FEATURES.length - 1 && styles.featureBorder,
                { borderBottomColor: theme.border },
              ]}
            >
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: theme.text }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.featureDesc, { color: theme.textSecondary }]}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* プラン選択 */}
        <View style={styles.plansSection}>
          {PLAN_ORDER.map((planKey) => (
            <PlanCard
              key={planKey}
              pricing={PRICING[planKey]}
              selected={selectedPlan === planKey}
              theme={theme}
              onPress={() => setSelectedPlan(planKey)}
            />
          ))}
        </View>

        {/* Pro詳細モーダル起動 */}
        <TouchableOpacity
          style={[styles.detailButton, { borderColor: theme.primary }]}
          onPress={() => setShowProTour(true)}
        >
          <Text style={[styles.detailButtonText, { color: theme.primary }]}>
            {t('settings.premium.proTour.seeDetails')}
          </Text>
        </TouchableOpacity>

        {/* 購入ボタン */}
        <TouchableOpacity
          style={[styles.purchaseButton, { backgroundColor: theme.primary }]}
          onPress={handlePurchase}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.purchaseButtonText}>
              {selectedPricing.purchaseLabel}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.billingNote, { color: theme.textSecondary }]}>
          {billingDisclosure}
        </Text>

        {/* 復元・利用規約 */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleRestore} disabled={isLoading}>
            <Text style={[styles.footerLink, { color: theme.textSecondary }]}>
              購入を復元
            </Text>
          </TouchableOpacity>

          <View style={styles.footerDivider} />

          <TouchableOpacity onPress={handleOpenEula}>
            <Text style={[styles.footerLink, { color: theme.textSecondary }]}>
              {t('settings.eula')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.legalText, { color: theme.textSecondary }]}>
          サブスクリプションは自動更新されます。
          更新日の24時間前までにキャンセルしない限り、
          同じ価格で自動的に更新されます。
        </Text>
      </ScrollView>

      <ProTourModal
        visible={showProTour}
        onClose={() => setShowProTour(false)}
        onDone={() => setShowProTour(false)}
        slides={proSlides}
        theme={theme}
        t={t}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 20,
    fontWeight: '300',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  trialNote: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  featuresCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  featureBorder: {
    borderBottomWidth: 1,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
  },
  plansSection: {
    marginBottom: 24,
    gap: 12,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    position: 'relative',
  },
  discountBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  discountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  planRadio: {
    marginRight: 16,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  planInfo: {
    flex: 1,
  },
  planPeriod: {
    fontSize: 13,
    marginBottom: 2,
  },
  planPrice: {
    fontSize: 22,
    fontWeight: '700',
  },
  planNote: {
    fontSize: 12,
    marginTop: 2,
  },
  detailButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    borderWidth: 1,
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  purchaseButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  billingNote: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  footerLink: {
    fontSize: 14,
  },
  footerDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#ccc',
    marginHorizontal: 16,
  },
  legalText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
