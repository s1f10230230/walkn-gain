// 歩数からカロリー、距離などを計算するユーティリティ

// 基礎代謝量（BMR）を計算（Mifflin-St Jeor式）
export const calculateBMR = (weightKg, heightCm, age, gender) => {
  if (gender === 'male') {
    // 男性: BMR = 88.36 + (13.4 × 体重) + (4.8 × 身長) - (5.7 × 年齢)
    return 88.36 + (13.4 * weightKg) + (4.8 * heightCm) - (5.7 * age);
  } else {
    // 女性: BMR = 447.6 + (9.25 × 体重) + (3.10 × 身長) - (4.33 × 年齢)
    return 447.6 + (9.25 * weightKg) + (3.1 * heightCm) - (4.33 * age);
  }
};

// 歩行による消費カロリーを計算（MET法）
export const calculateWalkingCalories = (steps, weightKg) => {
  // 平均歩行速度: 約80歩/分
  const stepsPerMinute = 80;
  const timeInHours = steps / (stepsPerMinute * 60);

  // 普通の歩行: 3.3 METs
  const MET = 3.3;

  // 消費カロリー = MET × 体重[kg] × 時間[h] × 1.05
  const calories = MET * weightKg * timeInHours * 1.05;

  return calories;
};

// 歩数からカロリーを計算（簡易版・体重考慮）
export const calculateCalories = (steps, weightKg = 65) => {
  // MET法を簡略化: 体重[kg] × 歩数 × 0.00055
  return steps * weightKg * 0.00055;
};

// 体重を考慮したカロリー計算（レガシー・互換性のため残す）
export const calculateCaloriesWithWeight = (steps, weightKg) => {
  return calculateCalories(steps, weightKg);
};

// 歩幅から距離を計算（km）
export const calculateDistance = (steps, strideLength) => {
  // 歩幅（cm）× 歩数 ÷ 100000 = 距離（km）
  return (steps * strideLength) / 100000;
};

// 身長から標準的な歩幅を推定（cm）
export const estimateStrideLength = (heightCm) => {
  // 一般的に、歩幅は身長の約45%
  return heightCm * 0.45;
};

// 目標達成率を計算（パーセンテージ）
export const calculateGoalProgress = (currentSteps, goalSteps) => {
  return Math.min((currentSteps / goalSteps) * 100, 100);
};

// 時間帯別の歩数を初期化
export const initializeHourlySteps = () => {
  return Array(24).fill(0);
};

// 現在の日付をYYYY-MM-DD形式で取得
export const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 任意の日付をローカルタイムでYYYY-MM-DD形式に整形
export const toDateKeyLocal = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 日付文字列を整形（表示用）
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
};

// 月/日形式でフォーマット (例: 11/22)
export const formatMonthDay = (date, locale = 'ja') => {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  
  if (locale === 'en') {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${monthNames[d.getMonth()]} ${day}`;
  }
  
  return `${month}/${day}`;
};

// 曜日を取得
export const getDayOfWeek = (dateString) => {
  const date = new Date(dateString);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
};

// 週間の日付リストを取得
export const getWeekDates = () => {
  const dates = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
};

// 月間の日付リストを取得
export const getMonthDates = () => {
  const dates = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
};

// 平均歩数を計算
export const calculateAverage = (stepsList) => {
  if (stepsList.length === 0) return 0;
  const sum = stepsList.reduce((acc, steps) => acc + steps, 0);
  return Math.round(sum / stepsList.length);
};

// 合計歩数を計算
export const calculateTotal = (stepsList) => {
  return stepsList.reduce((acc, steps) => acc + steps, 0);
};

// カレンダー週（月曜〜日曜）の日付リストを取得
// offset: 0 = 今週, -1 = 先週, 1 = 来週
export const getCalendarWeekDates = (offset = 0) => {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 今週の月曜日を求める
  const dayOfWeek = today.getDay(); // 0=日, 1=月, ..., 6=土
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday + (offset * 7));

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
};

// カレンダー月（1日〜末日）の日付リストを取得
// offset: 0 = 今月, -1 = 先月, 1 = 来月
export const getCalendarMonthDates = (offset = 0) => {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 対象月の1日を求める
  const targetMonth = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();

  // その月の末日を求める
  const lastDay = new Date(year, month + 1, 0).getDate();

  for (let i = 1; i <= lastDay; i++) {
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(i).padStart(2, '0');
    dates.push(`${year}-${monthStr}-${dayStr}`);
  }
  return dates;
};

// 週のラベルを取得（例: "12/2 - 12/8"）
export const getWeekLabel = (offset = 0) => {
  const dates = getCalendarWeekDates(offset);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const [, sm, sd] = startDate.split('-');
  const [, em, ed] = endDate.split('-');
  return `${parseInt(sm)}/${parseInt(sd)} - ${parseInt(em)}/${parseInt(ed)}`;
};

// 月のラベルを取得（例: "2025年12月" or "Dec 2025"）
export const getMonthLabel = (offset = 0, locale = 'ja') => {
  const today = new Date();
  const targetMonth = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();

  if (locale === 'en') {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[month]} ${year}`;
  } else if (locale === 'zh-Hans') {
    return `${year}年${month + 1}月`;
  }
  return `${year}年${month + 1}月`;
};

// 日付が今日以降かどうかを判定
export const isFutureDate = (dateString) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = dateString.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate > today;
};

// 日付が今日かどうかを判定
export const isToday = (dateString) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = dateString.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate.getTime() === today.getTime();
};
