// 日々の段階的目標システム
// 達成したらその日中に次の食べ物が目標になる（即座にレベルアップ）

export const DAILY_FOOD_GOALS = [
  {
    id: 1,
    food: {
      id: 'onigiri',
      name: 'おにぎり',
      emoji: '🍙',
      calories: 150,
      unit: '個'
    }
  },
  {
    id: 2,
    food: {
      id: 'dango',
      name: '団子',
      emoji: '🍡',
      calories: 200,
      unit: '本'
    }
  },
  {
    id: 3,
    food: {
      id: 'taiyaki',
      name: 'たい焼き',
      emoji: '🐟',
      calories: 220,
      unit: '個'
    }
  },
  {
    id: 4,
    food: {
      id: 'hamburger',
      name: 'ハンバーガー',
      emoji: '🍔',
      calories: 250,
      unit: '個'
    }
  },
  {
    id: 5,
    food: {
      id: 'anpan',
      name: 'あんぱん',
      emoji: '🍞',
      calories: 280,
      unit: '個'
    }
  },
  {
    id: 6,
    food: {
      id: 'sushi',
      name: 'お寿司',
      emoji: '🍣',
      calories: 300,
      unit: '皿'
    }
  },
  {
    id: 7,
    food: {
      id: 'curry_pan',
      name: 'カレーパン',
      emoji: '🍞',
      calories: 320,
      unit: '個'
    }
  },
  {
    id: 8,
    food: {
      id: 'udon',
      name: 'うどん',
      emoji: '🍜',
      calories: 350,
      unit: '杯'
    }
  },
  {
    id: 9,
    food: {
      id: 'donut',
      name: 'ドーナツ',
      emoji: '🍩',
      calories: 375,
      unit: '個'
    }
  },
  {
    id: 10,
    food: {
      id: 'melon_pan',
      name: 'メロンパン',
      emoji: '🍞',
      calories: 400,
      unit: '個'
    }
  },
  {
    id: 11,
    food: {
      id: 'shoyu_ramen',
      name: '醤油ラーメン',
      emoji: '🍜',
      calories: 450,
      unit: '杯'
    }
  },
  {
    id: 12,
    food: {
      id: 'ramen',
      name: 'ラーメン',
      emoji: '🍜',
      calories: 500,
      unit: '杯'
    }
  },
  {
    id: 13,
    food: {
      id: 'tonkotsu_ramen',
      name: 'とんこつラーメン',
      emoji: '🍜',
      calories: 550,
      unit: '杯'
    }
  },
  {
    id: 14,
    food: {
      id: 'tsukemen',
      name: 'つけ麺',
      emoji: '🍜',
      calories: 600,
      unit: '杯'
    }
  },
  {
    id: 15,
    food: {
      id: 'curry',
      name: 'カレーライス',
      emoji: '🍛',
      calories: 650,
      unit: '皿'
    }
  },
  {
    id: 16,
    food: {
      id: 'bento',
      name: '弁当',
      emoji: '🍱',
      calories: 700,
      unit: '個'
    }
  },
  {
    id: 17,
    food: {
      id: 'tonkatsu',
      name: 'とんかつ定食',
      emoji: '🍽️',
      calories: 900,
      unit: '食'
    }
  },
  {
    id: 18,
    food: {
      id: 'katsu_curry',
      name: 'カツカレー',
      emoji: '🍛',
      calories: 1000,
      unit: '皿'
    }
  },
];

/**
 * 現在の目標レベルを取得
 * @param {number} currentLevel - 現在のレベル（1から開始）
 * @returns {object} 目標情報
 */
export const getCurrentGoal = (currentLevel) => {
  const index = Math.min(currentLevel - 1, DAILY_FOOD_GOALS.length - 1);
  return DAILY_FOOD_GOALS[Math.max(0, index)];
};

/**
 * 次のレベルの目標を取得
 * @param {number} currentLevel - 現在のレベル
 * @returns {object|null} 次の目標情報、または null（最大レベル到達時）
 */
export const getNextGoal = (currentLevel) => {
  if (currentLevel >= DAILY_FOOD_GOALS.length) {
    return null; // 最大レベル到達
  }
  return DAILY_FOOD_GOALS[currentLevel];
};

/**
 * 目標達成判定
 * @param {number} currentCalories - 現在のカロリー
 * @param {number} targetCalories - 目標カロリー
 * @returns {boolean} 達成しているか
 */
export const isGoalAchieved = (currentCalories, targetCalories) => {
  return currentCalories >= targetCalories;
};
