// AsyncStorageを使ったデータ保存・取得ユーティリティ
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayDateString, initializeHourlySteps } from './calculations';
import { DEFAULT_FAVORITES } from '../data/foodDatabase';

// ストレージキー
const KEYS = {
  DAILY_DATA: 'daily_data_',
  USER_PROFILE: 'user_profile',
  USER_SETTINGS: 'user_settings',
  FAVORITES: 'favorites',
  CUSTOM_FOODS: 'custom_foods',
  HEALTH_SYNC: 'health_sync_enabled',
  THEME_MODE: 'theme_mode',  // 'light', 'dark', 'auto'
};

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

// ユーザープロフィールの取得
export const getUserProfile = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.USER_PROFILE);
    if (data) {
      return JSON.parse(data);
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
    await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
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
      return JSON.parse(data);
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
    await AsyncStorage.setItem(KEYS.USER_SETTINGS, JSON.stringify(settings));
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
      return JSON.parse(data);
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
    await AsyncStorage.setItem(KEYS.HEALTH_SYNC, JSON.stringify(enabled));
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
