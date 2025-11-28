import { NativeModulesProxy, Platform } from 'expo-modules-core';

console.log('[HealthKitSwift] Platform:', Platform.OS);
console.log('[HealthKitSwift] NativeModulesProxy keys:', Object.keys(NativeModulesProxy || {}));

const HealthKitSwift = Platform.OS === 'ios'
  ? NativeModulesProxy.HealthKitSwift
  : null;

console.log('[HealthKitSwift] Module loaded:', !!HealthKitSwift);

/**
 * HealthKitが利用可能かチェック
 * @returns {Promise<boolean>}
 */
export async function isAvailable() {
  if (!HealthKitSwift) return false;
  try {
    const result = await HealthKitSwift.isAvailable();
    return !!result;
  } catch (e) {
    console.warn('[HealthKitSwift] isAvailable error:', e);
    return false;
  }
}

/**
 * HealthKit権限をリクエスト（5秒タイムアウト付き）
 * @returns {Promise<boolean>}
 */
export async function requestAuthorization() {
  if (!HealthKitSwift) return false;
  try {
    console.log('[HealthKitSwift] requestAuthorization: calling native...');
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => {
        console.warn('[HealthKitSwift] requestAuthorization: TIMEOUT');
        resolve(false);
      }, 5000)
    );
    const authPromise = HealthKitSwift.requestAuthorization();
    const result = await Promise.race([authPromise, timeoutPromise]);
    console.log('[HealthKitSwift] requestAuthorization: result =', result);
    return !!result;
  } catch (e) {
    console.warn('[HealthKitSwift] requestAuthorization error:', e);
    return false;
  }
}

/**
 * 指定日の歩数を取得
 * @param {string} dateString - YYYY-MM-DD形式
 * @returns {Promise<number>}
 */
export async function getStepsForDate(dateString) {
  if (!HealthKitSwift) return 0;
  try {
    return await HealthKitSwift.getStepsForDate(dateString);
  } catch (e) {
    console.warn('[HealthKitSwift] getStepsForDate error:', e);
    return 0;
  }
}

/**
 * 過去N日分の歩数を一括取得（10秒タイムアウト付き）
 * @param {number} days - 取得する日数（デフォルト30日）
 * @returns {Promise<{[date: string]: number}>} - { 'YYYY-MM-DD': steps }
 */
export async function getStepsForDays(days = 30) {
  if (!HealthKitSwift) return {};
  try {
    console.log('[HealthKitSwift] getStepsForDays: calling native...');
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => {
        console.warn('[HealthKitSwift] getStepsForDays: TIMEOUT');
        resolve({});
      }, 10000)
    );
    const dataPromise = HealthKitSwift.getStepsForDays(days);
    const result = await Promise.race([dataPromise, timeoutPromise]);
    console.log('[HealthKitSwift] getStepsForDays: got result');
    return result || {};
  } catch (e) {
    console.warn('[HealthKitSwift] getStepsForDays error:', e);
    return {};
  }
}

/**
 * 今日の歩数を取得
 * @returns {Promise<number>}
 */
export async function getTodaySteps() {
  if (!HealthKitSwift) return 0;
  try {
    return await HealthKitSwift.getTodaySteps();
  } catch (e) {
    console.warn('[HealthKitSwift] getTodaySteps error:', e);
    return 0;
  }
}

/**
 * 指定日の時間帯別歩数を取得
 * @param {string} dateString - YYYY-MM-DD形式
 * @returns {Promise<number[]>} - 24要素の配列（0時〜23時）
 */
export async function getHourlyStepsForDate(dateString) {
  if (!HealthKitSwift) return Array(24).fill(0);
  try {
    return await HealthKitSwift.getHourlyStepsForDate(dateString);
  } catch (e) {
    console.warn('[HealthKitSwift] getHourlyStepsForDate error:', e);
    return Array(24).fill(0);
  }
}

export default {
  isAvailable,
  requestAuthorization,
  getStepsForDate,
  getStepsForDays,
  getTodaySteps,
  getHourlyStepsForDate,
};
