import AsyncStorage from "@react-native-async-storage/async-storage";
import { toDateKeyLocal } from "./calculations";
import { getDailyData, getSettings } from "./storage";

const SNAPSHOT_START_HOUR = 20; // 20:00以降にスナップショットを保存
const STORAGE_KEYS = {
  SNAPSHOT_DATE: "feedback_snapshot_date",
  SNAPSHOT_STEPS: "feedback_snapshot_steps",
  PREV_DATE: "feedback_prev_date",
  PREV_STEPS: "feedback_prev_steps",
  MESSAGE_DATE: "feedback_message_date",
  MESSAGE_TEXT: "feedback_message_text",
  MESSAGE_VERSION: "feedback_message_version",
  MESSAGE_LOCALE: "feedback_message_locale",
};

const HISTORY_KEY_PREFIX = "feedback_history_";
const buildHistoryKey = (dateKey) => `${HISTORY_KEY_PREFIX}${dateKey}`;

const FEEDBACK_TEMPLATE_VERSION = "v20241118-l10n";
const DEFAULT_LOCALE = "ja";

const RECENT_DAYS = 7;
const TREND_DAYS = 14;
const STREAK_LOOKBACK = 30;
const LOOKBACK_DAYS = Math.max(RECENT_DAYS, TREND_DAYS, STREAK_LOOKBACK);

const randomPick = (arr, avoidValue = null) => {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  let index = Math.floor(Math.random() * arr.length);
  let choice = arr[index] || "";
  let guard = 0;
  while (
    avoidValue != null &&
    arr.length > 1 &&
    choice === avoidValue &&
    guard < 4
  ) {
    index = Math.floor(Math.random() * arr.length);
    choice = arr[index] || "";
    guard += 1;
  }
  return choice || "";
};

const parseNumber = (value) => {
  if (value == null) return null;
  const num = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(num) ? num : null;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const mapToSupportedLocale = (raw) => {
  if (!raw) return DEFAULT_LOCALE;
  const lower = String(raw).toLowerCase();
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("zh")) return "zh-Hans";
  return DEFAULT_LOCALE;
};

const detectFeedbackLocale = () => {
  try {
    const loc = Intl?.DateTimeFormat?.().resolvedOptions().locale;
    return mapToSupportedLocale(loc);
  } catch (_) {
    return DEFAULT_LOCALE;
  }
};

const FEEDBACK_LOCALE_STRINGS = {
  ja: {
    userType: {
      high_performer: [
        "昨日は全体的に歩数が多めでした。落ち着いた勢いがありました。",
        "昨日は昼から夜までしっかり歩いていました。流れが途切れていませんでした。",
        "昨日は目標を超える歩数でした。静かな集中が続いていました。",
      ],
      steady: [
        "昨日は一日の歩数が安定していました。静かな流れでした。",
        "昨日は時間ごとの差が小さめでした。穏やかな一日でした。",
        "昨日はいつも通りのペースでした。落ち着いて過ごせていました。",
      ],
      roller_coaster: [
        "昨日は時間帯によって差が大きめでした。特徴のある動きでした。",
        "昨日は朝ゆっくりで夜に歩きがまとまっていました。強弱が出ていました。",
        "昨日は短時間で歩いたあと静かになっていました。波のある日でした。",
      ],
      low_activity: [
        "昨日は歩数が控えめでした。落ち着いた一日だったようです。",
        "昨日は大きな動きが少なめでした。静かな過ごし方でした。",
        "昨日は控えめな歩き方でした。自然なペースでまとまっていました。",
      ],
      restarting: [
        "昨日は少しずつ歩きが戻ってきていました。柔らかい再開でした。",
        "昨日は控えめながら歩く時間が増えていました。自然に戻りつつありました。",
        "昨日は止まっていた流れがまた出ていました。軽めの復帰でした。",
      ],
    },
    userTypeNeutral: {
      high_performer: [
        "この日は全体的に歩数が多めでした。落ち着いた勢いがありました。",
        "この日は昼から夜までしっかり歩いていました。流れが途切れていませんでした。",
        "この日は目標を超える歩数でした。静かな集中が続いていました。",
      ],
      steady: [
        "この日は一日の歩数が安定していました。静かな流れでした。",
        "この日は時間ごとの差が小さめでした。穏やかな一日でした。",
        "この日は普段通りのペースでした。落ち着いて過ごせていました。",
      ],
      roller_coaster: [
        "この日は時間帯によって差が大きめでした。特徴のある動きでした。",
        "この日は朝ゆっくりで夜に歩きがまとまっていました。強弱が出ていました。",
        "この日は短時間で歩いたあと静かになっていました。波のある日でした。",
      ],
      low_activity: [
        "この日は歩数が控えめでした。落ち着いた過ごし方でした。",
        "この日は大きな動きが少なめでした。静かな配置でした。",
        "この日は控えめな歩き方でした。自然なリズムになっていました。",
      ],
      restarting: [
        "この日は少しずつ歩きが戻ってきていました。柔らかく再開していました。",
        "この日は控えめながら歩く時間が増えていました。自然に戻りつつありました。",
        "この日は止まっていた流れがまた出ていました。軽めの復帰でした。",
      ],
    },
    sub: [
      "一日を通して安定していました。",
      "流れがスムーズに続いていました。",
      "昼と夜で大きな差はありませんでした。",
      "小刻みに歩数が積み重なっていました。",
      "全体のまとまり方が落ち着いていました。",
      "控えめながら整っていました。",
      "歩きと休みのリズムが自然でした。",
      "静かなテンポで進んでいました。",
      "穏やかな配置になっていました。",
      "緩やかな波でまとまっていました。",
    ],
    subNeutral: [
      "一日を通して穏やかに流れていました。",
      "全体のまとまり方が落ち着いていました。",
      "リズムの揺れは小さめでした。",
      "静かなテンポで進んでいました。",
      "空気が柔らかいまま終わっていました。",
      "控えめなペースが続いていました。",
      "歩きと休みの間隔が自然でした。",
      "緩やかな波でまとまっていました。",
    ],
    trend: {
      low_low: ["控えめなペースが続いていました。", "静かな過ごし方でした。"],
      low_mid: ["少し戻ってきた日でした。", "落ち着いた流れで進んでいました。"],
      low_high: ["一気に動きが戻った日でした。", "自然にペースを取り戻していました。"],
      mid_low: ["落ち着いたオフの入り方でした。", "いつもより静かな流れでした。"],
      mid_mid: ["安定したペースが続いていました。", "普段通りのまとまり方でした。"],
      mid_high: ["穏やかに伸びた日でした。", "自然に歩きが増えていました。"],
      high_low: ["しっかり歩いた翌日はゆっくりめでした。", "無理のない切り替えになっていました。"],
      high_mid: ["高めの日のあと少し落ち着いていました。", "静かな変化でまとまっていました。"],
      high_high: ["連続で高めのペースでした。", "落ち着いた集中力が続いていました。"],
    },
    suffix: {
      streak: "連続 {streak}日",
      compareCurrent: "昨日比 {diff}%",
      compareHistorical: "前日比 {diff}%",
      weeklyAverage: "7日平均 {avg}歩",
      stepsUnit: "歩",
      weekPattern: {
        weekend_boost: "週末ブースト型",
        weekday_steady: "平日が安定してる",
      },
      wrapStart: "（",
      wrapEnd: "）",
    },
  },
  en: {
    userType: {
      high_performer: [
        "You had higher steps overall yesterday—steady momentum throughout.",
        "You kept walking steadily from afternoon into night without losing flow.",
        "You were above goal yesterday with calm, focused energy.",
      ],
      steady: [
        "Steps stayed steady through the day yesterday—a calm flow.",
        "Hour-to-hour differences were small; it was a gentle day.",
        "You moved at your usual pace; a relaxed day.",
      ],
      roller_coaster: [
        "Steps swung a lot by time of day yesterday—a distinct pattern.",
        "Slow morning, then clustered steps at night; clear highs and lows.",
        "Short bursts then quiet stretches; a wavy day.",
      ],
      low_activity: [
        "Steps were on the low side yesterday; a quiet day.",
        "Not much movement yesterday; a calm rhythm.",
        "A modest walking day, kept natural.",
      ],
      restarting: [
        "You're easing back into walking; a gentle restart.",
        "Steps were modest but picking up; coming back naturally.",
        "The pause started moving again; a light return.",
      ],
    },
    userTypeNeutral: {
      high_performer: [
        "That day had higher steps overall with steady momentum.",
        "That day kept walking from afternoon into night without losing flow.",
        "That day was above goal with calm, focused energy.",
      ],
      steady: [
        "That day had stable steps throughout—a calm flow.",
        "Differences between times were small; a gentle day.",
        "It followed your usual pace; a relaxed day.",
      ],
      roller_coaster: [
        "That day had big swings by time of day—a distinct pattern.",
        "A slow morning then steps gathered at night; clear highs and lows.",
        "Short bursts then quiet stretches; a wavy day.",
      ],
      low_activity: [
        "Steps were modest that day; a quiet way to spend it.",
        "Not much movement that day; a calm layout.",
        "A restrained walking day with a natural rhythm.",
      ],
      restarting: [
        "That day eased back into walking; a soft restart.",
        "Steps were modest but increasing; coming back naturally.",
        "The paused rhythm moved again; a light return.",
      ],
    },
    sub: [
      "Stayed steady through the day.",
      "Flow kept running smoothly.",
      "No big gaps between day and night.",
      "Steps stacked up in small bursts.",
      "Overall pace felt calm.",
      "Low-key but organized.",
      "Natural rhythm of walk and rest.",
      "Moved at a quiet tempo.",
      "Gently balanced layout.",
      "Soft waves across the day.",
    ],
    subNeutral: [
      "That day stayed steady throughout.",
      "The flow stayed smooth.",
      "Not much swing between day and night.",
      "Steps built up in small bursts.",
      "The overall feel was calm.",
      "Low-key but organized.",
      "Natural spacing between walking and rest.",
      "Soft waves across the day.",
    ],
    trend: {
      low_low: ["Kept a modest pace.", "A quiet way to spend the day."],
      low_mid: ["Steps picked up a bit.", "Moved forward with a calm flow."],
      low_high: ["Steps came back quickly.", "Found the pace again naturally."],
      mid_low: ["Eased into a rest day.", "Quieter flow than usual."],
      mid_mid: ["Pace stayed steady.", "Matched your usual rhythm."],
      mid_high: ["Gently lifted the pace.", "Steps increased naturally."],
      high_low: ["After a high day you slowed down.", "The switch stayed easy on the body."],
      high_mid: ["Cooled off a bit after a high day.", "Finished with a calm change."],
      high_high: ["Kept a higher pace back-to-back.", "Calm focus continued."],
    },
    suffix: {
      streak: "{streak}-day streak",
      compareCurrent: "vs yesterday {diff}%",
      compareHistorical: "vs prior day {diff}%",
      weeklyAverage: "7-day avg {avg} {unit}",
      stepsUnit: "steps",
      weekPattern: {
        weekend_boost: "Weekend boost",
        weekday_steady: "Steady on weekdays",
      },
      wrapStart: "(",
      wrapEnd: ")",
    },
  },
  "zh-Hans": {
    userType: {
      high_performer: [
        "昨天整体步数偏高，保持着沉稳的劲头。",
        "昨天从下午到晚上都稳稳在走，节奏没有断。",
        "昨天步数超过目标，持续着安静的专注。",
      ],
      steady: [
        "昨天一整天步数都很平稳，节奏柔和。",
        "昨天各时间段差距很小，是温和的一天。",
        "昨天和惯常的节奏差不多，过得很放松。",
      ],
      roller_coaster: [
        "昨天不同时间段差距大，步数有起伏。",
        "昨天早上慢、晚上集中在走，高低落差明显。",
        "昨天是短时间走一阵又安静一阵的波浪感。",
      ],
      low_activity: [
        "昨天步数偏少，是安静的一天。",
        "昨天动作不多，节奏很平静。",
        "昨天走得比较克制，自然的速度。",
      ],
      restarting: [
        "昨天开始慢慢回到步行，柔和的复归。",
        "步数不多但在回升，自然地回来。",
        "停下的节奏又动起来了，轻盈的回归。",
      ],
    },
    userTypeNeutral: {
      high_performer: [
        "那天整体步数偏高，保持着沉稳的劲头。",
        "那天从下午到晚上都稳稳在走，节奏没有断。",
        "那天步数超过目标，持续着安静的专注。",
      ],
      steady: [
        "那天一整天步数都很平稳，节奏柔和。",
        "那天各时间段差距很小，是温和的一天。",
        "那天和惯常的节奏差不多，过得很放松。",
      ],
      roller_coaster: [
        "那天不同时间段差距大，步数有起伏。",
        "那天早上慢、晚上集中在走，高低落差明显。",
        "那天是短时间走一阵又安静一阵的波浪感。",
      ],
      low_activity: [
        "那天步数偏少，是安静的度过方式。",
        "那天动作不多，节奏很平静。",
        "那天走得比较克制，节奏很自然。",
      ],
      restarting: [
        "那天开始慢慢回到步行，柔和地重启。",
        "步数不多但在回升，自然地回来。",
        "停下的节奏又动起来了，轻盈的回归。",
      ],
    },
    sub: [
      "一整天都很稳定。",
      "节奏顺滑地持续着。",
      "白天和夜里差别不大。",
      "步数一小段一小段地累积。",
      "整体的收束很平稳。",
      "克制但有条理。",
      "走和休息的节奏很自然。",
      "以安静的速度推进。",
      "布局很温和。",
      "是缓和的波浪感。",
    ],
    subNeutral: [
      "那天整体都很平稳。",
      "节奏保持顺滑。",
      "昼夜之间几乎没波动。",
      "步数一小段一小段地累积。",
      "整体感觉很柔和。",
      "低调但有条理。",
      "走与休的间隔很自然。",
      "是柔和的波形。",
    ],
    trend: {
      low_low: ["保持着克制的步调。", "度过了安静的一天。"],
      low_mid: ["步数有些回升。", "在平稳的节奏里前进。"],
      low_high: ["步数一下子回来了。", "自然地找回了节奏。"],
      mid_low: ["温和地进入了休息。", "比平时更安静的流动。"],
      mid_mid: ["节奏保持稳定。", "和往常一样的聚合感。"],
      mid_high: ["温和地拉升的一天。", "步行自然变多。"],
      high_low: ["高步数之后的放慢。", "切换得不勉强。"],
      high_mid: ["高日之后稍微沉静了一点。", "以平静的变化收束。"],
      high_high: ["连续保持较高的步调。", "沉稳的专注在持续。"],
    },
    suffix: {
      streak: "连续 {streak} 天",
      compareCurrent: "与昨天相比 {diff}%",
      compareHistorical: "与前一日相比 {diff}%",
      weeklyAverage: "7日均 {avg}{unit}",
      stepsUnit: "步",
      weekPattern: {
        weekend_boost: "周末集中型",
        weekday_steady: "平日更稳定",
      },
      wrapStart: "（",
      wrapEnd: "）",
    },
  },
};

const getLocaleStrings = (locale) =>
  FEEDBACK_LOCALE_STRINGS[locale] || FEEDBACK_LOCALE_STRINGS[DEFAULT_LOCALE];

const formatTemplate = (template, params = {}) => {
  if (!template || typeof template !== "string") return "";
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] != null ? String(params[key]) : ""
  );
};

const resolveFeedbackLocale = async () => {
  try {
    const settings = await getSettings();
    const raw =
      settings?.language && settings.language !== "auto"
        ? settings.language
        : detectFeedbackLocale();
    return mapToSupportedLocale(raw);
  } catch (_) {
    return DEFAULT_LOCALE;
  }
};

const parseDateKeyToDate = (dateKey) => {
  if (!dateKey || typeof dateKey !== "string") return null;
  const parts = dateKey.split("-").map((v) => Number(v));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
};

const parseStoredHistory = (raw) => {
  if (!raw) return { locale: null, message: "" };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.message === "string") {
      return { locale: parsed.locale || null, message: parsed.message };
    }
  } catch (_) {
    // stored as plain string, fall through
  }
  return { locale: null, message: raw };
};

const getGoalValue = (maybeGoal, fallback) => {
  const parsed = Number(maybeGoal);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const lastTemplateUsage = {
  main: { current: "", historical: "" },
  sub: { current: "", historical: "" },
};

const classifyRateBucket = (rate) => {
  if (!Number.isFinite(rate) || rate < 0) return "low";
  if (rate < 0.4) return "low";
  if (rate < 0.95) return "mid";
  return "high";
};

const buildSuffix = (
  { streak, diffPercent, weeklyAverageSteps, weekPatternLabel },
  tone = "current",
  localeStrings = getLocaleStrings(DEFAULT_LOCALE)
) => {
  const suffixStrings =
    localeStrings?.suffix || FEEDBACK_LOCALE_STRINGS[DEFAULT_LOCALE].suffix;
  const wrapStart = suffixStrings.wrapStart || "(";
  const wrapEnd = suffixStrings.wrapEnd || ")";
  const parts = [];
  if (typeof streak === "number" && streak > 0) {
    parts.push(formatTemplate(suffixStrings.streak, { streak }));
  }
  if (Number.isFinite(diffPercent) && Math.abs(diffPercent) >= 5) {
    const sign = diffPercent > 0 ? "+" : "";
    const diffVal = `${sign}${Math.abs(diffPercent)}`;
    const template =
      tone === "historical"
        ? suffixStrings.compareHistorical
        : suffixStrings.compareCurrent;
    parts.push(formatTemplate(template, { diff: diffVal }));
  }
  if (
    Number.isFinite(weeklyAverageSteps) &&
    weeklyAverageSteps > 0 &&
    parts.length < 3
  ) {
    parts.push(
      formatTemplate(suffixStrings.weeklyAverage, {
        avg: formatNumber(weeklyAverageSteps),
        unit: suffixStrings.stepsUnit || "",
      }).trim()
    );
  }
  if (weekPatternLabel && parts.length < 3) {
    const label = suffixStrings.weekPattern?.[weekPatternLabel];
    if (label) parts.push(label);
  }
  if (!parts.length) return "";
  const limited = parts.slice(0, 3);
  return `${wrapStart}${limited.join(" / ")}${wrapEnd}`;
};

const buildFeedbackMessage = (
  stats,
  tone = "current",
  locale = DEFAULT_LOCALE
) => {
  const localeStrings = getLocaleStrings(locale);
  const trendPool = localeStrings?.trend || {};
  if (stats?.trendKey && trendPool[stats.trendKey]) {
    const trendLines = trendPool[stats.trendKey];
    const core = trendLines.join("\n");
    const suffix = buildSuffix(stats, tone, localeStrings);
    return suffix ? `${core}\n${suffix}` : core;
  }
  const basePool =
    tone === "historical"
      ? localeStrings.userTypeNeutral
      : localeStrings.userType;
  const subPool =
    tone === "historical" ? localeStrings.subNeutral : localeStrings.sub;
  const pool = basePool?.[stats.userType] || basePool?.steady || [];
  const lastMain = lastTemplateUsage.main[tone] || "";
  const lastSub = lastTemplateUsage.sub[tone] || "";
  const main = randomPick(pool, lastMain);
  const sub = randomPick(subPool, lastSub);
  lastTemplateUsage.main[tone] = main || lastMain;
  lastTemplateUsage.sub[tone] = sub || lastSub;
  const lines = [main, sub].filter(Boolean);
  const core = lines.join("\n");
  const suffix = buildSuffix(stats, tone, localeStrings);
  return suffix ? `${core}\n${suffix}` : core;
};

const createDateDescriptors = (days, offset = 1, baseDate = new Date()) => {
  const list = [];
  const cursor = new Date(baseDate);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - offset);
  for (let i = 0; i < days; i++) {
    const clone = new Date(cursor);
    list.push({
      dateKey: toDateKeyLocal(clone),
      dayOfWeek: clone.getDay(),
    });
    cursor.setDate(cursor.getDate() - 1);
  }
  return list;
};

const analyzeVolatility = (rates) => {
  if (!rates || rates.length <= 1) {
    return { averageDiff: 0, maxSwing: 0 };
  }
  let sum = 0;
  let maxSwing = 0;
  for (let i = 1; i < rates.length; i++) {
    const diff = Math.abs(rates[i] - rates[i - 1]);
    sum += diff;
    if (diff > maxSwing) maxSwing = diff;
  }
  return {
    averageDiff: sum / (rates.length - 1),
    maxSwing,
  };
};

const countConsecutiveLowDays = (rates, threshold = 0.2) => {
  if (!rates || rates.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < rates.length; i++) {
    if (rates[i] <= threshold) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
};

const analyzeWeekPattern = (records) => {
  if (!records || !records.length) return null;
  let weekdaySum = 0;
  let weekdayCount = 0;
  let weekendSum = 0;
  let weekendCount = 0;
  records.forEach((rec) => {
    if (rec.dayOfWeek === 0 || rec.dayOfWeek === 6) {
      weekendSum += rec.steps;
      weekendCount += 1;
    } else {
      weekdaySum += rec.steps;
      weekdayCount += 1;
    }
  });
  const weekdayAvg = weekdayCount ? weekdaySum / weekdayCount : 0;
  const weekendAvg = weekendCount ? weekendSum / weekendCount : 0;
  if (!weekdayAvg && !weekendAvg) return null;
  if (!weekdayAvg && weekendAvg) return "weekend_boost";
  if (weekdayAvg && !weekendAvg) return "weekday_steady";
  if (weekendAvg >= weekdayAvg * 1.25) return "weekend_boost";
  if (weekdayAvg >= weekendAvg * 1.25) return "weekday_steady";
  return null;
};

const computeStreakFromRecords = (records) => {
  if (!records || !records.length) return 0;
  let streak = 0;
  for (const rec of records) {
    const goal = Number(rec.goal) > 0 ? Number(rec.goal) : 0;
    if (goal > 0 && rec.steps >= goal) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
};

const classifyUserType = ({
  averageRate,
  lowRatio,
  streak,
  volatility,
  maxSwing,
  recentLowStreak,
  latestRate,
  weeklyAverageSteps,
  goalReference,
}) => {
  const baseGoal =
    Number(goalReference) > 0 ? Number(goalReference) : 10000;
  const highVolume = weeklyAverageSteps >= baseGoal * 0.9;
  const isHigh =
    (averageRate >= 1.05 && highVolume) || (streak >= 3 && highVolume);
  const isRestarting = latestRate >= 0.5 && recentLowStreak >= 3;
  const isLow =
    lowRatio >= 0.6 || weeklyAverageSteps <= baseGoal * 0.4;
  const isRoller = maxSwing >= 1.4 || volatility >= 0.5;
  if (isHigh) return "high_performer";
  if (isRestarting) return "restarting";
  if (isLow) return "low_activity";
  if (isRoller) return "roller_coaster";
  return "steady";
};

const loadHistoricalRecords = async (
  fallbackGoal,
  anchorDate = new Date(),
  offset = 1
) => {
  const descriptors = createDateDescriptors(LOOKBACK_DAYS, offset, anchorDate);
  if (!descriptors.length) return [];
  const rawData = await Promise.all(
    descriptors.map((desc) => getDailyData(desc.dateKey))
  );
  return descriptors.map((desc, index) => {
    const data = rawData[index] || {};
    return {
      ...desc,
      steps: Number(data?.steps || 0),
      goal: getGoalValue(data?.goal, fallbackGoal),
    };
  });
};

const getSnapshot = async () => {
  const entries = await AsyncStorage.multiGet([
    STORAGE_KEYS.SNAPSHOT_DATE,
    STORAGE_KEYS.SNAPSHOT_STEPS,
  ]);
  const date = entries?.[0]?.[1] || null;
  const stepsValue = entries?.[1]?.[1] || null;
  const steps = stepsValue != null ? parseNumber(JSON.parse(stepsValue)) : null;
  return { date, steps };
};

const getPrevSnapshot = async () => {
  const entries = await AsyncStorage.multiGet([
    STORAGE_KEYS.PREV_DATE,
    STORAGE_KEYS.PREV_STEPS,
  ]);
  const date = entries?.[0]?.[1] || null;
  const stepsValue = entries?.[1]?.[1] || null;
  const steps = stepsValue != null ? parseNumber(JSON.parse(stepsValue)) : null;
  return { date, steps };
};

export const maybeSaveFeedbackSnapshot = async (steps, now = new Date()) => {
  if (!Number.isFinite(steps)) return false;
  const hour = now.getHours();
  if (hour < SNAPSHOT_START_HOUR) return false;

  const todayKey = toDateKeyLocal(now);
  const { date: storedDate, steps: storedSteps } = await getSnapshot();

  if (storedDate === todayKey) {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SNAPSHOT_STEPS,
      JSON.stringify(steps)
    );
    return true;
  }

  if (storedDate && storedSteps != null) {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.PREV_DATE, storedDate],
      [STORAGE_KEYS.PREV_STEPS, JSON.stringify(storedSteps)],
    ]);
  }

  await AsyncStorage.multiSet([
    [STORAGE_KEYS.SNAPSHOT_DATE, todayKey],
    [STORAGE_KEYS.SNAPSHOT_STEPS, JSON.stringify(steps)],
  ]);
  return true;
};

const getSnapshotStepsForDate = async (targetDate) => {
  const { date, steps } = await getSnapshot();
  if (date === targetDate && typeof steps === "number") {
    return steps;
  }
  return null;
};

const getPrevStepsForDate = async (targetDate) => {
  const { date, steps } = await getPrevSnapshot();
  if (date === targetDate && typeof steps === "number") {
    return steps;
  }
  return null;
};

const gatherFeedbackStats = async (
  { anchorDate = new Date(), offset = 1 } = {}
) => {
  const settings = await getSettings();
  const baseGoal =
    Number(settings?.dailyGoal) > 0 ? Number(settings.dailyGoal) : 10000;
  const anchorKey = toDateKeyLocal(anchorDate);
  const anchorData = await getDailyData(anchorKey);
  const anchorGoal = getGoalValue(anchorData?.goal, baseGoal);

  const records = await loadHistoricalRecords(baseGoal, anchorDate, offset);
  if (!records.length) return null;

  const weeklyRecords = records.slice(0, RECENT_DAYS);
  if (!weeklyRecords.length) return null;

  const freqRecords = records.slice(0, TREND_DAYS);
  const streakRecords = records.slice(0, STREAK_LOOKBACK);

  const yesterdayKey = weeklyRecords[0]?.dateKey;
  if (yesterdayKey) {
    const snapshotSteps = await getSnapshotStepsForDate(yesterdayKey);
    if (Number.isFinite(snapshotSteps)) {
      weeklyRecords[0].steps = snapshotSteps;
      records[0].steps = snapshotSteps;
      if (freqRecords[0]) freqRecords[0].steps = snapshotSteps;
      if (streakRecords[0]) streakRecords[0].steps = snapshotSteps;
    }
  }

  const dayBeforeKey = weeklyRecords[1]?.dateKey;
  if (dayBeforeKey) {
    const prevSteps = await getPrevStepsForDate(dayBeforeKey);
    if (Number.isFinite(prevSteps)) {
      weeklyRecords[1].steps = prevSteps;
      if (records[1]) records[1].steps = prevSteps;
      if (freqRecords[1]) freqRecords[1].steps = prevSteps;
      if (streakRecords[1]) streakRecords[1].steps = prevSteps;
    }
  }

  const targetSteps = weeklyRecords[0]?.steps || 0;
  const prevSteps = weeklyRecords[1]?.steps || 0;
  const targetGoal =
    Number(weeklyRecords[0]?.goal) > 0
      ? Number(weeklyRecords[0]?.goal)
      : anchorGoal || baseGoal;
  const prevGoal =
    Number(weeklyRecords[1]?.goal) > 0
      ? Number(weeklyRecords[1]?.goal)
      : anchorGoal || baseGoal;
  const currRate = targetGoal > 0 ? targetSteps / targetGoal : 0;
  const prevRate = prevGoal > 0 ? prevSteps / prevGoal : 0;
  const diffPercent =
    prevSteps > 0
      ? clamp(
          Math.round(((targetSteps - prevSteps) / prevSteps) * 100),
          -100,
          300
        )
      : null;
  const prevClass = classifyRateBucket(prevRate);
  const currClass = classifyRateBucket(currRate);
  const trendKey =
    prevClass && currClass ? `${prevClass}_${currClass}` : null;
  const rates = weeklyRecords.map((rec) => {
    const goal =
      Number(rec.goal) > 0 ? Number(rec.goal) : anchorGoal || baseGoal;
    return goal > 0 ? rec.steps / goal : 0;
  });
  const averageRate =
    rates.reduce((sum, rate) => sum + rate, 0) / (rates.length || 1);
  const lowRatio =
    rates.length > 0
      ? rates.filter((rate) => rate <= 0.5).length / rates.length
      : 0;
  const volatility = analyzeVolatility(rates);
  const recentLowStreak = countConsecutiveLowDays(rates);
  const weeklyAverageSteps =
    weeklyRecords.length > 0
      ? Math.round(
          weeklyRecords.reduce((sum, rec) => sum + rec.steps, 0) /
            weeklyRecords.length
        )
      : 0;
  const streak = computeStreakFromRecords(streakRecords);
  const weekPatternLabel = analyzeWeekPattern(freqRecords);
  const userType = classifyUserType({
    averageRate,
    lowRatio,
    streak,
    volatility: volatility.averageDiff,
    maxSwing: volatility.maxSwing,
    recentLowStreak,
    latestRate: currRate,
    weeklyAverageSteps,
    goalReference: targetGoal,
  });
  return {
    userType,
    diffPercent,
    streak,
    weeklyAverageSteps,
    weekPatternLabel,
    targetDateKey: weeklyRecords[0]?.dateKey || null,
    trendKey,
  };
};

export const getDailyFeedbackMessage = async () => {
  try {
    const locale = await resolveFeedbackLocale();
    const todayKey = toDateKeyLocal(new Date());
    const stored = await AsyncStorage.multiGet([
      STORAGE_KEYS.MESSAGE_DATE,
      STORAGE_KEYS.MESSAGE_TEXT,
      STORAGE_KEYS.MESSAGE_VERSION,
      STORAGE_KEYS.MESSAGE_LOCALE,
    ]);
    const storedDate = stored?.[0]?.[1];
    const storedMessage = stored?.[1]?.[1];
    const storedVersion = stored?.[2]?.[1];
    const storedLocale = stored?.[3]?.[1];
    if (
      storedDate === todayKey &&
      storedMessage &&
      storedVersion === FEEDBACK_TEMPLATE_VERSION &&
      storedLocale === locale
    ) {
      return storedMessage;
    }

    const stats = await gatherFeedbackStats();
    if (!stats) return "";

    const message = buildFeedbackMessage(stats, "current", locale);
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.MESSAGE_DATE, todayKey],
      [STORAGE_KEYS.MESSAGE_TEXT, message],
      [STORAGE_KEYS.MESSAGE_VERSION, FEEDBACK_TEMPLATE_VERSION],
      [STORAGE_KEYS.MESSAGE_LOCALE, locale],
    ]);
    if (stats.targetDateKey) {
      await AsyncStorage.setItem(
        buildHistoryKey(stats.targetDateKey),
        JSON.stringify({ locale, message })
      );
    }
    return message;
  } catch (error) {
    console.error("Failed to build feedback message:", error);
    return "";
  }
};

export const getFeedbackMessageForDate = async (dateKey) => {
  if (!dateKey) return "";
  const locale = await resolveFeedbackLocale();
  let storedHistory = null;
  try {
    const historyKey = buildHistoryKey(dateKey);
    storedHistory = await AsyncStorage.getItem(historyKey);
    if (storedHistory) {
      const parsed = parseStoredHistory(storedHistory);
      if (parsed.locale === locale) {
        return parsed.message || "";
      }
      if (!parsed.locale && locale === DEFAULT_LOCALE) {
        return parsed.message || "";
      }
    }
  } catch (error) {
    console.error("Failed to load feedback history:", error);
  }
  const fallback = storedHistory ? parseStoredHistory(storedHistory).message : "";
  const anchorDate = parseDateKeyToDate(dateKey);
  if (!anchorDate) return fallback || "";
  const stats = await gatherFeedbackStats({
    anchorDate,
    offset: 0,
  });
  if (!stats || stats.targetDateKey !== dateKey) return fallback || "";
  const message = buildFeedbackMessage(stats, "historical", locale);
  try {
    await AsyncStorage.setItem(
      buildHistoryKey(dateKey),
      JSON.stringify({ locale, message })
    );
  } catch (_) {
    // ignore cache write errors
  }
  return message;
};

export const backfillFeedbackHistory = async (days = 7) => {
  try {
    const locale = await resolveFeedbackLocale();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days; i >= 1; i -= 1) {
      const target = new Date(today);
      target.setDate(today.getDate() - i);
      const dateKey = toDateKeyLocal(target);
      const historyKey = buildHistoryKey(dateKey);
      const existing = await AsyncStorage.getItem(historyKey);
      if (existing) continue;
      const stats = await gatherFeedbackStats({
        anchorDate: target,
        offset: 0,
      });
      if (!stats || stats.targetDateKey !== dateKey) continue;
      const message = buildFeedbackMessage(stats, "historical", locale);
      await AsyncStorage.setItem(
        historyKey,
        JSON.stringify({ locale, message })
      );
    }
  } catch (error) {
    console.error("Failed to backfill feedback history:", error);
  }
};
