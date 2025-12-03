import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateCalories, calculateDistance, toDateKeyLocal } from './calculations';
import { getSettings, getUserProfile, saveDailyData, getDailyData, getHealthSyncEnabled, saveHourlyStepsForDate } from './storage';
import { getStepsInRange as getPedometerStepsInRange, getTodaySteps as getPedometerTodaySteps } from './pedometer';

// Swiftネイティブモジュール（30日分取得に最適化）
let HealthKitSwift = null;
try {
  // eslint-disable-next-line global-require
  HealthKitSwift = require('healthkit-swift');
} catch (error) {
  HealthKitSwift = null;
  console.log('[healthKit] Swift module not available:', error?.message || error);
}

let KingstinctHealthKit = null;
try {
  // eslint-disable-next-line global-require
  KingstinctHealthKit = require('@kingstinct/react-native-healthkit');
} catch (error) {
  KingstinctHealthKit = null;
  console.warn('[healthKit] @kingstinct/react-native-healthkit is not installed yet:', error?.message || error);
}

const HISTORICAL_IMPORT_KEY = 'healthkit_historical_import_v2';
const EXTENDED_IMPORT_KEY = 'healthkit_extended_import_365';
const EXTENDED_IMPORT_PROGRESS_KEY = 'healthkit_extended_import_progress';
const isIOS = Platform.OS === 'ios';

const STEP_TYPE =
  KingstinctHealthKit?.HKQuantityTypeIdentifier?.stepCount ??
  'HKQuantityTypeIdentifierStepCount';  // fallback追加

const DISTANCE_TYPE =
  KingstinctHealthKit?.HKQuantityTypeIdentifier?.distanceWalkingRunning ??
  'HKQuantityTypeIdentifierDistanceWalkingRunning';  // fallback追加

const ENERGY_TYPE =
  KingstinctHealthKit?.HKQuantityTypeIdentifier?.activeEnergyBurned ??
  'HKQuantityTypeIdentifierActiveEnergyBurned';  // fallback追加
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

const normalizeDateKey = (value) => {
  try {
    return toDateKeyLocal(value);
  } catch (_) {
    return null;
  }
};

const hasModernHealthKit = () =>
  isIOS &&
  KingstinctHealthKit &&
  typeof KingstinctHealthKit.requestAuthorization === 'function';

// シミュレーターチェック - HealthKitが物理的に利用可能か確認
const isHealthDataAvailableOnDevice = async () => {
  if (!hasModernHealthKit()) return false;

  try {
    // 同期チェック
    if (typeof KingstinctHealthKit?.isHealthDataAvailable === 'function') {
      try {
        const syncResult = KingstinctHealthKit.isHealthDataAvailable();
        if (!syncResult) return false;
      } catch (_) {
        return false;
      }
    }

    // 非同期チェック（より信頼性が高い）
    if (typeof KingstinctHealthKit?.isHealthDataAvailableAsync === 'function') {
      try {
        const asyncResult = await KingstinctHealthKit.isHealthDataAvailableAsync();
        return !!asyncResult;
      } catch (_) {
        return false;
      }
    }

    // チェック関数がない場合はtrue（実機と仮定）
    return true;
  } catch (_) {
    return false;
  }
};

// STEP_TYPE が null でも HealthKit を初期化できるようにする
const readQuantityTypes = () => {
  const HK = KingstinctHealthKit?.HKQuantityTypeIdentifier;

  // TestFlight で HK が null のことがある
  if (!HK || typeof HK !== 'object') {
    return ['HKQuantityTypeIdentifierStepCount']; // fallback文字列
  }

  const list = [
    HK.stepCount,
    HK.distanceWalkingRunning,
    HK.activeEnergyBurned,
  ].filter(Boolean);

  if (list.length === 0) {
    return [HK.stepCount ?? 'HKQuantityTypeIdentifierStepCount'];
  }

  return list;
};

// HealthKit 利用可否チェックを緩くする
export const getHealthKitAvailability = () => ({
  available: true,   // ← TestFlightで誤判定されるので常にtrue扱い
  stepType: true,   // ← TestFlight で false になるバグ回避
});

export const getHealthKitAuthorizationState = async () => {
  // 1. Swiftモジュールを優先チェック（オンボーディングで使用しているため）
  if (HealthKitSwift && typeof HealthKitSwift.isAvailable === 'function') {
    try {
      const available = await HealthKitSwift.isAvailable();
      if (available) {
        // Swiftモジュールで権限状態を確認
        // isAvailable()がtrueを返す = HealthKitが利用可能
        // 実際の権限状態はストレージのフラグで確認
        const healthSyncEnabled = await getHealthSyncEnabled();
        console.log('[healthKit] getHealthKitAuthorizationState (Swift): available=true, syncEnabled=', healthSyncEnabled);
        return { available: true, authorized: !!healthSyncEnabled };
      }
    } catch (error) {
      console.warn('[healthKit] Swift availability check failed:', error);
    }
  }

  // 2. Kingstinct HealthKitにフォールバック
  if (!hasModernHealthKit()) return { available: false, authorized: false };

  // シミュレーターチェック
  const deviceAvailable = await isHealthDataAvailableOnDevice();
  if (!deviceAvailable) {
    console.log('[healthKit] getHealthKitAuthorizationState: HealthKit not available on this device');
    return { available: false, authorized: false };
  }

  if (typeof KingstinctHealthKit.getAuthorizationStatus === 'function' && STEP_TYPE) {
    try {
      const status = await KingstinctHealthKit.getAuthorizationStatus(STEP_TYPE);
      return { available: true, authorized: status === 'sharingAuthorized' || status === 'authorized' };
    } catch (error) {
      console.warn('[healthKit] getAuthorizationStatus failed:', error);
      return { available: true, authorized: false };
    }
  }

  // fallback: 権限確認できない場合は false
  return { available: true, authorized: false };
};

const fetchDailyStepStatistics = async (startDate, endDate) => {
  if (
    !hasModernHealthKit() ||
    !KingstinctHealthKit ||
    typeof KingstinctHealthKit.queryStatisticsForQuantity !== 'function'
  ) {
    return null;
  }

  const type =
    STEP_TYPE ??
    KingstinctHealthKit?.HKQuantityTypeIdentifier?.stepCount ??
    'HKQuantityTypeIdentifierStepCount';  // 完全なfallback

  const options = {
    quantityType: type,
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
  return results.map((entry, index) => {
    // HealthKitの日付がUTC基準になるケースがあるため、リクエスト開始日 + index日目をローカル日付として採用
    const day = new Date(startDate);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + index);
    const key =
      toDateKeyLocal(day) ||
      toDateKey(entry.startDate || entry.startTimestamp || entry.date) ||
      toDateKeyLocal(new Date(entry.endDate || Date.now()));
    const steps = Number(entry.sumQuantity ?? entry.quantity ?? entry.value ?? 0) || 0;
    return { date: key, steps };
  });
};

// null でも authorize だけ実行できるように修正
const ensureAuthorized = async () => {
  if (!hasModernHealthKit()) return false;

  // シミュレーターチェック
  const deviceAvailable = await isHealthDataAvailableOnDevice();
  if (!deviceAvailable) {
    console.log('[healthKit] ensureAuthorized: HealthKit not available on this device');
    return false;
  }

  let readTypes = readQuantityTypes();

  // 防弾：空配列なら文字列を強制追加
  if (!Array.isArray(readTypes) || readTypes.length === 0) {
    readTypes = ['HKQuantityTypeIdentifierStepCount'];
  }

  try {
    await KingstinctHealthKit.requestAuthorization({
      read: readTypes,
      share: [],
    });
    return true;
  } catch (err) {
    console.warn('[HK] requestAuthorization failed:', err);
    return false;
  }
};

export const initializeHealthKit = async (showAlert = false) => {
  // 1. Swiftモジュールを優先使用（オンボーディングと同じ）
  if (HealthKitSwift && typeof HealthKitSwift.isAvailable === 'function') {
    try {
      const available = await HealthKitSwift.isAvailable();
      console.log('[healthKit] initializeHealthKit: Swift isAvailable=', available);
      if (available) {
        const authorized = await HealthKitSwift.requestAuthorization();
        console.log('[healthKit] initializeHealthKit: Swift authorization=', authorized);
        if (authorized) {
          return true;
        }
        // Swiftで権限取得失敗
        if (showAlert) {
          Alert.alert('HealthKit', '権限を付与できませんでした。設定アプリから許可を確認してください。');
        }
        return false;
      }
    } catch (error) {
      console.warn('[healthKit] initializeHealthKit: Swift module failed:', error);
      // Swiftモジュールが失敗した場合、Kingstinctにフォールバック
    }
  }

  // 2. Kingstinct HealthKitにフォールバック
  if (!hasModernHealthKit()) {
    if (showAlert) {
      Alert.alert('HealthKit', 'このデバイスではHealthKitを利用できません。');
    }
    return false;
  }

  // シミュレーターチェック
  const deviceAvailable = await isHealthDataAvailableOnDevice();
  if (!deviceAvailable) {
    console.log('[healthKit] HealthKit is not available on this device (simulator or unsupported)');
    if (showAlert) {
      Alert.alert('HealthKit', 'このデバイスではヘルスケアデータにアクセスできません。実機でお試しください。');
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
  if (!hasModernHealthKit()) return false;

  const type =
    STEP_TYPE ??
    KingstinctHealthKit?.HKQuantityTypeIdentifier?.stepCount ??
    'HKQuantityTypeIdentifierStepCount';  // 完全なfallback
  const enableDelivery = KingstinctHealthKit.enableBackgroundDelivery;
  if (typeof enableDelivery !== 'function') return false;

  try {
    if (enableDelivery.length >= 2) {
      await enableDelivery(type, 'hourly');
    } else {
      await enableDelivery({
        quantityType: type,
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
  if (!hasModernHealthKit()) return false;

  const type =
    STEP_TYPE ??
    KingstinctHealthKit?.HKQuantityTypeIdentifier?.stepCount ??
    'HKQuantityTypeIdentifierStepCount';  // 完全なfallback
  const disableDelivery = KingstinctHealthKit.disableBackgroundDelivery || KingstinctHealthKit.disableAllBackgroundDelivery;
  if (typeof disableDelivery !== 'function') return false;

  try {
    if (disableDelivery.length >= 1) {
      await disableDelivery(type);
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

  // Pedometer（最新7日程度）と Storage（過去の履歴）をマージして返す
  // Pedometerの方がリアルタイムなので、重複する日付はPedometerを優先

  const dataMap = new Map(); // date -> { date, steps }

  // 1. まずStorageから全期間のデータを取得（過去の履歴）
  try {
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = toDateKeyLocal(cursor);
      const stored = await getDailyData(key);
      if (stored && stored.steps > 0) {
        dataMap.set(key, { date: key, steps: stored.steps || 0 });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  } catch (error) {
    console.warn('[healthKit] getStepsInRange: Storage read failed:', error);
  }

  // 2. Pedometerから最新データを取得（上書きで優先）
  try {
    const pedometer = await getPedometerStepsInRange(start, end);
    if (Array.isArray(pedometer) && pedometer.length) {
      for (const item of pedometer) {
        const dateKey = normalizeDateKey(item?.date);
        if (dateKey && item.steps > 0) {
          // Pedometerのデータで上書き（より正確）
          dataMap.set(dateKey, { date: dateKey, steps: item.steps });
        }
      }
    }
  } catch (error) {
    console.warn('[healthKit] getStepsInRange: Pedometer failed:', error);
  }

  // 3. Mapを配列に変換して日付順にソート
  const result = Array.from(dataMap.values())
    .filter((item) => !!item.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  return result;
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
  // 1. Swiftモジュールを優先使用（30日分一括取得に最適化）
  if (HealthKitSwift && typeof HealthKitSwift.isAvailable === 'function') {
    try {
      const available = await HealthKitSwift.isAvailable();
      if (available) {
        console.log('[healthKit] Using Swift module for historical import');
        const authorized = await HealthKitSwift.requestAuthorization();
        if (authorized) {
          const stepsDict = await HealthKitSwift.getStepsForDays(daysBack);
          if (stepsDict && Object.keys(stepsDict).length > 0) {
            const settings = await getSettings();
            const profile = await getUserProfile();
            const weight = Number(profile?.weight) || 65;
            const stride = Number(profile?.stride) || 72;
            const goal = Number(settings?.dailyGoal) || 10000;

            let importedCount = 0;
            const errors = [];
            const entries = Object.entries(stepsDict).sort((a, b) => a[0].localeCompare(b[0]));

            for (let i = 0; i < entries.length; i += 1) {
              const [dateKey, steps] = entries[i];
              try {
                if (onProgress) onProgress(i + 1, entries.length);

                const existing = await getDailyData(dateKey);
                const shouldUpdateDaily = !existing?.steps || existing.steps < steps;

                // 日別データを更新（歩数が増えた場合のみ）
                if (shouldUpdateDaily) {
                  const calories = Math.round(calculateCalories(steps, weight));
                  const distance = calculateDistance(steps, stride);
                  const payload = {
                    ...(existing || {}),
                    date: dateKey,
                    steps,
                    calories,
                    distance,
                    goal,
                    importedFromHealthKit: true,
                    importedAt: new Date().toISOString(),
                  };
                  await saveDailyData(dateKey, payload);
                }

                // 時間帯別データは常に取得・保存（グラフ表示のため）
                if (HealthKitSwift && typeof HealthKitSwift.getHourlyStepsForDate === 'function') {
                  try {
                    const hourlyData = await HealthKitSwift.getHourlyStepsForDate(dateKey);
                    if (Array.isArray(hourlyData) && hourlyData.length === 24) {
                      await saveHourlyStepsForDate(dateKey, hourlyData.map((v) => Number(v) || 0));
                      console.log(`[healthKit] Swift: Hourly data saved for ${dateKey}`);
                    }
                  } catch (hourlyErr) {
                    console.warn(`[healthKit] Swift: Failed to get hourly for ${dateKey}:`, hourlyErr);
                  }
                }

                importedCount += 1;
              } catch (error) {
                console.error(`[healthKit] Swift: Failed to import ${dateKey}:`, error);
                errors.push({ date: dateKey, error: error.message });
              }
            }

            if (importedCount > 0) {
              await markHistoricalImportCompleted();
            }

            console.log(`[healthKit] Swift import complete: ${importedCount}/${entries.length} days`);
            return {
              success: importedCount > 0,
              importedDays: importedCount,
              totalDays: entries.length,
              errors,
              source: 'swift',
            };
          }
        }
      }
    } catch (swiftError) {
      console.warn('[healthKit] Swift module failed, falling back:', swiftError);
    }
  }

  // 2. フォールバック: Kingstinct HealthKit
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
    source: 'kingstinct',
  };
};

/**
 * HealthKit優先で直近N日を同期し、ストレージを上書きする
 * @param {number} daysBack 何日前まで遡るか
 */
export const syncPastDaysToStorage = async (daysBack = 7) => {
  console.log('[healthKit] syncPastDaysToStorage: START (Pedometer only)');

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);

  let dayList = [];
  let source = 'pedometer';

  // HomeScreenではPedometerのみ使用（HealthKitはオンボーディングで30日分取得済み）
  // Swift/Kingstinctは競合してクラッシュするためスキップ

  // 2. Fallback to Pedometer if HealthKit didn't yield results
  if (dayList.length === 0) {
    try {
      const pedometerData = await getPedometerStepsInRange(startDate, endDate);
      if (Array.isArray(pedometerData) && pedometerData.length > 0) {
        dayList = pedometerData;
        source = 'pedometer';
      }
    } catch (error) {
      console.warn('[healthKit] syncPastDaysToStorage: Pedometer failed', error);
    }
  }

  if (!Array.isArray(dayList) || !dayList.length) return { synced: 0, skipped: false };

  try {
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
      
      // 上書き条件:
      // 1. ソースがSwift/HealthKitなら常に優先 (HK > Existing)
      // 2. ソースがPedometerなら、既存より多ければ更新 (Pedometer > Existing if larger)
      const isHKSource = source === 'healthkit' || source === 'swift';
      if (isHKSource) {
        if (existing?.steps && existing.steps >= steps && existing.importedFromHealthKit) continue;
      } else {
        // Pedometer source
        if (existing?.steps && existing.steps >= steps) continue;
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
        importedFromHealthKit: isHKSource,
        importedAt: new Date().toISOString(),
      };
      await saveDailyData(day.date, payload);
      synced += 1;
    }
    return { synced, skipped: false, source };
  } catch (error) {
    console.warn('[healthKit] syncPastDaysToStorage failed:', error);
    return { synced: 0, skipped: false, error: error?.message };
  }
};

// ========== 拡張インポート（365日分）==========

/**
 * 拡張インポート（365日）が完了しているかチェック
 */
export const isExtendedImportCompleted = async () => {
  try {
    const value = await AsyncStorage.getItem(EXTENDED_IMPORT_KEY);
    return value === 'true';
  } catch (_) {
    return false;
  }
};

/**
 * 拡張インポート完了をマーク
 */
export const markExtendedImportCompleted = async () => {
  try {
    await AsyncStorage.setItem(EXTENDED_IMPORT_KEY, 'true');
  } catch (_) {}
};

/**
 * 拡張インポートの進捗を取得
 * @returns {{ imported: number, total: number, inProgress: boolean }}
 */
export const getExtendedImportProgress = async () => {
  try {
    const value = await AsyncStorage.getItem(EXTENDED_IMPORT_PROGRESS_KEY);
    if (value) {
      return JSON.parse(value);
    }
  } catch (_) {}
  return { imported: 0, total: 335, inProgress: false };
};

/**
 * 拡張インポートの進捗を保存
 */
export const saveExtendedImportProgress = async (imported, total, inProgress) => {
  try {
    await AsyncStorage.setItem(EXTENDED_IMPORT_PROGRESS_KEY, JSON.stringify({
      imported,
      total,
      inProgress,
      lastUpdated: new Date().toISOString(),
    }));
  } catch (_) {}
};

/**
 * 拡張インポート（31日〜365日前のデータ）をバックグラウンドで実行
 * @param {Function} onProgress - 進捗コールバック (imported, total)
 * @returns {Promise<{ success: boolean, importedDays: number, totalDays: number }>}
 */
export const importExtendedHistoricalData = async (onProgress = null) => {
  // 既に完了している場合はスキップ
  const alreadyCompleted = await isExtendedImportCompleted();
  if (alreadyCompleted) {
    console.log('[healthKit] Extended import already completed, skipping');
    return { success: true, importedDays: 0, totalDays: 0, skipped: true };
  }

  // Swiftモジュールがない場合はスキップ
  if (!HealthKitSwift || typeof HealthKitSwift.isAvailable !== 'function') {
    console.log('[healthKit] Swift module not available for extended import');
    return { success: false, importedDays: 0, totalDays: 0, error: 'Swift module not available' };
  }

  try {
    const available = await HealthKitSwift.isAvailable();
    if (!available) {
      return { success: false, importedDays: 0, totalDays: 0, error: 'HealthKit not available' };
    }

    console.log('[healthKit] Starting extended import (31-365 days)');
    await saveExtendedImportProgress(0, 335, true);

    // 365日分のデータを取得
    const stepsDict = await HealthKitSwift.getStepsForDays(365);
    if (!stepsDict || Object.keys(stepsDict).length === 0) {
      await saveExtendedImportProgress(0, 335, false);
      return { success: false, importedDays: 0, totalDays: 0, error: 'No data from HealthKit' };
    }

    const settings = await getSettings();
    const profile = await getUserProfile();
    const weight = Number(profile?.weight) || 65;
    const stride = Number(profile?.stride) || 72;
    const goal = Number(settings?.dailyGoal) || 10000;

    // 日付でソートして、31日目以降のみ処理
    const allEntries = Object.entries(stepsDict).sort((a, b) => a[0].localeCompare(b[0]));

    // 過去30日分はすでにインポート済みなので、31日〜365日前のデータのみ
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30日前
    const cutoffKey = toDateKeyLocal(cutoffDate);

    // 30日より前のデータのみフィルタ
    const extendedEntries = allEntries.filter(([dateKey]) => dateKey < cutoffKey);

    if (extendedEntries.length === 0) {
      console.log('[healthKit] No extended data to import');
      await markExtendedImportCompleted();
      await saveExtendedImportProgress(0, 0, false);
      return { success: true, importedDays: 0, totalDays: 0 };
    }

    let importedCount = 0;
    const totalEntries = extendedEntries.length;

    for (let i = 0; i < extendedEntries.length; i += 1) {
      const [dateKey, steps] = extendedEntries[i];

      try {
        const existing = await getDailyData(dateKey);
        const shouldUpdate = !existing?.steps || existing.steps < steps;

        if (shouldUpdate) {
          const calories = Math.round(calculateCalories(steps, weight));
          const distance = calculateDistance(steps, stride);
          const payload = {
            ...(existing || {}),
            date: dateKey,
            steps,
            calories,
            distance,
            goal,
            importedFromHealthKit: true,
            importedAt: new Date().toISOString(),
          };
          await saveDailyData(dateKey, payload);
        }

        // 時間帯別データも取得・保存
        if (typeof HealthKitSwift.getHourlyStepsForDate === 'function') {
          try {
            const hourlyData = await HealthKitSwift.getHourlyStepsForDate(dateKey);
            if (Array.isArray(hourlyData) && hourlyData.length === 24) {
              await saveHourlyStepsForDate(dateKey, hourlyData.map((v) => Number(v) || 0));
            }
          } catch (_) {}
        }

        importedCount += 1;

        // 進捗を10日ごとに保存（頻繁な保存を避ける）
        if (i % 10 === 0) {
          await saveExtendedImportProgress(importedCount, totalEntries, true);
          if (onProgress) onProgress(importedCount, totalEntries);
        }
      } catch (error) {
        console.warn(`[healthKit] Extended import: Failed to import ${dateKey}:`, error);
      }
    }

    // 完了
    await markExtendedImportCompleted();
    await saveExtendedImportProgress(importedCount, totalEntries, false);

    if (onProgress) onProgress(importedCount, totalEntries);
    console.log(`[healthKit] Extended import complete: ${importedCount}/${totalEntries} days`);

    return {
      success: true,
      importedDays: importedCount,
      totalDays: totalEntries,
    };
  } catch (error) {
    console.error('[healthKit] Extended import failed:', error);
    await saveExtendedImportProgress(0, 335, false);
    return { success: false, importedDays: 0, totalDays: 0, error: error?.message };
  }
};
