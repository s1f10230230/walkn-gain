// 動的な日次目標（食べ物段階）を生成・取得するユーティリティ
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayDateString } from './calculations';
import { getSettings, getUserProfile, getFavorites } from './storage';
import { FOODS, getFoodById } from '../data/foodDatabase';

const STORAGE_PREFIX = 'DAILY_DYNAMIC_GOALS_'; // 例: DAILY_DYNAMIC_GOALS_2025-11-01

// kcalを見やすい単位に丸め（既定: 50kcal単位）
const roundKcal = (value, step = 50) => {
  return Math.round(value / step) * step;
};

// 指定kcalに近い食べ物を選ぶ（±15%を優先、なければ最も近い）
const pickFoodForCalories = (targetKcal, usedIds = new Set()) => {
  const within = FOODS.filter(f => Math.abs(f.calories - targetKcal) / targetKcal <= 0.15)
    .sort((a, b) => Math.abs(a.calories - targetKcal) - Math.abs(b.calories - targetKcal));
  const pool = within.length ? within : [...FOODS].sort((a, b) => Math.abs(a.calories - targetKcal) - Math.abs(b.calories - targetKcal));
  for (const f of pool) {
    if (!usedIds.has(f.id)) return f;
  }
  return pool[0];
};

// その人の到達可能性に基づいて最終段をキャップ
const capMaxCalories = (proposedMax, dailyGoalSteps, weightKg) => {
  const caloriesFromSteps = (steps) => steps * weightKg * 0.00055;
  const caps = [
    proposedMax,
    caloriesFromSteps(dailyGoalSteps * 2.2), // 目標歩数の約2.2倍相当
    caloriesFromSteps(30000), // 上限セーフティ（3万歩相当）
  ];
  return Math.min(...caps);
};

// 段数を自動決定（軽め: 少段、重め: 多段）
const decideStageCount = (goalCalories) => {
  if (goalCalories <= 350) return 7; // 300kcal想定は7段
  if (goalCalories <= 600) return 9; // 標準は9段（余裕を持たせる）
  return 10; // 重め
};

// 目標リスト生成
export const generateDailyGoals = async () => {
  const settings = await getSettings();
  const profile = await getUserProfile();
  const favorites = await getFavorites();
  const goalCalories = Math.max(50, Number(settings?.goalCalories || 300));
  const dailyGoalSteps = Math.max(1000, Number(settings?.dailyGoal || 10000));
  const weightKg = Math.max(30, Number(profile?.weight || 65));

  const totalCount = decideStageCount(goalCalories);
  // +50刻みの“目標まで”と、“達成後の少し”は+150刻みで拡張
  const startBase = Math.max(150, Math.floor((goalCalories * 0.5) / 50) * 50);
  const EXTRA_POST_COUNT = 2; // 目標達成後に“少し”用意する段数
  const proposedMaxForCap = Math.max(goalCalories * 1.4, goalCalories + 150 * EXTRA_POST_COUNT);
  const maxCalories = roundKcal(capMaxCalories(proposedMaxForCap, dailyGoalSteps, weightKg), 50);

  // まずは目標までを+50で積む（最低4段 or totalCount-2段分は確保）
  const preMin = Math.min(4, Math.max(2, totalCount - 2));
  const targets = [];
  let v = startBase;
  while ((targets.length < preMin) || (v <= goalCalories && targets.length < totalCount)) {
    if (targets.length === 0 || v > targets[targets.length - 1]) {
      targets.push(v);
    }
    v += 50;
  }

  // 残りは+150刻みで“達成後の段”を追加
  while (targets.length < totalCount) {
    const last = targets[targets.length - 1];
    let next = last + 150;
    if (next > maxCalories) {
      next = maxCalories;
    }
    if (next <= last) break; // これ以上増やせない
    // 重複回避
    if (targets[targets.length - 1] !== next) targets.push(next);
    else break;
  }

  // 食べ物割当
  const used = new Set();
  const goals = targets.map((kcal, idx) => {
    const food = pickFoodForCalories(kcal, used) || getFoodById('onigiri');
    used.add(food.id);
    return {
      id: idx + 1,
      food: { id: food.id, name: food.name, emoji: food.emoji, calories: kcal, unit: food.unit },
    };
  });

  return goals;
};

export const getOrCreateTodayGoals = async () => {
  const today = getTodayDateString();
  const key = STORAGE_PREFIX + today;
  try {
    const existing = await AsyncStorage.getItem(key);
    if (existing) {
      return JSON.parse(existing);
    }
  } catch (_) {}

  const goals = await generateDailyGoals();
  try { await AsyncStorage.setItem(key, JSON.stringify(goals)); } catch (_) {}
  return goals;
};

// 指定日のゴールを取得（なければ生成して保存）
export const getOrCreateGoalsForDate = async (date) => {
  try {
    const keyFrom = (d) => {
      if (!d) return getTodayDateString();
      if (typeof d === 'string') return d;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    const key = STORAGE_PREFIX + keyFrom(date);
    const existing = await AsyncStorage.getItem(key);
    if (existing) return JSON.parse(existing);
    const goals = await generateDailyGoals();
    try { await AsyncStorage.setItem(key, JSON.stringify(goals)); } catch (_) {}
    return goals;
  } catch (_) {
    // フォールバック: 今日のゴール
    return await getOrCreateTodayGoals();
  }
};
