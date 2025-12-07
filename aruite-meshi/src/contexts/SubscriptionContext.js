import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform, NativeModules } from 'react-native';
import Purchases, { LOG_LEVEL, INTRO_ELIGIBILITY_STATUS } from 'react-native-purchases';

const { PaywallModule } = NativeModules;

// RevenueCat API Keys
const REVENUECAT_API_KEY = 'test_tWBFNJDfeUNKREdSXjlYozMcggc';
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

      if (Platform.OS === 'ios') {
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      } else if (Platform.OS === 'android') {
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      }

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
    if (!isInitialized) return false;

    try {
      // iOSの場合はネイティブPaywallを使用
      if (Platform.OS === 'ios' && PaywallModule) {
        const result = await PaywallModule.showPaywall(trialEligible === true);
        if (result?.action === 'purchased') {
          await checkSubscriptionStatus();
          return true;
        }
        return false;
      }

      // Android等のフォールバック（今後対応予定）
      console.warn('Native paywall not available on this platform');
      return false;
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
