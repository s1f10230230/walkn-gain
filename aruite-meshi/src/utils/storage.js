// AsyncStorageを使ったデータ保存・取得ユーティリティ
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayDateString, initializeHourlySteps } from './calculations';
import { DEFAULT_FAVORITES } from '../data/foodDatabase';

// ストレージキー
const KEYS = {
  DAILY_DATA: 'daily_data_',
  HOURLY_STEPS: 'hourly_steps_',
  USER_PROFILE: 'user_profile',
  USER_SETTINGS: 'user_settings',
  FAVORITES: 'favorites',
  CUSTOM_FOODS: 'custom_foods',
  HEALTH_SYNC: 'health_sync_enabled',
  REMINDER_ENABLED: 'reminder_enabled',
  THEME_MODE: 'theme_mode',  // 'light', 'dark', 'auto'
  ONBOARDING_COMPLETE: 'onboarding_complete',
  USER_CITY: 'user_city',  // ユーザーが選択した都市ID
  USE_DEVICE_LOCATION: 'use_device_location',  // デバイスの位置情報を使用するか
  CURRENT_GOAL_LEVEL: 'current_goal_level',  // 現在の目標レベル
  CURRENT_GOAL_LEVEL_DATE: 'current_goal_level_date', // 最終リセット日（YYYY-MM-DD）
  STATS_CACHE: 'stats_cache', // トロフィー・ストリーク計算結果のキャッシュ
};

// 型正規化ユーティリティ
const toBoolean = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return !!v;
};

const toNumber = (v, fallback = 0) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : fallback;
};

const normalizeProfile = (p) => ({
  height: toNumber(p?.height, 170),
  weight: toNumber(p?.weight, 65),
  stride: toNumber(p?.stride, 72),
});

const normalizeSettings = (s) => ({
  dailyGoal: toNumber(s?.dailyGoal, 10000),
  defaultFood: typeof s?.defaultFood === 'string' ? s.defaultFood : 'ramen',
  notifications: toBoolean(s?.notifications),
  unit: typeof s?.unit === 'string' ? s.unit : 'kcal',
  goalCalories: toNumber(s?.goalCalories, 500),
  language: typeof s?.language === 'string' ? s.language : 'auto', // 'auto' | 'ja' | 'en' | 'zh-Hans'
});

// デフォルトのユーザープロフィール
const DEFAULT_PROFILE = {
  height: 170,
  weight: 65,
  stride: 72, // 歩幅（cm）
};

// デフォルトの設定
const DEFAULT_SETTINGS = {
  dailyGoal: 10000,
  defaultFood: 'ramen',
  notifications: true,
  unit: 'kcal', // 'kcal' or 'kJ'
  goalCalories: 500,
  language: 'auto',
};

// 日別データの取得
export const getDailyData = async (dateString) => {
  try {
    const key = KEYS.DAILY_DATA + dateString;
    const data = await AsyncStorage.getItem(key);
    if (data) {
      return JSON.parse(data);
    }
    // データがない場合は初期データを返す
    return {
      date: dateString,
      steps: 0,
      calories: 0,
      distance: 0,
      hourlySteps: initializeHourlySteps(),
      goal: DEFAULT_SETTINGS.dailyGoal,
    };
  } catch (error) {
    console.error('Error getting daily data:', error);
    return null;
  }
};

// 日別データの保存
export const saveDailyData = async (dateString, data) => {
  try {
    const key = KEYS.DAILY_DATA + dateString;
    await AsyncStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error saving daily data:', error);
    return false;
  }
};

// 今日のデータを取得
export const getTodayData = async () => {
  return await getDailyData(getTodayDateString());
};

// 今日のデータを保存
export const saveTodayData = async (data) => {
  return await saveDailyData(getTodayDateString(), data);
};

// 時間帯別歩数の取得/保存（1日分: 配列[24]）
export const getHourlyStepsForDate = async (dateString) => {
  try {
    const key = KEYS.HOURLY_STEPS + dateString;
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    const arr = JSON.parse(data);
    // 正常系: 配列かつ長さ24
    if (Array.isArray(arr) && arr.length === 24) return arr.map((v) => Number(v) || 0);
    return null;
  } catch (e) {
    return null;
  }
};

export const saveHourlyStepsForDate = async (dateString, hourlyArray) => {
  try {
    if (!Array.isArray(hourlyArray) || hourlyArray.length !== 24) return false;
    const key = KEYS.HOURLY_STEPS + dateString;
    await AsyncStorage.setItem(key, JSON.stringify(hourlyArray.map((v) => Number(v) || 0)));
    return true;
  } catch (e) {
    return false;
  }
};

// 複数日のデータを取得
export const getMultipleDaysData = async (dateStrings) => {
  try {
    const promises = dateStrings.map(date => getDailyData(date));
    const results = await Promise.all(promises);
    return results;
  } catch (error) {
    console.error('Error getting multiple days data:', error);
    return [];
  }
};

// すべての日別データの合計歩数を取得（ローカルに保存された範囲）
export const getAllDailyStepsTotal = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    // サポート: 旧キー（例: '@app:daily_data_YYYY-MM-DD'）/ 新キー（'daily_data_YYYY-MM-DD'）の両方を対象
    const dayKeys = (keys || []).filter(
      (k) => typeof k === 'string' && k.includes(KEYS.DAILY_DATA)
    );
    if (dayKeys.length === 0) return 0;
    const pairs = await AsyncStorage.multiGet(dayKeys);
    let sum = 0;
    for (const [, value] of pairs) {
      if (!value) continue;
      try {
        const obj = JSON.parse(value);
        const s = Number(obj?.steps || 0);
        if (Number.isFinite(s)) sum += s;
      } catch (_) {}
    }
    return sum;
  } catch (error) {
    console.error('Error getting all daily steps total:', error);
    return 0;
  }
};

// すべての日別データをオブジェクトとして取得（トロフィー・ストリーク計算用）
export const getAllDailyData = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    // サポート: 旧キー（例: '@app:daily_data_YYYY-MM-DD'）/ 新キー（'daily_data_YYYY-MM-DD'）の両方を対象
    const dayKeys = (keys || []).filter(
      (k) => typeof k === 'string' && k.includes(KEYS.DAILY_DATA)
    );
    if (dayKeys.length === 0) return {};

    const pairs = await AsyncStorage.multiGet(dayKeys);

    const result = {};
    const extractDate = (str) => {
      try {
        const m = String(str).match(/\b(\d{4}-\d{2}-\d{2})\b/);
        return m ? m[1] : null;
      } catch (_) {
        return null;
      }
    };

    for (const [key, value] of pairs) {
      if (!value) continue;
      try {
        const obj = JSON.parse(value);
        // 1) 保存オブジェクト内の日付が信頼できる場合はそれを優先
        let dateKey = typeof obj?.date === 'string' ? extractDate(obj.date) : null;
        // 2) キー名から YYYY-MM-DD を抽出（旧/新プレフィックス混在対応）
        if (!dateKey) dateKey = extractDate(key);
        if (!dateKey) continue; // 判別不能な場合はスキップ

        result[dateKey] = obj;
      } catch (_) {}
    }
    return result;
  } catch (error) {
    console.error('Error getting all daily data:', error);
    return {};
  }
};

// 年間トップ3の歩数日を取得
export const getTop3Days = async () => {
  try {
    const allData = await getAllDailyData();
    const entries = Object.entries(allData)
      .filter(([_, data]) => data && typeof data.steps === 'number' && data.steps > 0)
      .map(([date, data]) => ({ date, steps: data.steps }))
      .sort((a, b) => b.steps - a.steps)
      .slice(0, 3);
    return entries;
  } catch (error) {
    console.error('Error getting top 3 days:', error);
    return [];
  }
};

// ユーザープロフィールの取得
export const getUserProfile = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.USER_PROFILE);
    if (data) {
      return normalizeProfile(JSON.parse(data));
    }
    // 初回起動時はデフォルト値を保存して返す
    await saveUserProfile(DEFAULT_PROFILE);
    return DEFAULT_PROFILE;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return DEFAULT_PROFILE;
  }
};

// ユーザープロフィールの保存
export const saveUserProfile = async (profile) => {
  try {
    await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(normalizeProfile(profile)));
    return true;
  } catch (error) {
    console.error('Error saving user profile:', error);
    return false;
  }
};

// 設定の取得
export const getSettings = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.USER_SETTINGS);
    if (data) {
      return normalizeSettings(JSON.parse(data));
    }
    // 初回起動時はデフォルト値を保存して返す
    await saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error getting settings:', error);
    return DEFAULT_SETTINGS;
  }
};

// 設定の保存
export const saveSettings = async (settings) => {
  try {
    await AsyncStorage.setItem(KEYS.USER_SETTINGS, JSON.stringify(normalizeSettings(settings)));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
};

// お気に入り食べ物の取得
export const getFavorites = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.FAVORITES);
    if (data) {
      return JSON.parse(data);
    }
    // 初回起動時はデフォルト値を保存して返す
    await saveFavorites(DEFAULT_FAVORITES);
    return DEFAULT_FAVORITES;
  } catch (error) {
    console.error('Error getting favorites:', error);
    return DEFAULT_FAVORITES;
  }
};

// お気に入り食べ物の保存
export const saveFavorites = async (favorites) => {
  try {
    await AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
    return true;
  } catch (error) {
    console.error('Error saving favorites:', error);
    return false;
  }
};

// リマインダー通知 有効状態の取得
export const getReminderEnabled = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.REMINDER_ENABLED);
    if (data) {
      return toBoolean(JSON.parse(data));
    }
    return false;
  } catch (error) {
    console.error('Error getting reminder enabled:', error);
    return false;
  }
};

// リマインダー通知 有効状態の保存
export const saveReminderEnabled = async (enabled) => {
  try {
    await AsyncStorage.setItem(KEYS.REMINDER_ENABLED, JSON.stringify(toBoolean(enabled)));
    return true;
  } catch (error) {
    console.error('Error saving reminder enabled:', error);
    return false;
  }
};

// すべてのデータをクリア（開発用）
export const clearAllData = async () => {
  try {
    await AsyncStorage.clear();
    return true;
  } catch (error) {
    console.error('Error clearing all data:', error);
    return false;
  }
};

// データのエクスポート（CSV形式）
export const exportDataAsCSV = async (dateStrings) => {
  try {
    const data = await getMultipleDaysData(dateStrings);
    let csv = '日付,歩数,カロリー,距離\n';
    data.forEach(day => {
      csv += `${day.date},${day.steps},${day.calories.toFixed(1)},${day.distance.toFixed(2)}\n`;
    });
    return csv;
  } catch (error) {
    console.error('Error exporting data:', error);
    return null;
  }
};

// カスタム食べ物の取得
export const getCustomFoods = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.CUSTOM_FOODS);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error getting custom foods:', error);
    return [];
  }
};

// 連続達成日数（ストリーク）を取得
export const getStreakDays = async (dailyGoal = 10000, maxDays = 365) => {
  try {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < maxDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${day}`;
      const rec = await getDailyData(key);
      const steps = Number(rec?.steps || 0);
      if (steps >= dailyGoal) {
        streak += 1;
        continue;
      }
      // break on first miss
      break;
    }
    return streak;
  } catch (e) {
    return 0;
  }
};

// カスタム食べ物の保存
export const saveCustomFoods = async (customFoods) => {
  try {
    await AsyncStorage.setItem(KEYS.CUSTOM_FOODS, JSON.stringify(customFoods));
    return true;
  } catch (error) {
    console.error('Error saving custom foods:', error);
    return false;
  }
};

// カスタム食べ物を追加
export const addCustomFood = async (food) => {
  try {
    const customFoods = await getCustomFoods();
    const newFood = {
      ...food,
      id: `custom_${Date.now()}`,
      isCustom: true,
    };
    customFoods.push(newFood);
    await saveCustomFoods(customFoods);
    return newFood;
  } catch (error) {
    console.error('Error adding custom food:', error);
    return null;
  }
};

// カスタム食べ物を削除
export const deleteCustomFood = async (foodId) => {
  try {
    const customFoods = await getCustomFoods();
    const filtered = customFoods.filter(f => f.id !== foodId);
    await saveCustomFoods(filtered);
    return true;
  } catch (error) {
    console.error('Error deleting custom food:', error);
    return false;
  }
};

// ヘルスケア同期設定の取得
export const getHealthSyncEnabled = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.HEALTH_SYNC);
    if (data) {
      return toBoolean(JSON.parse(data));
    }
    return false;
  } catch (error) {
    console.error('Error getting health sync setting:', error);
    return false;
  }
};

// ヘルスケア同期設定の保存
export const saveHealthSyncEnabled = async (enabled) => {
  try {
    await AsyncStorage.setItem(KEYS.HEALTH_SYNC, JSON.stringify(toBoolean(enabled)));
    return true;
  } catch (error) {
    console.error('Error saving health sync setting:', error);
    return false;
  }
};

// 🌙 テーマモードの取得
export const getThemeMode = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.THEME_MODE);
    if (data) {
      return JSON.parse(data);  // 'light', 'dark', 'auto'
    }
    return 'auto';  // デフォルトは自動（システム設定に従う）
  } catch (error) {
    console.error('Error getting theme mode:', error);
    return 'auto';
  }
};

// 🌙 テーマモードの保存
export const saveThemeMode = async (mode) => {
  try {
    await AsyncStorage.setItem(KEYS.THEME_MODE, JSON.stringify(mode));
    return true;
  } catch (error) {
    console.error('Error saving theme mode:', error);
    return false;
  }
};

// オンボーディング完了フラグの取得
export const getOnboardingComplete = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETE);
    if (data) {
      return toBoolean(JSON.parse(data));
    }
    return false;
  } catch (error) {
    console.error('Error getting onboarding complete:', error);
    return false;
  }
};

// オンボーディング完了フラグの保存
export const saveOnboardingComplete = async (complete) => {
  try {
    await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETE, JSON.stringify(toBoolean(complete)));
    return true;
  } catch (error) {
    console.error('Error saving onboarding complete:', error);
    return false;
  }
};

// ユーザーが選択した都市IDの取得
export const getUserCity = async () => {
  try {
    const value = await AsyncStorage.getItem(KEYS.USER_CITY);
    return value ? JSON.parse(value) : 'tokyo'; // デフォルトは東京
  } catch (error) {
    console.error('Error getting user city:', error);
    return 'tokyo';
  }
};

// ユーザーが選択した都市IDの保存
export const saveUserCity = async (cityId) => {
  try {
    await AsyncStorage.setItem(KEYS.USER_CITY, JSON.stringify(cityId));
    return true;
  } catch (error) {
    console.error('Error saving user city:', error);
    return false;
  }
};

// デバイスの位置情報を使用するかの取得
export const getUseDeviceLocation = async () => {
  try {
    const value = await AsyncStorage.getItem(KEYS.USE_DEVICE_LOCATION);
    return value ? toBoolean(JSON.parse(value)) : false; // デフォルトはfalse
  } catch (error) {
    console.error('Error getting use device location:', error);
    return false;
  }
};

// デバイスの位置情報を使用するかの保存
export const saveUseDeviceLocation = async (enabled) => {
  try {
    await AsyncStorage.setItem(KEYS.USE_DEVICE_LOCATION, JSON.stringify(toBoolean(enabled)));
    return true;
  } catch (error) {
    console.error('Error saving use device location:', error);
    return false;
  }
};

// 現在の目標レベルを取得
export const getCurrentGoalLevel = async () => {
  try {
    const value = await AsyncStorage.getItem(KEYS.CURRENT_GOAL_LEVEL);
    return value ? toNumber(JSON.parse(value), 1) : 1; // デフォルトはレベル1
  } catch (error) {
    console.error('Error getting current goal level:', error);
    return 1;
  }
};

// 現在の目標レベルを保存
export const saveCurrentGoalLevel = async (level) => {
  try {
    await AsyncStorage.setItem(KEYS.CURRENT_GOAL_LEVEL, JSON.stringify(toNumber(level, 1)));
    return true;
  } catch (error) {
    console.error('Error saving current goal level:', error);
    return false;
  }
};

// 目標レベルの最終リセット日 取得
export const getCurrentGoalLevelDate = async () => {
  try {
    const value = await AsyncStorage.getItem(KEYS.CURRENT_GOAL_LEVEL_DATE);
    return value ? JSON.parse(value) : null; // 'YYYY-MM-DD' or null
  } catch (error) {
    console.error('Error getting current goal level date:', error);
    return null;
  }
};

// 目標レベルの最終リセット日 保存
export const saveCurrentGoalLevelDate = async (dateString) => {
  try {
    await AsyncStorage.setItem(KEYS.CURRENT_GOAL_LEVEL_DATE, JSON.stringify(dateString));
    return true;
  } catch (error) {
    console.error('Error saving current goal level date:', error);
    return false;
  }
};

// ========================================
// トロフィー・ストリーク計算結果のキャッシュ
// ========================================

/**
 * 統計キャッシュを取得
 * @returns {Promise<{totalTrophies: number, currentStreak: number, maxStreak: number, lastUpdated: string} | null>}
 */
export const getStatsCache = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STATS_CACHE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error getting stats cache:', error);
    return null;
  }
};

/**
 * 統計キャッシュを保存
 * @param {number} totalTrophies トロフィー総数
 * @param {number} currentStreak 現在のストリーク
 * @param {number} maxStreak 最大ストリーク
 */
export const saveStatsCache = async (totalTrophies, currentStreak, maxStreak) => {
  try {
    const cache = {
      totalTrophies,
      currentStreak,
      maxStreak,
      lastUpdated: new Date().toISOString(),
    };
    await AsyncStorage.setItem(KEYS.STATS_CACHE, JSON.stringify(cache));
    return true;
  } catch (error) {
    console.error('Error saving stats cache:', error);
    return false;
  }
};
