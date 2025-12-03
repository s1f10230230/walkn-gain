/**
 * Walking DNA - 歩行スタイル分析
 * 過去7日間のデータから6軸のパラメータを算出
 */

import { getHourlyStepsForDate, getDailyData, getSettings } from './storage';
import { toDateKeyLocal } from './calculations';

// パラメータ定義
export const DNA_PARAMS = {
  morning: { key: 'morning', label: '朝型', emoji: '🌅' },
  night: { key: 'night', label: '夜型', emoji: '🌙' },
  burst: { key: 'burst', label: '瞬発', emoji: '⚡' },
  keep: { key: 'keep', label: '継続', emoji: '🔥' },
  weekend: { key: 'weekend', label: '週末', emoji: '🎉' },
  power: { key: 'power', label: 'パワー', emoji: '💪' },
};

// 称号のプレフィックス（1位のパラメータ）
const TITLE_PREFIX = {
  morning: '朝活',
  night: '夜更かし',
  burst: 'スプリント',
  keep: '継続の',
  weekend: '週末',
  power: 'パワフル',
};

// 称号のサフィックス（2位のパラメータ）
const TITLE_SUFFIX = {
  morning: 'モーニング',
  night: 'ナイト',
  burst: 'ランナー',
  keep: 'ウォーカー',
  weekend: 'エンジョイヤー',
  power: 'アスリート',
};

// 称号の説明文
const DESCRIPTIONS = {
  'morning-night': '朝も夜も活動的！昼夜問わず歩くあなたは真のウォーカー',
  'morning-burst': '朝の短時間で集中して歩く効率派',
  'morning-keep': '毎朝コツコツ歩く習慣の達人',
  'morning-weekend': '週末の朝を活かす休日派',
  'morning-power': '朝から全力！エネルギッシュな朝型',
  'night-morning': '朝晩どちらも活動的な24時間ウォーカー',
  'night-burst': '夜の短時間で集中して歩く',
  'night-keep': '毎晩コツコツ歩く夜型の継続派',
  'night-weekend': '週末の夜を満喫する夜遊び派',
  'night-power': '夜も全力！パワフルな夜型',
  'burst-morning': '朝に瞬発力を発揮する集中型',
  'burst-night': '夜に瞬発力を発揮するナイトスプリンター',
  'burst-keep': '毎日短時間で効率よく歩く',
  'burst-weekend': '週末に一気に歩くタイプ',
  'burst-power': '短時間でも高強度！パワースプリンター',
  'keep-morning': '毎朝欠かさず歩く習慣派',
  'keep-night': '毎晩欠かさず歩く習慣派',
  'keep-burst': '毎日短時間でも歩き続ける',
  'keep-weekend': '週末も平日も変わらず継続',
  'keep-power': '高い目標を毎日達成する努力家',
  'weekend-morning': '週末の朝を活用する休日派',
  'weekend-night': '週末の夜を満喫するタイプ',
  'weekend-burst': '週末に一気に歩くスプリンター',
  'weekend-keep': '週末も平日も変わらず継続',
  'weekend-power': '週末に全力を出すタイプ',
  'power-morning': '朝からパワフルに歩く',
  'power-night': '夜もパワフルに歩く',
  'power-burst': '短時間でもパワフル！',
  'power-keep': '毎日高い目標を達成',
  'power-weekend': '週末も全力で歩く',
};

/**
 * 過去7日間のWalking DNAパラメータを計算
 * @returns {Promise<{params: Object, title: string, description: string, hasEnoughData: boolean}>}
 */
export const calculateWalkingDna = async () => {
  try {
    const settings = await getSettings();
    const dailyGoal = settings?.dailyGoal || 10000;

    // 過去7日間の日付キーを生成
    const dateKeys = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dateKeys.push(toDateKeyLocal(date));
    }

    // 各日のデータを取得
    const dailyDataArray = [];
    const hourlyDataArray = [];

    for (const dateKey of dateKeys) {
      const daily = await getDailyData(dateKey);
      const hourly = await getHourlyStepsForDate(dateKey);

      if (daily && daily.steps > 0) {
        dailyDataArray.push({
          date: dateKey,
          steps: daily.steps,
          goal: daily.goal || dailyGoal,
          dayOfWeek: new Date(dateKey).getDay(), // 0=Sun, 6=Sat
        });
      }

      if (hourly && Array.isArray(hourly)) {
        hourlyDataArray.push({
          date: dateKey,
          hourly,
          dayOfWeek: new Date(dateKey).getDay(),
        });
      }
    }

    // 最低3日分のデータが必要
    if (dailyDataArray.length < 3 || hourlyDataArray.length < 3) {
      return {
        params: null,
        title: null,
        description: null,
        hasEnoughData: false,
        dataCount: dailyDataArray.length,
      };
    }

    // 各パラメータを計算
    const params = {
      morning: calculateMorningScore(hourlyDataArray),
      night: calculateNightScore(hourlyDataArray),
      burst: calculateBurstScore(hourlyDataArray),
      keep: calculateKeepScore(dailyDataArray, dailyGoal),
      weekend: calculateWeekendScore(dailyDataArray),
      power: calculatePowerScore(dailyDataArray, dailyGoal),
    };

    // 称号を生成
    const { title, description, firstParam, secondParam } = generateTitle(params);

    return {
      params,
      title,
      description,
      firstParam,
      secondParam,
      hasEnoughData: true,
      dataCount: dailyDataArray.length,
    };
  } catch (error) {
    console.error('[walkingDna] calculateWalkingDna error:', error);
    return {
      params: null,
      title: null,
      description: null,
      hasEnoughData: false,
      dataCount: 0,
    };
  }
};

/**
 * 朝型スコア: 4:00-10:00の歩数 / 1日合計歩数
 */
const calculateMorningScore = (hourlyDataArray) => {
  if (!hourlyDataArray.length) return 0;

  let totalMorningRatio = 0;
  let validDays = 0;

  for (const day of hourlyDataArray) {
    const totalSteps = day.hourly.reduce((sum, h) => sum + h, 0);
    if (totalSteps === 0) continue;

    // 4:00-10:00 (インデックス 4-9)
    const morningSteps = day.hourly.slice(4, 10).reduce((sum, h) => sum + h, 0);
    totalMorningRatio += morningSteps / totalSteps;
    validDays++;
  }

  if (validDays === 0) return 0;

  // 平均比率を0-100にスケール (50%を100として)
  const avgRatio = totalMorningRatio / validDays;
  return Math.min(100, Math.round(avgRatio * 200));
};

/**
 * 夜型スコア: 18:00-28:00(翌4:00)の歩数 / 1日合計歩数
 * 注: 28:00は翌日の4:00なので、現在の実装では18:00-24:00のみ使用
 */
const calculateNightScore = (hourlyDataArray) => {
  if (!hourlyDataArray.length) return 0;

  let totalNightRatio = 0;
  let validDays = 0;

  for (const day of hourlyDataArray) {
    const totalSteps = day.hourly.reduce((sum, h) => sum + h, 0);
    if (totalSteps === 0) continue;

    // 18:00-24:00 (インデックス 18-23)
    const nightSteps = day.hourly.slice(18, 24).reduce((sum, h) => sum + h, 0);
    totalNightRatio += nightSteps / totalSteps;
    validDays++;
  }

  if (validDays === 0) return 0;

  // 平均比率を0-100にスケール (50%を100として)
  const avgRatio = totalNightRatio / validDays;
  return Math.min(100, Math.round(avgRatio * 200));
};

/**
 * 瞬発スコア: 最高時間帯歩数 (5000歩を100として)
 */
const calculateBurstScore = (hourlyDataArray) => {
  if (!hourlyDataArray.length) return 0;

  let maxHourlySteps = 0;

  for (const day of hourlyDataArray) {
    const dayMax = Math.max(...day.hourly);
    if (dayMax > maxHourlySteps) {
      maxHourlySteps = dayMax;
    }
  }

  // 5000歩を100としてスケール
  return Math.min(100, Math.round((maxHourlySteps / 5000) * 100));
};

/**
 * 継続スコア: ゴール達成日数 / 7日
 */
const calculateKeepScore = (dailyDataArray, dailyGoal) => {
  if (!dailyDataArray.length) return 0;

  const achievedDays = dailyDataArray.filter(d => d.steps >= (d.goal || dailyGoal)).length;
  return Math.round((achievedDays / 7) * 100);
};

/**
 * 週末スコア: 週末平均 / 平日平均
 */
const calculateWeekendScore = (dailyDataArray) => {
  if (!dailyDataArray.length) return 50; // データ不足時はニュートラル

  let weekdayTotal = 0, weekdayCount = 0;
  let weekendTotal = 0, weekendCount = 0;

  for (const day of dailyDataArray) {
    if (day.dayOfWeek === 0 || day.dayOfWeek === 6) {
      // 週末
      weekendTotal += day.steps;
      weekendCount++;
    } else {
      // 平日
      weekdayTotal += day.steps;
      weekdayCount++;
    }
  }

  const weekdayAvg = weekdayCount > 0 ? weekdayTotal / weekdayCount : 0;
  const weekendAvg = weekendCount > 0 ? weekendTotal / weekendCount : 0;

  if (weekdayAvg === 0 && weekendAvg === 0) return 50;
  if (weekdayAvg === 0) return 100;
  if (weekendAvg === 0) return 0;

  // 比率を計算 (1.0 = 同じ、2.0 = 週末が2倍)
  const ratio = weekendAvg / weekdayAvg;
  // 1.0を50、2.0を100、0.5を0として変換
  return Math.min(100, Math.max(0, Math.round((ratio - 0.5) * 100)));
};

/**
 * パワースコア: 7日平均歩数 / ゴール目標
 */
const calculatePowerScore = (dailyDataArray, dailyGoal) => {
  if (!dailyDataArray.length) return 0;

  const totalSteps = dailyDataArray.reduce((sum, d) => sum + d.steps, 0);
  const avgSteps = totalSteps / dailyDataArray.length;

  // ゴール目標に対する達成率 (100%を100として)
  return Math.min(100, Math.round((avgSteps / dailyGoal) * 100));
};

/**
 * 上位2つのパラメータから称号を生成
 */
const generateTitle = (params) => {
  // スコアでソート
  const sorted = Object.entries(params)
    .sort((a, b) => b[1] - a[1]);

  const first = sorted[0][0]; // 1位のパラメータキー
  const second = sorted[1][0]; // 2位のパラメータキー

  const title = `${TITLE_PREFIX[first]}${TITLE_SUFFIX[second]}`;
  const descKey = `${first}-${second}`;
  const description = DESCRIPTIONS[descKey] || '独自のウォーキングスタイルを持っています';

  return { title, description, firstParam: first, secondParam: second };
};
