import { Pedometer } from 'expo-sensors';
import { calculateCalories, calculateDistance, getTodayDateString } from './calculations';
import { getUserProfile, saveTodayData } from './storage';
import { cacheTodayData } from './cache';

export async function getTodayStepsTotal() {
  const available = await Pedometer.isAvailableAsync().catch(() => false);
  if (!available) return 0;
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date();
  const res = await Pedometer.getStepCountAsync(start, end).catch(() => ({ steps: 0 }));
  return Number(res?.steps || 0);
}

export async function updateTodayDataFromSteps(steps, goal) {
  const prof = await getUserProfile();
  const cal = calculateCalories(steps, prof?.weight || 65);
  const dist = calculateDistance(steps, prof?.stride || 72);
  const payload = {
    date: getTodayDateString(),
    steps,
    calories: cal,
    distance: dist,
    hourlySteps: [],
    goal,
  };
  await saveTodayData(payload).catch(() => {});
  await cacheTodayData(payload).catch(() => {});
  return payload;
}

