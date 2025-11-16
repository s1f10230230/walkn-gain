import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateCalories, calculateDistance, toDateKeyLocal } from './calculations';
import { getSettings, getUserProfile, saveDailyData, getDailyData, getHealthSyncEnabled } from './storage';
import { getStepsInRange as getPedometerStepsInRange, getTodaySteps as getPedometerTodaySteps } from './pedometer';

let KingstinctHealthKit = null;
try {
  // eslint-disable-next-line global-require
  KingstinctHealthKit = require('@kingstinct/react-native-healthkit');
} catch (error) {
  KingstinctHealthKit = null;
  console.warn('[healthKit] @kingstinct/react-native-healthkit is not installed yet:', error?.message || error);
}

const HISTORICAL_IMPORT_KEY = 'healthkit_historical_import_v2';
const isIOS = Platform.OS === 'ios';

const STEP_TYPE = KingstinctHealthKit?.HKQuantityTypeIdentifier?.stepCount;
const DISTANCE_TYPE = KingstinctHealthKit?.HKQuantityTypeIdentifier?.distanceWalkingRunning;
const ENERGY_TYPE = KingstinctHealthKit?.HKQuantityTypeIdentifier?.activeEnergyBurned;
const STAT_OPTIONS = KingstinctHealthKit?.HKStatisticsOptions;
const CUMULATIVE = STAT_OPTIONS?.cumulativeSum || 'cumulativeSum';
const HKUnit = KingstinctHealthKit?.HKUnit;

const toDateKey = (value) => {
  if (!value) return null;
  try {
    if (typeof value === 'string') {
      return value.split('T')[0];
    }
    if (value instanceof Date) {
      return toDateKeyLocal(value);
    }
    if (typeof value === 'number') {
      return toDateKeyLocal(new Date(value));
    }
    if (value?.toDateString) {
      return toDateKeyLocal(value);
    }
  } catch (_) {}
  return null;
};

const hasModernHealthKit = () => isIOS && KingstinctHealthKit && typeof KingstinctHealthKit.requestAuthorization === 'function';

const readQuantityTypes = () => [STEP_TYPE, DISTANCE_TYPE, ENERGY_TYPE].filter(Boolean);

export const getHealthKitAvailability = () => ({
  available: hasModernHealthKit(),
  stepType: !!STEP_TYPE,
});

export const getHealthKitAuthorizationState = async () => {
  if (!hasModernHealthKit() || !STEP_TYPE) return { available: false, authorized: false };
  if (typeof KingstinctHealthKit.getAuthorizationStatus === 'function') {
    try {
      const status = await KingstinctHealthKit.getAuthorizationStatus(STEP_TYPE);
      return { available: true, authorized: status === 'sharingAuthorized' || status === 'authorized' };
    } catch (error) {
      console.warn('[healthKit] getAuthorizationStatus failed:', error);
    }
  }
  // Fallback: assume authorized only after ensureAuthorized succeeds
  try {
    await ensureAuthorized();
    return { available: true, authorized: true };
  } catch (_) {
    return { available: true, authorized: false };
  }
};

const fetchDailyStepStatistics = async (startDate, endDate) => {
  if (!hasModernHealthKit() || !STEP_TYPE || typeof KingstinctHealthKit.queryStatisticsForQuantity !== 'function') {
    return null;
  }
  const options = {
    quantityType: STEP_TYPE,
    from: startDate,
    to: endDate,
    options: Array.isArray(CUMULATIVE) ? CUMULATIVE : [CUMULATIVE],
    interval: { day: 1 },
  };
  if (HKUnit?.count) {
    try {
      options.unit = HKUnit.count();
    } catch (_) {}
  }
  const results = await KingstinctHealthKit.queryStatisticsForQuantity(options);
  if (!Array.isArray(results)) return null;
  return results.map((entry) => {
    const key = toDateKey(entry.startDate || entry.startTimestamp || entry.date) || toDateKeyLocal(new Date(entry.endDate || Date.now()));
    const steps = Number(entry.sumQuantity ?? entry.quantity ?? entry.value ?? 0) || 0;
    return { date: key, steps };
  });
};

const ensureAuthorized = async () => {
  if (!hasModernHealthKit()) return false;
  const readTypes = readQuantityTypes();
  if (!readTypes.length) return false;
  await KingstinctHealthKit.requestAuthorization({ read: readTypes, share: [] });
  return true;
};

export const initializeHealthKit = async (showAlert = false) => {
  if (!hasModernHealthKit()) {
    if (showAlert) {
      Alert.alert('HealthKit', 'このデバイスではHealthKitを利用できません。');
    }
    return false;
  }
  try {
    await ensureAuthorized();
    return true;
  } catch (error) {
    console.error('[healthKit] initializeHealthKit failed:', error);
    if (showAlert) {
      Alert.alert('HealthKit', '権限を付与できませんでした。設定アプリから許可を確認してください。');
    }
    return false;
  }
};

export const checkHealthKitPermissions = async () => {
  if (!hasModernHealthKit()) {
    console.log('[healthKit] HealthKit is unavailable on this platform.');
    return;
  }
  if (typeof KingstinctHealthKit.getAuthorizationStatus === 'function' && STEP_TYPE) {
    try {
      const status = await KingstinctHealthKit.getAuthorizationStatus(STEP_TYPE);
      console.log('[healthKit] StepCount authorization status:', status);
    } catch (error) {
      console.warn('[healthKit] Unable to read authorization status:', error);
    }
  } else {
    console.log('[healthKit] getAuthorizationStatus is not supported by the current library version.');
  }
};

export const startStepsBackgroundUpdates = async () => {
  if (!hasModernHealthKit() || !STEP_TYPE) return false;
  const enableDelivery = KingstinctHealthKit.enableBackgroundDelivery;
  if (typeof enableDelivery !== 'function') return false;
  try {
    if (enableDelivery.length >= 2) {
      await enableDelivery(STEP_TYPE, 'hourly');
    } else {
      await enableDelivery({
        quantityType: STEP_TYPE,
        frequency: 'hourly',
      });
    }
    return true;
  } catch (error) {
    console.error('[healthKit] Failed to enable background delivery:', error);
    return false;
  }
};

export const stopStepsBackgroundUpdates = async () => {
  if (!hasModernHealthKit() || !STEP_TYPE) return false;
  const disableDelivery = KingstinctHealthKit.disableBackgroundDelivery || KingstinctHealthKit.disableAllBackgroundDelivery;
  if (typeof disableDelivery !== 'function') return false;
  try {
    if (disableDelivery.length >= 1) {
      await disableDelivery(STEP_TYPE);
    } else {
      await disableDelivery();
    }
    return true;
  } catch (error) {
    console.error('[healthKit] Failed to disable background delivery:', error);
    return false;
  }
};

export const getStepsInRange = async (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const healthSyncEnabled = await getHealthSyncEnabled();
  if (hasModernHealthKit() && healthSyncEnabled) {
    try {
      await ensureAuthorized();
      const stats = await fetchDailyStepStatistics(start, end);
      if (stats && stats.length) {
        return stats;
      }
    } catch (error) {
      console.warn('[healthKit] Failed to fetch steps from HealthKit, falling back to pedometer data:', error);
    }
  }
  // fallback: Pedometer
  const pedometer = await getPedometerStepsInRange(start, end);
  if (Array.isArray(pedometer) && pedometer.length) return pedometer;
  // fallback2: storage snapshot per day
  try {
    const cursor = new Date(start);
    const list = [];
    while (cursor <= end) {
      const key = toDateKeyLocal(cursor);
      const stored = await getDailyData(key);
      if (stored) list.push({ date: key, steps: stored.steps || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return list;
  } catch (_) {
    return [];
  }
};

export const getStepsToday = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date();
  const list = await getStepsInRange(today, end);
  const todayKey = toDateKeyLocal(today);
  const record = list.find((item) => item.date === todayKey);
  if (record) return Number(record.steps || 0);
  return getPedometerTodaySteps();
};

export const isHistoricalImportCompleted = async () => {
  try {
    const value = await AsyncStorage.getItem(HISTORICAL_IMPORT_KEY);
    return value === 'true';
  } catch (_) {
    return false;
  }
};

export const markHistoricalImportCompleted = async () => {
  try {
    await AsyncStorage.setItem(HISTORICAL_IMPORT_KEY, 'true');
  } catch (_) {}
};

export const resetHistoricalImport = async () => {
  try {
    await AsyncStorage.removeItem(HISTORICAL_IMPORT_KEY);
  } catch (_) {}
};

export const importHistoricalData = async (daysBack = 30, onProgress = null) => {
  if (!hasModernHealthKit()) {
    return { success: false, importedDays: 0, errors: ['HealthKit unavailable'] };
  }
  try {
    await ensureAuthorized();
  } catch (error) {
    console.error('[healthKit] importHistoricalData authorization failed:', error);
    return { success: false, importedDays: 0, errors: [error.message] };
  }

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);

  let dayList = await getStepsInRange(startDate, endDate);
  const cutoff = toDateKeyLocal(startDate);
  dayList = (dayList || [])
    .filter((entry) => entry?.date && entry.date >= cutoff)
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  if (!dayList.length) {
    return { success: false, importedDays: 0, errors: ['No HealthKit data available'] };
  }

  const settings = await getSettings();
  const profile = await getUserProfile();
  const weight = Number(profile?.weight) || 65;
  const stride = Number(profile?.stride) || 72;
  const goal = Number(settings?.dailyGoal) || 10000;

  let importedCount = 0;
  const errors = [];

  for (let i = 0; i < dayList.length; i += 1) {
    const day = dayList[i];
    const steps = Number(day?.steps || 0);
    if (!day?.date) continue;

    try {
      if (onProgress) onProgress(i + 1, dayList.length);

      const existing = await getDailyData(day.date);
      if (existing?.steps && existing.steps >= steps) {
        continue;
      }

      const calories = Math.round(calculateCalories(steps, weight));
      const distance = calculateDistance(steps, stride);
      const payload = {
        ...(existing || {}),
        date: day.date,
        steps,
        calories,
        distance,
        goal,
        importedFromHealthKit: true,
        importedAt: new Date().toISOString(),
      };
      await saveDailyData(day.date, payload);
      importedCount += 1;
    } catch (error) {
      console.error(`[healthKit] Failed to import ${day.date}:`, error);
      errors.push({ date: day.date, error: error.message });
    }
  }

  if (importedCount > 0) {
    await markHistoricalImportCompleted();
  }

  return {
    success: importedCount > 0,
    importedDays: importedCount,
    totalDays: dayList.length,
    errors,
  };
};

/**
 * HealthKit優先で直近N日を同期し、ストレージを上書きする
 * @param {number} daysBack 何日前まで遡るか
 */
export const syncPastDaysToStorage = async (daysBack = 7) => {
  const healthSyncEnabled = await getHealthSyncEnabled();
  if (!healthSyncEnabled || !hasModernHealthKit()) return { synced: 0, skipped: true };
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);

  try {
    await ensureAuthorized();
    const dayList = await getStepsInRange(startDate, endDate);
    if (!Array.isArray(dayList) || !dayList.length) return { synced: 0, skipped: false };

    const settings = await getSettings();
    const profile = await getUserProfile();
    const weight = Number(profile?.weight) || 65;
    const stride = Number(profile?.stride) || 72;
    const goal = Number(settings?.dailyGoal) || 10000;

    let synced = 0;
    for (const day of dayList) {
      if (!day?.date) continue;
      const steps = Number(day.steps || 0);
      const existing = await getDailyData(day.date);
      // 上書きはHK優先: HK>既存
      if (existing?.steps && existing.steps >= steps) continue;
      const calories = Math.round(calculateCalories(steps, weight));
      const distance = calculateDistance(steps, stride);
      const payload = {
        ...(existing || {}),
        date: day.date,
        steps,
        calories,
        distance,
        goal,
        importedFromHealthKit: true,
        importedAt: new Date().toISOString(),
      };
      await saveDailyData(day.date, payload);
      synced += 1;
    }
    return { synced, skipped: false };
  } catch (error) {
    console.warn('[healthKit] syncPastDaysToStorage failed:', error);
    return { synced: 0, skipped: false, error: error?.message };
  }
};
