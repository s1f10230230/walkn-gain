// 経験値バー風の段階的食べ物リスト
// 各レベルは150calずつ増加

export const FOOD_LEVELS = [
  // Level 1: 0-150cal
  {
    level: 1,
    targetCalories: 150,
    cumulativeCalories: 150,
    food: {
      id: 'onigiri',
      name: 'おにぎり',
      emoji: '🍙',
      calories: 150,
      unit: '個'
    }
  },
  // Level 2: 150-300cal
  {
    level: 2,
    targetCalories: 150,
    cumulativeCalories: 300,
    food: {
      id: 'soft_cream',
      name: 'ソフトクリーム',
      emoji: '🍦',
      calories: 150,
      unit: '個'
    }
  },
  // Level 3: 300-450cal
  {
    level: 3,
    targetCalories: 150,
    cumulativeCalories: 450,
    food: {
      id: 'bread_toast',
      name: '食パン',
      emoji: '🍞',
      calories: 177,
      unit: '枚'
    }
  },
  // Level 4: 450-600cal
  {
    level: 4,
    targetCalories: 150,
    cumulativeCalories: 600,
    food: {
      id: 'onigiri_2',
      name: 'ツナマヨおにぎり',
      emoji: '🍙',
      calories: 200,
      unit: '個'
    }
  },
  // Level 5: 600-750cal
  {
    level: 5,
    targetCalories: 150,
    cumulativeCalories: 750,
    food: {
      id: 'dango_set',
      name: '団子',
      emoji: '🍡',
      calories: 120,
      unit: '本'
    }
  },
  // Level 6: 750-900cal
  {
    level: 6,
    targetCalories: 150,
    cumulativeCalories: 900,
    food: {
      id: 'taiyaki',
      name: 'たい焼き',
      emoji: '🐟',
      calories: 220,
      unit: '個'
    }
  },
  // Level 7: 900-1050cal
  {
    level: 7,
    targetCalories: 150,
    cumulativeCalories: 1050,
    food: {
      id: 'hamburger',
      name: 'ハンバーガー',
      emoji: '🍔',
      calories: 250,
      unit: '個'
    }
  },
  // Level 8: 1050-1200cal
  {
    level: 8,
    targetCalories: 150,
    cumulativeCalories: 1200,
    food: {
      id: 'bagel',
      name: 'ベーグル',
      emoji: '🥯',
      calories: 250,
      unit: '個'
    }
  },
  // Level 9: 1200-1350cal
  {
    level: 9,
    targetCalories: 150,
    cumulativeCalories: 1350,
    food: {
      id: 'anpan',
      name: 'あんぱん',
      emoji: '🍞',
      calories: 280,
      unit: '個'
    }
  },
  // Level 10: 1350-1500cal
  {
    level: 10,
    targetCalories: 150,
    cumulativeCalories: 1500,
    food: {
      id: 'sushi',
      name: 'お寿司',
      emoji: '🍣',
      calories: 300,
      unit: '皿'
    }
  },
  // Level 11: 1500-1650cal
  {
    level: 11,
    targetCalories: 150,
    cumulativeCalories: 1650,
    food: {
      id: 'cream_pan',
      name: 'クリームパン',
      emoji: '🍞',
      calories: 300,
      unit: '個'
    }
  },
  // Level 12: 1650-1800cal
  {
    level: 12,
    targetCalories: 150,
    cumulativeCalories: 1800,
    food: {
      id: 'curry_pan',
      name: 'カレーパン',
      emoji: '🍞',
      calories: 320,
      unit: '個'
    }
  },
  // Level 13: 1800-1950cal
  {
    level: 13,
    targetCalories: 150,
    cumulativeCalories: 1950,
    food: {
      id: 'potato_chips',
      name: 'ポテトチップス',
      emoji: '🥔',
      calories: 336,
      unit: '袋'
    }
  },
  // Level 14: 1950-2100cal
  {
    level: 14,
    targetCalories: 150,
    cumulativeCalories: 2100,
    food: {
      id: 'cake',
      name: 'ケーキ',
      emoji: '🍰',
      calories: 350,
      unit: '切れ'
    }
  },
  // Level 15: 2100-2250cal
  {
    level: 15,
    targetCalories: 150,
    cumulativeCalories: 2250,
    food: {
      id: 'sandwich',
      name: 'サンドイッチ',
      emoji: '🥪',
      calories: 350,
      unit: '個'
    }
  },
  // Level 16: 2250-2400cal
  {
    level: 16,
    targetCalories: 150,
    cumulativeCalories: 2400,
    food: {
      id: 'donut',
      name: 'ドーナツ',
      emoji: '🍩',
      calories: 375,
      unit: '個'
    }
  },
  // Level 17: 2400-2550cal
  {
    level: 17,
    targetCalories: 150,
    cumulativeCalories: 2550,
    food: {
      id: 'melon_pan',
      name: 'メロンパン',
      emoji: '🍞',
      calories: 400,
      unit: '個'
    }
  },
  // Level 18: 2550-2700cal
  {
    level: 18,
    targetCalories: 150,
    cumulativeCalories: 2700,
    food: {
      id: 'crepe',
      name: 'クレープ',
      emoji: '🥞',
      calories: 400,
      unit: '個'
    }
  },
  // Level 19: 2700-2850cal
  {
    level: 19,
    targetCalories: 150,
    cumulativeCalories: 2850,
    food: {
      id: 'ramen',
      name: 'ラーメン',
      emoji: '🍜',
      calories: 500,
      unit: '杯'
    }
  },
  // Level 20: 2850-3000cal
  {
    level: 20,
    targetCalories: 150,
    cumulativeCalories: 3000,
    food: {
      id: 'yakisoba_pan',
      name: '焼きそばパン',
      emoji: '🍞',
      calories: 500,
      unit: '個'
    }
  },
];

/**
 * 現在のカロリーから、次に達成すべき食べ物レベルを取得
 * @param {number} currentCalories - 現在のカロリー
 * @returns {object} 次のレベル情報
 */
export const getNextFoodLevel = (currentCalories) => {
  for (let i = 0; i < FOOD_LEVELS.length; i++) {
    if (currentCalories < FOOD_LEVELS[i].cumulativeCalories) {
      return FOOD_LEVELS[i];
    }
  }
  // 全レベル達成済みの場合は最後のレベルを返す
  return FOOD_LEVELS[FOOD_LEVELS.length - 1];
};

/**
 * 現在のカロリーから達成済みの食べ物リストを取得
 * @param {number} currentCalories - 現在のカロリー
 * @returns {array} 達成済み食べ物の配列
 */
export const getAchievedFoods = (currentCalories) => {
  return FOOD_LEVELS.filter(level => currentCalories >= level.cumulativeCalories);
};

/**
 * 次のレベルまでに必要な残りカロリーを計算
 * @param {number} currentCalories - 現在のカロリー
 * @returns {number} 残りカロリー
 */
export const getRemainingCalories = (currentCalories) => {
  const nextLevel = getNextFoodLevel(currentCalories);
  const achievedLevels = getAchievedFoods(currentCalories);
  const lastAchievedCalories = achievedLevels.length > 0
    ? achievedLevels[achievedLevels.length - 1].cumulativeCalories
    : 0;

  return nextLevel.cumulativeCalories - currentCalories;
};

/**
 * 現在のレベル内での進捗率を計算（0-1）
 * @param {number} currentCalories - 現在のカロリー
 * @returns {number} 進捗率（0.0 ~ 1.0）
 */
export const getProgressInLevel = (currentCalories) => {
  const achievedLevels = getAchievedFoods(currentCalories);
  const lastAchievedCalories = achievedLevels.length > 0
    ? achievedLevels[achievedLevels.length - 1].cumulativeCalories
    : 0;

  const nextLevel = getNextFoodLevel(currentCalories);
  const progressInLevel = currentCalories - lastAchievedCalories;

  return Math.min(progressInLevel / nextLevel.targetCalories, 1.0);
};
