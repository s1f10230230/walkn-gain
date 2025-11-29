import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTheme } from '../utils/theme';
import { useI18n } from '../i18n/I18nProvider';
import { useSubscription } from '../contexts/SubscriptionContext';

// プレミアム特典リスト
const PREMIUM_FEATURES = [
  {
    icon: '📅',
    title: '履歴無制限',
    description: '過去30日以上の歩数データにアクセス',
  },
  {
    icon: '📊',
    title: '詳細グラフ',
    description: '週間・月間の統計グラフを表示',
  },
  {
    icon: '📖',
    title: 'ストーリー全期間',
    description: '過去すべてのストーリーを振り返り',
  },
  {
    icon: '📷',
    title: '写真4枚/日',
    description: '1日に最大4枚の写真を追加',
  },
  {
    icon: '⏰',
    title: '過去の時間帯グラフ',
    description: '過去日の時間帯別歩数を確認',
  },
];

// 価格設定（仮）
const PRICING = {
  monthly: {
    price: '¥400',
    period: '月額',
    productId: 'premium_monthly',
  },
  yearly: {
    price: '¥3,200',
    period: '年額',
    productId: 'premium_yearly',
    discount: '2ヶ月分お得',
  },
};

export default function UpgradeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { t } = useI18n();
  const { setDebugPremium } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [isLoading, setIsLoading] = useState(false);

  // 元の画面に戻る
  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  // 購入処理（RevenueCat実装後に置き換え）
  const handlePurchase = async () => {
    setIsLoading(true);

    try {
      // TODO: RevenueCat購入処理
      // const purchaserInfo = await Purchases.purchaseProduct(PRICING[selectedPlan].productId);

      // 仮の処理：2秒待って成功（デバッグ用）
      await new Promise(resolve => setTimeout(resolve, 2000));

      // デバッグ用：プレミアム状態を有効化
      await setDebugPremium(true);

      Alert.alert(
        'アップグレード完了',
        'プレミアムプランへのアップグレードありがとうございます！',
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('エラー', '購入処理中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // 復元処理
  const handleRestore = async () => {
    setIsLoading(true);

    try {
      // TODO: RevenueCat復元処理
      // const purchaserInfo = await Purchases.restorePurchases();

      await new Promise(resolve => setTimeout(resolve, 1000));

      Alert.alert('復元', '購入の復元を試みました。');
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
            プレミアムにアップグレード
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            日常をもっと深く振り返ろう
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
          {/* 年額プラン */}
          <TouchableOpacity
            style={[
              styles.planCard,
              { backgroundColor: theme.card, borderColor: theme.border },
              selectedPlan === 'yearly' && { borderColor: theme.primary, borderWidth: 2 },
            ]}
            onPress={() => setSelectedPlan('yearly')}
          >
            {PRICING.yearly.discount && (
              <View style={[styles.discountBadge, { backgroundColor: theme.primary }]}>
                <Text style={styles.discountText}>{PRICING.yearly.discount}</Text>
              </View>
            )}
            <View style={styles.planRadio}>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: selectedPlan === 'yearly' ? theme.primary : theme.border },
                ]}
              >
                {selectedPlan === 'yearly' && (
                  <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />
                )}
              </View>
            </View>
            <View style={styles.planInfo}>
              <Text style={[styles.planPeriod, { color: theme.textSecondary }]}>
                {PRICING.yearly.period}
              </Text>
              <Text style={[styles.planPrice, { color: theme.text }]}>
                {PRICING.yearly.price}
              </Text>
              <Text style={[styles.planNote, { color: theme.textSecondary }]}>
                月あたり約¥267
              </Text>
            </View>
          </TouchableOpacity>

          {/* 月額プラン */}
          <TouchableOpacity
            style={[
              styles.planCard,
              { backgroundColor: theme.card, borderColor: theme.border },
              selectedPlan === 'monthly' && { borderColor: theme.primary, borderWidth: 2 },
            ]}
            onPress={() => setSelectedPlan('monthly')}
          >
            <View style={styles.planRadio}>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: selectedPlan === 'monthly' ? theme.primary : theme.border },
                ]}
              >
                {selectedPlan === 'monthly' && (
                  <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />
                )}
              </View>
            </View>
            <View style={styles.planInfo}>
              <Text style={[styles.planPeriod, { color: theme.textSecondary }]}>
                {PRICING.monthly.period}
              </Text>
              <Text style={[styles.planPrice, { color: theme.text }]}>
                {PRICING.monthly.price}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

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
              {selectedPlan === 'yearly' ? '年額プランで始める' : '月額プランで始める'}
            </Text>
          )}
        </TouchableOpacity>

        {/* 復元・利用規約 */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleRestore} disabled={isLoading}>
            <Text style={[styles.footerLink, { color: theme.textSecondary }]}>
              購入を復元
            </Text>
          </TouchableOpacity>

          <View style={styles.footerDivider} />

          <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
            <Text style={[styles.footerLink, { color: theme.textSecondary }]}>
              利用規約
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.legalText, { color: theme.textSecondary }]}>
          サブスクリプションは自動更新されます。
          更新日の24時間前までにキャンセルしない限り、
          同じ価格で自動的に更新されます。
        </Text>
      </ScrollView>
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
