// 統計ユーティリティ: トロフィー/ストリーク/最大ストリーク

/**
 * その日の目標（保存値）を優先し、なければ既定目標を使う
 */
function getGoalForDay(dayData, defaultGoal) {
  const g = Number(dayData?.goal);
  return Number.isFinite(g) && g > 0 ? g : (defaultGoal || 10000);
}

/**
 * ある日付キー(YYYY-MM-DD)の達成可否を判定
 */
function isAchieved(allData, dateKey, defaultGoal) {
  const rec = allData[dateKey];
  if (!rec) return false;
  const steps = Number(rec.steps || 0);
  const goal = getGoalForDay(rec, defaultGoal);
  return Number.isFinite(steps) && steps >= goal;
}

/**
 * 日付を YYYY-MM-DD にする
 */
function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 現在のトロフィー数/ストリーク/最大ストリークを計算
 * - 現在ストリーク: 今日が達成なら今日を含めて過去へ、未達成なら昨日から過去へ
 */
export function computeTrophiesStreak(allData, defaultGoal = 10000, todayDate = new Date()) {
  // トロフィー（達成日数）
  let totalTrophies = 0;
  for (const [key, rec] of Object.entries(allData || {})) {
    if (isAchieved(allData, key, defaultGoal)) totalTrophies += 1;
  }

  // 現在ストリーク
  const base = new Date(todayDate);
  base.setHours(0, 0, 0, 0);
  const todayKey = toKey(base);
  const todayAchieved = isAchieved(allData, todayKey, defaultGoal);
  if (!todayAchieved) base.setDate(base.getDate() - 1); // 未達成なら昨日から

  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const k = toKey(base);
    if (isAchieved(allData, k, defaultGoal)) {
      currentStreak += 1;
      base.setDate(base.getDate() - 1);
    } else {
      break;
    }
  }

  // 最大ストリーク（全期間）
  const sorted = Object.keys(allData || {}).sort();
  let maxStreak = 0;
  let cur = 0;
  for (const k of sorted) {
    if (isAchieved(allData, k, defaultGoal)) {
      cur += 1;
      if (cur > maxStreak) maxStreak = cur;
    } else {
      cur = 0;
    }
  }

  return { totalTrophies, currentStreak, maxStreak };
}

/**
 * シェア用ストリークを計算（Homeと同じルール）
 * - 選択日が達成ならその日を含めて過去へ、未達成なら前日から
 */
export function computeShareStreak(allData, defaultGoal = 10000, selectedDateKey) {
  if (!selectedDateKey) return 0;
  const cur = new Date(selectedDateKey + 'T00:00:00');
  cur.setHours(0, 0, 0, 0);
  const selKey = toKey(cur);
  const selAchieved = isAchieved(allData, selKey, defaultGoal);
  if (!selAchieved) {
    cur.setDate(cur.getDate() - 1);
  }
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const k = toKey(cur);
    if (isAchieved(allData, k, defaultGoal)) {
      streak += 1;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

