// trial.js
// 3日トライアルの状態管理ヘルパー（UI側でバナー/カードの出し分けに使う）

import AsyncStorage from '@react-native-async-storage/async-storage';

const TRIAL_START_KEY = 'trial_started_at_v1';
const TRIAL_LENGTH_DAYS = 3;

const toDateKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * トライアル開始日時を記録（既にあれば上書きしない）
 */
export const ensureTrialStart = async () => {
  try {
    const existing = await AsyncStorage.getItem(TRIAL_START_KEY);
    if (existing) return existing;
    const now = new Date().toISOString();
    await AsyncStorage.setItem(TRIAL_START_KEY, now);
    return now;
  } catch (e) {
    console.warn('[trial] ensureTrialStart failed', e);
    return null;
  }
};

/**
 * トライアル状態を取得
 * @returns {{isActive: boolean, daysElapsed: number, remainingDays: number, stage: number, startDate: string|null}}
 *   stage: 0=Day0, 1=Day1, 2=Day2, 3=Day3(最終日), 4=終了後
 */
export const getTrialState = async () => {
  try {
    const start = await AsyncStorage.getItem(TRIAL_START_KEY);
    if (!start) {
      return { isActive: false, daysElapsed: 0, remainingDays: 0, stage: 4, startDate: null };
    }

    const startDate = new Date(start);
    const startMs = new Date(startDate).setHours(0, 0, 0, 0);
    const todayMs = new Date().setHours(0, 0, 0, 0);
    // 経過日数を日単位で丸める（元のDateを破壊しない）
    const diffMs = todayMs - startMs;
    const daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const remainingDays = Math.max(0, TRIAL_LENGTH_DAYS - 1 - daysElapsed);
    const stage = daysElapsed < TRIAL_LENGTH_DAYS ? Math.max(0, Math.min(daysElapsed, TRIAL_LENGTH_DAYS)) : 4;
    const isActive = daysElapsed < TRIAL_LENGTH_DAYS;

    return {
      isActive,
      daysElapsed,
      remainingDays,
      stage,
      startDate: toDateKey(startDate),
    };
  } catch (e) {
    console.warn('[trial] getTrialState failed', e);
    return { isActive: false, daysElapsed: 0, remainingDays: 0, stage: 4, startDate: null };
  }
};

/**
 * トライアル状態をリセット（デバッグ用）
 */
export const resetTrialState = async () => {
  try {
    await AsyncStorage.removeItem(TRIAL_START_KEY);
  } catch (e) {
    console.warn('[trial] resetTrialState failed', e);
  }
};
