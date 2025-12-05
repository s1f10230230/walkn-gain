import { toDateKeyLocal } from './calculations';
import { getMultipleDaysData, getSettings } from './storage';

const MIN_GOAL = 1000;
const MAX_GOAL = 50000;
const MIN_CAL_GOAL = 200;
const MAX_CAL_GOAL = 2000;
const RECENT_DAYS = 7;
const STREAK_LOOKBACK = 14;
const ACHIEVE_THRESHOLD = 0.95; // 95%達成で合格扱い

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toNumber = (value, fallback = 0) => {
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : fallback;
};

const buildDateKeys = (today, lookback) => {
  const keys = [];
  for (let i = 1; i <= lookback; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    keys.push(toDateKeyLocal(d));
  }
  return keys;
};

const normalizeRecent = (dates, records, fallbackGoal) =>
  dates.map((date, idx) => {
    const rec = records[idx] || {};
    return {
      date,
      steps: toNumber(rec.steps, 0),
      goal: clamp(toNumber(rec.goal, fallbackGoal), MIN_GOAL, MAX_GOAL),
      mood: Number.isFinite(rec.mood) ? rec.mood : null,
    };
  });

const pickDelta = (successRate, mode) => {
  if (successRate >= 0.7) {
    return mode === 'aggressive' ? 0.1 : 0.08;
  }
  if (successRate <= 0.4) {
    return mode === 'aggressive' ? -0.05 : -0.08;
  }
  return 0;
};

const computeStreak = (recent, baseGoal) => {
  let streak = 0;
  for (const day of recent) {
    const target = clamp(day.goal || baseGoal, MIN_GOAL, MAX_GOAL);
    if (day.steps >= target * ACHIEVE_THRESHOLD) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
};

export const computeAdaptivePlan = ({
  settings,
  recent = [],
  todayMood = null,
}) => {
  const mode = settings?.aiMode === 'aggressive' ? 'aggressive' : 'balance';
  const baseGoal = clamp(toNumber(settings?.dailyGoal, 10000), MIN_GOAL, MAX_GOAL);
  const baseCalGoal = Math.min(Math.max(toNumber(settings?.goalCalories, 500), MIN_CAL_GOAL), MAX_CAL_GOAL);
  const useAdaptive = settings?.aiAdaptiveGoal !== false;
  const useRest = settings?.aiRestDays !== false;
  const useMood = settings?.aiUseMood !== false;

  if (!useAdaptive) {
    return {
      recommendedGoal: baseGoal,
      recommendedCalories: baseCalGoal,
      restDay: false,
      reasonCodes: ['adaptive_disabled'],
      debug: { baseGoal, baseCalGoal },
    };
  }

  const recentForRate = recent.slice(0, RECENT_DAYS);
  const achievedDays = recentForRate.filter((d) => d.steps >= clamp(d.goal || baseGoal, MIN_GOAL, MAX_GOAL) * ACHIEVE_THRESHOLD);
  const successRate = recentForRate.length > 0 ? achievedDays.length / recentForRate.length : 0;
  const streak = computeStreak(recent.slice(0, STREAK_LOOKBACK), baseGoal);

  const delta = pickDelta(successRate, mode);
  const raisedGoal = clamp(Math.round(baseGoal * (1 + delta)), MIN_GOAL, MAX_GOAL);

  const lowMood = useMood && todayMood != null && todayMood <= 2;
  const restEligible = useRest && streak >= 3 && (successRate >= 0.7 || lowMood);
  const restDay = restEligible;
  const restAdjustedGoal = restDay ? clamp(Math.round(raisedGoal * 0.85), MIN_GOAL, MAX_GOAL) : raisedGoal;

  const reasonCodes = [];
  if (restDay) reasonCodes.push(lowMood ? 'rest_low_mood' : 'rest_streak');
  if (delta > 0) reasonCodes.push('raise_success');
  if (delta < 0) reasonCodes.push('lower_success');
  if (delta === 0 && !restDay) reasonCodes.push('hold');

  // カロリー目標を歩数変化に合わせてスケーリング（Pro向け）
  // 直近7日の平均歩数と基準歩数の比率で調整（±20%まで）
  const recentAvgSteps = recentForRate.length
    ? Math.round(recentForRate.reduce((s, d) => s + (d.steps || 0), 0) / recentForRate.length)
    : baseGoal;
  const stepRatio = recentAvgSteps > 0 ? recentAvgSteps / baseGoal : 1;
  const calorieScale = clamp(stepRatio, 0.8, 1.2);
  const recommendedCalories = Math.round(
    Math.min(Math.max(baseCalGoal * calorieScale, MIN_CAL_GOAL), MAX_CAL_GOAL)
  );

  return {
    recommendedGoal: restAdjustedGoal,
    recommendedCalories,
    restDay,
    goalDeltaPercent: Math.round(delta * 100),
    reasonCodes,
    mode,
    debug: {
      baseGoal,
      baseCalGoal,
      successRate,
      streak,
      lowMood,
      recentSample: recentForRate.length,
      recentAvgSteps,
      calorieScale,
    },
  };
};

export const generateAdaptivePlanFromStorage = async ({
  today = new Date(),
  lookbackDays = STREAK_LOOKBACK,
} = {}) => {
  const settings = await getSettings();
  const baseGoal = clamp(toNumber(settings?.dailyGoal, 10000), MIN_GOAL, MAX_GOAL);
  const dates = buildDateKeys(today, lookbackDays);
  const records = await getMultipleDaysData(dates);
  const recent = normalizeRecent(dates, records, baseGoal);

  // 当日の気分がある場合は先頭レコードに含まれている想定。最新日を優先。
  const todayMood = recent.length > 0 ? recent[0]?.mood : null;

  return computeAdaptivePlan({
    settings,
    recent,
    todayMood,
  });
};
