import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@subscription_status';

// 無料プランの制限
export const FREE_LIMITS = {
  historyDays: 7,           // 履歴は7日まで
  photosPerDay: 1,          // 写真は1日1枚
  storyDays: 7,             // ストーリーは7日まで
  hourlyGraphPastDays: false, // 過去日の時間帯グラフは不可
};

// プレミアムプランの制限（実質無制限）
export const PREMIUM_LIMITS = {
  historyDays: 365,         // 1年
  photosPerDay: 4,          // 1日4枚
  storyDays: 365,           // 1年
  hourlyGraphPastDays: true, // 過去日の時間帯グラフ可
};

const SubscriptionContext = createContext({
  isPremium: false,
  isLoading: true,
  limits: FREE_LIMITS,
  checkSubscription: () => {},
  // デバッグ用
  setDebugPremium: () => {},
});

export function SubscriptionProvider({ children }) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 起動時に状態を読み込み
  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      // TODO: RevenueCat実装後はここを置き換え
      // const customerInfo = await Purchases.getCustomerInfo();
      // const isPremiumActive = customerInfo.entitlements.active['premium'] !== undefined;

      // 仮実装：AsyncStorageからデバッグ用の状態を読み込み
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { isPremium: storedPremium } = JSON.parse(stored);
        setIsPremium(storedPremium);
      }
    } catch (error) {
      console.error('Error loading subscription status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkSubscription = useCallback(async () => {
    setIsLoading(true);
    await loadSubscriptionStatus();
  }, []);

  // デバッグ用：手動でプレミアム状態を切り替え
  const setDebugPremium = useCallback(async (value) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ isPremium: value }));
      setIsPremium(value);
    } catch (error) {
      console.error('Error setting debug premium:', error);
    }
  }, []);

  const limits = isPremium ? PREMIUM_LIMITS : FREE_LIMITS;

  const value = {
    isPremium,
    isLoading,
    limits,
    checkSubscription,
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
