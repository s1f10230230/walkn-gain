import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateCalories, calculateDistance, toDateKeyLocal } from './calculations';
import { getUserProfile, getSettings, saveDailyData } from './storage';

const SEED_FLAG_KEY = 'pedometer_initial_import_v1';

/**
 * 初回のみPedometerで過去N日（デフォルト7日）を取り込み保存
 * 既に取り込み済みなら何もしない
 * @returns {Promise<boolean>} 実際に取り込みを行ったらtrue
 */
export async function seedPastDaysPedometer(days = 7) {
  const imported = await AsyncStorage.getItem(SEED_FLAG_KEY).catch(() => null);
  if (imported) return false;
  const available = await Pedometer.isAvailableAsync().catch(() => false);
  if (!available) {
    await AsyncStorage.setItem(SEED_FLAG_KEY, 'true').catch(() => {});
    return false;
  }
  const prof = await getUserProfile();
  const s = await getSettings();
  const weight = prof?.weight || 65;
  const stride = prof?.stride || 72;
  const dailyGoal = s?.dailyGoal || 10000;
  for (let i = 1; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const start = new Date(d); start.setHours(0,0,0,0);
    const end = new Date(d); end.setHours(23,59,59,999);
    try {
      const res = await Pedometer.getStepCountAsync(start, end);
      const stepsVal = Number(res?.steps || 0);
      if (stepsVal > 0) {
        const dateKey = toDateKeyLocal(d);
        const cal = calculateCalories(stepsVal, weight);
        const dist = calculateDistance(stepsVal, stride);
        await saveDailyData(dateKey, {
          date: dateKey,
          steps: stepsVal,
          calories: cal,
          distance: dist,
          hourlySteps: Array(24).fill(0),
          goal: dailyGoal,
          importedFrom: 'pedometer_seed'
        });
      }
    } catch (_) {}
  }
  await AsyncStorage.setItem(SEED_FLAG_KEY, 'true').catch(() => {});
  return true;
}
