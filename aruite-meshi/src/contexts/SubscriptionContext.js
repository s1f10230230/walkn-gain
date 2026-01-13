import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform, NativeModules, Alert } from 'react-native';
import Purchases, { LOG_LEVEL, INTRO_ELIGIBILITY_STATUS } from 'react-native-purchases';
import Constants from 'expo-constants';

const { PaywallModule } = NativeModules;

// RevenueCat API Keys（.env / app.config.js の extra から取得）
const REVENUECAT_API_KEY = Constants?.expoConfig?.extra?.REVENUECAT_API_KEY || '';
const ENTITLEMENT_ID = "Walk'n Gain Pro";

// 無料プランの制限
export const FREE_LIMITS = {
  historyDays: Infinity,    // 歩数データは無期限閲覧可能
  photosPerDay: 1,          // 写真は1日1枚
  storyDays: 30,            // ストーリー（日記・写真閲覧）は30日まで
  hourlyGraphPastDays: false, // 過去日の時間帯グラフは不可
};

// プレミアムプランの制限（実質無制限）
export const PREMIUM_LIMITS = {
  historyDays: Infinity,    // 無期限
  photosPerDay: Infinity,   // 写真は無制限
  storyDays: Infinity,      // ストーリーは無期限
  hourlyGraphPastDays: true, // 過去日の時間帯グラフ可
};

const SubscriptionContext = createContext({
  isPremium: false,
  isLoading: true,
  isInitialized: false,
  trialEligible: true,
  limits: FREE_LIMITS,
  checkSubscription: () => {},
  presentPaywall: () => {},
  restorePurchases: () => {},
});

export function SubscriptionProvider({ children }) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [debugOverride, setDebugOverride] = useState(null); // null = no override, true/false = force value
  const [trialEligible, setTrialEligible] = useState(true);

  // RevenueCat初期化
  useEffect(() => {
    initializePurchases();
  }, []);

  const initializePurchases = async () => {
    try {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

      const apiKey = REVENUECAT_API_KEY;
      if (!apiKey) {
        console.warn('[RevenueCat] API key is not set. Set REVENUECAT_API_KEY in .env / app.config.js');
        setIsInitialized(false);
        setIsLoading(false);
        return;
      }

      await Purchases.configure({ apiKey });

      setIsInitialized(true);
      await checkSubscriptionStatus();
      await checkTrialEligibility();
    } catch (error) {
      console.error('Error initializing RevenueCat:', error);
      setIsLoading(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const hasPremium = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
      setIsPremium(hasPremium);
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkSubscription = useCallback(async () => {
    if (!isInitialized) return;
    setIsLoading(true);
    await checkSubscriptionStatus();
    await checkTrialEligibility();
  }, [isInitialized]);

  // トライアル/イントロ価格の適格性チェック
  const checkTrialEligibility = useCallback(async () => {
    try {
      const eligibilityMap = await Purchases.checkTrialOrIntroductoryPriceEligibility([
        'premium_monthly',
        'premium_yearly',
      ]);
      const eligValues = Object.values(eligibilityMap || {});
      const eligible = eligValues.some((v) => v?.status === INTRO_ELIGIBILITY_STATUS.ELIGIBLE);
      setTrialEligible(eligible);
    } catch (error) {
      console.warn('Error checking trial eligibility:', error);
      setTrialEligible(false);
    }
  }, []);

  // Paywallを表示（ネイティブSwiftUI版）
  const presentPaywall = useCallback(async () => {
    if (!isInitialized) {
      Alert.alert(
        '購入情報が利用できません',
        '課金設定がまだ準備できていません。しばらくしてからお試しください。'
      );
      return false;
    }

    try {
      // iOSの場合はネイティブPaywallを使用
      if (Platform.OS === 'ios' && PaywallModule) {
        try {
          console.log('[RevenueCat] presentPaywall: showing native PaywallModule');
          const result = await PaywallModule.showPaywall(trialEligible === true);
          if (result?.action === 'purchased') {
            await checkSubscriptionStatus();
            return true;
          }
          console.log('[RevenueCat] presentPaywall: native paywall dismissed', result);
          return false;
        } catch (e) {
          console.warn('[RevenueCat] Native paywall failed, falling back to JS purchase flow', e);
          // fallthrough to JS fallback
        }
      }

      // フォールバック: JS側でOfferingを取得して購入ダイアログを出す
      const offerings = await Purchases.getOfferings();
      const packages = offerings?.current?.availablePackages || [];
      if (!packages.length) {
        Alert.alert('Purchase unavailable', '現在購入情報を取得できませんでした。しばらくしてからお試しください。');
        return false;
      }
      const annual = packages.find((p) => p.packageType === 'annual');
      const monthly = packages.find((p) => p.packageType === 'monthly');
      const target = annual || monthly || packages[0];

      const purchaseSelected = async (pkg) => {
        try {
          const { customerInfo } = await Purchases.purchasePackage(pkg);
          const hasPremium = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
          setIsPremium(hasPremium);
          return hasPremium;
        } catch (err) {
          console.warn('Purchase failed', err);
          return false;
        }
      };

      // NOTE: フォールバックでは「自動で購入処理を開始しない」。
      // Appleの購入シートがPaywallより先に出てしまい、UX/審査で不利になるため。
      return await new Promise((resolve) => {
        if (annual && monthly) {
          Alert.alert(
            'プランを選択',
            '',
            [
              {
                text: '年額',
                onPress: async () => resolve(await purchaseSelected(annual)),
              },
              {
                text: '月額',
                onPress: async () => resolve(await purchaseSelected(monthly)),
              },
              { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
            ],
            { cancelable: true }
          );
          return;
        }

        Alert.alert(
          '購入確認',
          'このプランでProを開始しますか？',
          [
            { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
            { text: '購入する', onPress: async () => resolve(await purchaseSelected(target)) },
          ],
          { cancelable: true }
        );
      });
    } catch (error) {
      console.error('Error presenting paywall:', error);
      return false;
    }
  }, [isInitialized, trialEligible]);

  // 購入を復元
  const restorePurchases = useCallback(async () => {
    if (!isInitialized) return false;

    try {
      const customerInfo = await Purchases.restorePurchases();
      const hasPremium = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
      setIsPremium(hasPremium);
      return hasPremium;
    } catch (error) {
      console.error('Error restoring purchases:', error);
      return false;
    }
  }, [isInitialized]);

  // 購入状態の変更をリッスン
  useEffect(() => {
    if (!isInitialized) return;

    const listener = (customerInfo) => {
      const hasPremium = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
      setIsPremium(hasPremium);
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [isInitialized]);

  // デバッグ用: プラン状態を強制的に切り替え
  const setDebugPremium = useCallback((value) => {
    if (__DEV__) {
      setDebugOverride(value);
      console.log('[SubscriptionContext] Debug override set to:', value);
    }
  }, []);

  // 実際のプレミアム状態（デバッグオーバーライド対応）
  const effectivePremium = debugOverride !== null ? debugOverride : isPremium;
  const limits = effectivePremium ? PREMIUM_LIMITS : FREE_LIMITS;

  const value = {
    isPremium: effectivePremium,
    isLoading,
    isInitialized,
    trialEligible,
    limits,
    checkSubscription,
    presentPaywall,
    restorePurchases,
    setDebugPremium,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);

// ヘルパー：日付が制限内かチェック
export const isDateWithinLimit = (date, limitDays) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = today - targetDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays < limitDays;
};
