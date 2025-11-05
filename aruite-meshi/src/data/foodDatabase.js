// 食べ物データベース
// 各食べ物のカロリー情報

export const FOOD_CATEGORIES = {
  POPULAR: "よく見る",
  FAST_FOOD: "ファストフード",
  ALCOHOL: "お酒",
  SNACKS: "お菓子",
  MEALS: "定食・弁当",
  NOODLES: "麺類",
  RICE: "ご飯もの",
  BREAD: "パン",
  DESSERT: "デザート",
  DRINKS: "飲み物",
};

export const FOODS = [
  // よく見る（人気）
  {
    id: "ramen",
    name: "ラーメン",
    emoji: "🍜",
    calories: 500,
    unit: "杯",
    category: FOOD_CATEGORIES.POPULAR,
  },
  {
    id: "onigiri",
    name: "おにぎり",
    emoji: "🍙",
    calories: 180,
    unit: "個",
    category: FOOD_CATEGORIES.POPULAR,
  },
  {
    id: "beer",
    name: "ビール",
    emoji: "🍺",
    calories: 140,
    unit: "本",
    category: FOOD_CATEGORIES.POPULAR,
  },
  {
    id: "curry",
    name: "カレーライス",
    emoji: "🍛",
    calories: 650,
    unit: "皿",
    category: FOOD_CATEGORIES.POPULAR,
  },
  {
    id: "sushi",
    name: "お寿司",
    emoji: "🍣",
    calories: 300,
    unit: "皿",
    category: FOOD_CATEGORIES.POPULAR,
  },

  // ファストフード
  {
    id: "hamburger",
    name: "ハンバーガー",
    emoji: "🍔",
    calories: 300,
    unit: "個",
    category: FOOD_CATEGORIES.FAST_FOOD,
  },
  {
    id: "fries",
    name: "ポテト",
    emoji: "🍟",
    calories: 410,
    unit: "個",
    category: FOOD_CATEGORIES.FAST_FOOD,
  },
  {
    id: "chicken_nuggets",
    name: "チキンナゲット",
    emoji: "🍗",
    calories: 270,
    unit: "セット",
    category: FOOD_CATEGORIES.FAST_FOOD,
  },
  {
    id: "fried_chicken",
    name: "フライドチキン",
    emoji: "🍗",
    calories: 300,
    unit: "個",
    category: FOOD_CATEGORIES.FAST_FOOD,
  },
  {
    id: "pizza_slice",
    name: "ピザ1切れ",
    emoji: "🍕",
    calories: 285,
    unit: "切れ",
    category: FOOD_CATEGORIES.FAST_FOOD,
  },
  {
    id: "hot_dog",
    name: "ホットドッグ",
    emoji: "🌭",
    calories: 290,
    unit: "個",
    category: FOOD_CATEGORIES.FAST_FOOD,
  },

  // お酒
  {
    id: "wine_glass",
    name: "ワイン",
    emoji: "🍷",
    calories: 75,
    unit: "杯",
    category: FOOD_CATEGORIES.ALCOHOL,
  },
  {
    id: "sake",
    name: "日本酒",
    emoji: "🍶",
    calories: 185,
    unit: "合",
    category: FOOD_CATEGORIES.ALCOHOL,
  },
  {
    id: "cocktail",
    name: "カクテル",
    emoji: "🍹",
    calories: 150,
    unit: "杯",
    category: FOOD_CATEGORIES.ALCOHOL,
  },

  // お菓子
  {
    id: "chocolate",
    name: "板チョコ",
    emoji: "🍫",
    calories: 280,
    unit: "枚",
    category: FOOD_CATEGORIES.SNACKS,
  },
  {
    id: "cookie",
    name: "クッキー",
    emoji: "🍪",
    calories: 50,
    unit: "枚",
    category: FOOD_CATEGORIES.SNACKS,
  },
  {
    id: "ice_cream",
    name: "アイスクリーム",
    emoji: "🍨",
    calories: 180,
    unit: "個",
    category: FOOD_CATEGORIES.SNACKS,
  },
  {
    id: "pudding",
    name: "プリン",
    emoji: "🍮",
    calories: 126,
    unit: "個",
    category: FOOD_CATEGORIES.SNACKS,
  },
  {
    id: "donut",
    name: "ドーナツ",
    emoji: "🍩",
    calories: 375,
    unit: "個",
    category: FOOD_CATEGORIES.SNACKS,
  },
  {
    id: "popcorn",
    name: "ポップコーン",
    emoji: "🍿",
    calories: 220,
    unit: "袋",
    category: FOOD_CATEGORIES.SNACKS,
  },

  // 麺類
  {
    id: "udon",
    name: "うどん",
    emoji: "🍜",
    calories: 350,
    unit: "杯",
    category: FOOD_CATEGORIES.NOODLES,
  },
  {
    id: "soba",
    name: "そば",
    emoji: "🍜",
    calories: 320,
    unit: "杯",
    category: FOOD_CATEGORIES.NOODLES,
  },
  {
    id: "yakisoba",
    name: "焼きそば",
    emoji: "🍜",
    calories: 550,
    unit: "皿",
    category: FOOD_CATEGORIES.NOODLES,
  },
  {
    id: "pasta_tomato",
    name: "トマトパスタ",
    emoji: "🍝",
    calories: 400,
    unit: "皿",
    category: FOOD_CATEGORIES.NOODLES,
  },
  {
    id: "pasta_carbonara",
    name: "カルボナーラ",
    emoji: "🍝",
    calories: 750,
    unit: "皿",
    category: FOOD_CATEGORIES.NOODLES,
  },

  // ご飯もの
  {
    id: "gohan",
    name: "ご飯",
    emoji: "🍚",
    calories: 252,
    unit: "膳",
    category: FOOD_CATEGORIES.RICE,
  },
  {
    id: "chahan",
    name: "チャーハン",
    emoji: "🍚",
    calories: 600,
    unit: "皿",
    category: FOOD_CATEGORIES.RICE,
  },

  // パン
  {
    id: "bread",
    name: "食パン",
    emoji: "🍞",
    calories: 177,
    unit: "枚",
    category: FOOD_CATEGORIES.BREAD,
  },
  {
    id: "croissant",
    name: "クロワッサン",
    emoji: "🥐",
    calories: 210,
    unit: "個",
    category: FOOD_CATEGORIES.BREAD,
  },
  {
    id: "anpan",
    name: "あんぱん",
    emoji: "🍞",
    calories: 280,
    unit: "個",
    category: FOOD_CATEGORIES.BREAD,
  },
  {
    id: "curry_pan",
    name: "カレーパン",
    emoji: "🍞",
    calories: 320,
    unit: "個",
    category: FOOD_CATEGORIES.BREAD,
  },
  {
    id: "melon_pan",
    name: "メロンパン",
    emoji: "🍞",
    calories: 400,
    unit: "個",
    category: FOOD_CATEGORIES.BREAD,
  },
  {
    id: "sandwich",
    name: "サンドイッチ",
    emoji: "🥪",
    calories: 350,
    unit: "個",
    category: FOOD_CATEGORIES.BREAD,
  },

  // デザート
  {
    id: "cake",
    name: "ケーキ",
    emoji: "🍰",
    calories: 350,
    unit: "切れ",
    category: FOOD_CATEGORIES.DESSERT,
  },
  {
    id: "tiramisu",
    name: "ティラミス",
    emoji: "🍰",
    calories: 300,
    unit: "個",
    category: FOOD_CATEGORIES.DESSERT,
  },
  {
    id: "pancake",
    name: "パンケーキ",
    emoji: "🥞",
    calories: 450,
    unit: "枚",
    category: FOOD_CATEGORIES.DESSERT,
  },

  // 飲み物
  {
    id: "cola",
    name: "コーラ",
    emoji: "🥤",
    calories: 150,
    unit: "本",
    category: FOOD_CATEGORIES.DRINKS,
  },
  {
    id: "cafe_latte",
    name: "カフェラテ",
    emoji: "☕",
    calories: 120,
    unit: "杯",
    category: FOOD_CATEGORIES.DRINKS,
  },
  {
    id: "bubble_tea",
    name: "タピオカミルクティー",
    emoji: "🧋",
    calories: 300,
    unit: "杯",
    category: FOOD_CATEGORIES.DRINKS,
  },
];

// よく見る食べ物のデフォルト設定
export const DEFAULT_FAVORITES = ["ramen", "onigiri", "beer", "curry", "sushi"];

// カテゴリ別に食べ物を取得
export const getFoodsByCategory = (category) => {
  return FOODS.filter((food) => food.category === category);
};

// IDで食べ物を取得
export const getFoodById = (id) => {
  return FOODS.find((food) => food.id === id);
};

// 検索機能
export const searchFoods = (query) => {
  const lowerQuery = query.toLowerCase();
  return FOODS.filter(
    (food) =>
      food.name.toLowerCase().includes(lowerQuery) || food.emoji.includes(query)
  );
};

// カロリーから食べ物の量を計算
export const calculateFoodAmount = (calories, foodId) => {
  const food = getFoodById(foodId);
  if (!food) return 0;
  return (calories / food.calories).toFixed(2);
};
