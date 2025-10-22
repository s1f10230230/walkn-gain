// 歩数からカロリー、距離などを計算するユーティリティ

// 歩数からカロリーを計算（平均的な計算式）
export const calculateCalories = (steps) => {
  // 1歩あたり約0.05kcal（体重65kg前後の平均）
  return steps * 0.05;
};

// 体重を考慮したカロリー計算
export const calculateCaloriesWithWeight = (steps, weightKg) => {
  // 体重1kgあたり約0.0008kcal/歩
  return steps * 0.0008 * weightKg;
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

// 日付文字列を整形（表示用）
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
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
