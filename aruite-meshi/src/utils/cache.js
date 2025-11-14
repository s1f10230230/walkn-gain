import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayDateString } from './calculations';

/**
 * キャッシュキー
 */
const CACHE_KEYS = {
  TODAY_DATA: 'cache_today_data',
  LAST_UPDATE: 'cache_last_update',
};

/**
 * 今日のデータをキャッシュに保存
 * @param {Object} data - { steps, calories, distance, date }
 */
export const cacheTodayData = async (data) => {
  try {
    const cacheData = {
      ...data,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(CACHE_KEYS.TODAY_DATA, JSON.stringify(cacheData));
    await AsyncStorage.setItem(CACHE_KEYS.LAST_UPDATE, new Date().toISOString());
  } catch (error) {
    console.error('Failed to cache today data:', error);
  }
};

/**
 * キャッシュから今日のデータを取得
 * @returns {Object|null} - { steps, calories, distance, date, cachedAt } or null
 */
export const getCachedTodayData = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEYS.TODAY_DATA);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const today = getTodayDateString();

    // キャッシュの日付が今日でなければ無効
    if (data.date !== today) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to get cached data:', error);
    return null;
  }
};

/**
 * 最終更新時刻を取得
 * @returns {Date|null}
 */
export const getLastUpdateTime = async () => {
  try {
    const timestamp = await AsyncStorage.getItem(CACHE_KEYS.LAST_UPDATE);
    return timestamp ? new Date(timestamp) : null;
  } catch (error) {
    console.error('Failed to get last update time:', error);
    return null;
  }
};

/**
 * キャッシュが有効かどうか（5分以内）
 * @returns {boolean}
 */
export const isCacheValid = async () => {
  try {
    const lastUpdate = await getLastUpdateTime();
    if (!lastUpdate) return false;

    const now = new Date();
    const diff = now - lastUpdate;
    const FIVE_MINUTES = 5 * 60 * 1000;

    return diff < FIVE_MINUTES;
  } catch (error) {
    return false;
  }
};

/**
 * キャッシュをクリア
 */
export const clearCache = async () => {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.TODAY_DATA);
    await AsyncStorage.removeItem(CACHE_KEYS.LAST_UPDATE);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
};

/**
 * オフライン対応: 最新のキャッシュデータを返す（日付に関わらず）
 * ネットワークエラー時などに使用
 * @returns {Object|null}
 */
export const getLatestCachedData = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEYS.TODAY_DATA);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (error) {
    console.error('Failed to get latest cached data:', error);
    return null;
  }
};
