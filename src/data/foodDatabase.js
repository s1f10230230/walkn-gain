// 食べ物データベース
// 各食べ物のカロリー情報

export const FOOD_CATEGORIES = {
  POPULAR: 'よく見る',
  FAST_FOOD: 'ファストフード',
  ALCOHOL: 'お酒',
  SNACKS: 'お菓子',
  MEALS: '定食・弁当',
  NOODLES: '麺類',
  RICE: 'ご飯もの',
  BREAD: 'パン',
  DESSERT: 'デザート',
  DRINKS: '飲み物',
};

export const FOODS = [
  // よく見る（人気）
  { id: 'ramen', name: 'ラーメン', emoji: '🍜', calories: 500, unit: '杯', category: FOOD_CATEGORIES.POPULAR },
  { id: 'onigiri', name: 'おにぎり', emoji: '🍙', calories: 180, unit: '個', category: FOOD_CATEGORIES.POPULAR },
  { id: 'beer', name: 'ビール', emoji: '🍺', calories: 140, unit: '本', category: FOOD_CATEGORIES.POPULAR },
  { id: 'curry', name: 'カレーライス', emoji: '🍛', calories: 650, unit: '皿', category: FOOD_CATEGORIES.POPULAR },
  { id: 'sushi', name: 'お寿司', emoji: '🍣', calories: 300, unit: '皿', category: FOOD_CATEGORIES.POPULAR },

  // ファストフード
  { id: 'hamburger', name: 'ハンバーガー', emoji: '🍔', calories: 250, unit: '個', category: FOOD_CATEGORIES.FAST_FOOD },
  { id: 'cheeseburger', name: 'チーズバーガー', emoji: '🍔', calories: 300, unit: '個', category: FOOD_CATEGORIES.FAST_FOOD },
  { id: 'bigmac', name: 'ビッグマック', emoji: '🍔', calories: 530, unit: '個', category: FOOD_CATEGORIES.FAST_FOOD },
  { id: 'fries_s', name: 'ポテトS', emoji: '🍟', calories: 225, unit: '個', category: FOOD_CATEGORIES.FAST_FOOD },
  { id: 'fries_m', name: 'ポテトM', emoji: '🍟', calories: 410, unit: '個', category: FOOD_CATEGORIES.FAST_FOOD },
  { id: 'fries_l', name: 'ポテトL', emoji: '🍟', calories: 520, unit: '個', category: FOOD_CATEGORIES.FAST_FOOD },
  { id: 'chicken_nuggets_5', name: 'チキンナゲット5個', emoji: '🍗', calories: 270, unit: 'セット', category: FOOD_CATEGORIES.FAST_FOOD },
  { id: 'chicken_nuggets_10', name: 'チキンナゲット10個', emoji: '🍗', calories: 540, unit: 'セット', category: FOOD_CATEGORIES.FAST_FOOD },
  { id: 'fried_chicken', name: 'フライドチキン', emoji: '🍗', calories: 300, unit: '個', category: FOOD_CATEGORIES.FAST_FOOD },
  { id: 'pizza_slice', name: 'ピザ1切れ', emoji: '🍕', calories: 285, unit: '切れ', category: FOOD_CATEGORIES.FAST_FOOD },
  { id: 'pizza_m', name: 'ピザM', emoji: '🍕', calories: 1800, unit: '枚', category: FOOD_CATEGORIES.FAST_FOOD },
  { id: 'hot_dog', name: 'ホットドッグ', emoji: '🌭', calories: 290, unit: '個', category: FOOD_CATEGORIES.FAST_FOOD },
  { id: 'taco', name: 'タコス', emoji: '🌮', calories: 170, unit: '個', category: FOOD_CATEGORIES.FAST_FOOD },

  // お酒
  { id: 'beer_350', name: 'ビール350ml', emoji: '🍺', calories: 140, unit: '缶', category: FOOD_CATEGORIES.ALCOHOL },
  { id: 'beer_500', name: 'ビール500ml', emoji: '🍺', calories: 200, unit: '缶', category: FOOD_CATEGORIES.ALCOHOL },
  { id: 'wine_glass', name: 'ワイングラス', emoji: '🍷', calories: 75, unit: '杯', category: FOOD_CATEGORIES.ALCOHOL },
  { id: 'sake', name: '日本酒1合', emoji: '🍶', calories: 185, unit: '合', category: FOOD_CATEGORIES.ALCOHOL },
  { id: 'shochu', name: '焼酎', emoji: '🥃', calories: 146, unit: '杯', category: FOOD_CATEGORIES.ALCOHOL },
  { id: 'whisky', name: 'ウイスキー', emoji: '🥃', calories: 70, unit: '杯', category: FOOD_CATEGORIES.ALCOHOL },
  { id: 'cocktail', name: 'カクテル', emoji: '🍹', calories: 150, unit: '杯', category: FOOD_CATEGORIES.ALCOHOL },
  { id: 'highball', name: 'ハイボール', emoji: '🥃', calories: 70, unit: '杯', category: FOOD_CATEGORIES.ALCOHOL },

  // お菓子
  { id: 'potato_chips', name: 'ポテトチップス', emoji: '🥔', calories: 336, unit: '袋', category: FOOD_CATEGORIES.SNACKS },
  { id: 'chocolate', name: '板チョコ', emoji: '🍫', calories: 280, unit: '枚', category: FOOD_CATEGORIES.SNACKS },
  { id: 'cookie', name: 'クッキー', emoji: '🍪', calories: 50, unit: '枚', category: FOOD_CATEGORIES.SNACKS },
  { id: 'candy', name: 'キャンディ', emoji: '🍬', calories: 20, unit: '個', category: FOOD_CATEGORIES.SNACKS },
  { id: 'ice_cream', name: 'アイスクリーム', emoji: '🍨', calories: 180, unit: '個', category: FOOD_CATEGORIES.SNACKS },
  { id: 'pudding', name: 'プリン', emoji: '🍮', calories: 126, unit: '個', category: FOOD_CATEGORIES.SNACKS },
  { id: 'donut', name: 'ドーナツ', emoji: '🍩', calories: 375, unit: '個', category: FOOD_CATEGORIES.SNACKS },
  { id: 'popcorn', name: 'ポップコーン', emoji: '🍿', calories: 220, unit: '袋', category: FOOD_CATEGORIES.SNACKS },

  // 定食・弁当
  { id: 'bento', name: '弁当', emoji: '🍱', calories: 700, unit: '個', category: FOOD_CATEGORIES.MEALS },
  { id: 'tonkatsu', name: 'とんかつ定食', emoji: '🍽️', calories: 900, unit: '食', category: FOOD_CATEGORIES.MEALS },
  { id: 'karaage', name: '唐揚げ定食', emoji: '🍽️', calories: 800, unit: '食', category: FOOD_CATEGORIES.MEALS },
  { id: 'yakiniku', name: '焼肉定食', emoji: '🍽️', calories: 850, unit: '食', category: FOOD_CATEGORIES.MEALS },
  { id: 'tempura', name: '天ぷら定食', emoji: '🍽️', calories: 750, unit: '食', category: FOOD_CATEGORIES.MEALS },
  { id: 'saba', name: '鯖の塩焼き定食', emoji: '🐟', calories: 600, unit: '食', category: FOOD_CATEGORIES.MEALS },
  { id: 'hamburg', name: 'ハンバーグ', emoji: '🥩', calories: 450, unit: '個', category: FOOD_CATEGORIES.MEALS },

  // 麺類
  { id: 'shoyu_ramen', name: '醤油ラーメン', emoji: '🍜', calories: 450, unit: '杯', category: FOOD_CATEGORIES.NOODLES },
  { id: 'miso_ramen', name: '味噌ラーメン', emoji: '🍜', calories: 500, unit: '杯', category: FOOD_CATEGORIES.NOODLES },
  { id: 'tonkotsu_ramen', name: 'とんこつラーメン', emoji: '🍜', calories: 550, unit: '杯', category: FOOD_CATEGORIES.NOODLES },
  { id: 'tsukemen', name: 'つけ麺', emoji: '🍜', calories: 600, unit: '杯', category: FOOD_CATEGORIES.NOODLES },
  { id: 'udon', name: 'うどん', emoji: '🍜', calories: 350, unit: '杯', category: FOOD_CATEGORIES.NOODLES },
  { id: 'soba', name: 'そば', emoji: '🍜', calories: 320, unit: '杯', category: FOOD_CATEGORIES.NOODLES },
  { id: 'yakisoba', name: '焼きそば', emoji: '🍜', calories: 550, unit: '皿', category: FOOD_CATEGORIES.NOODLES },
  { id: 'pasta_tomato', name: 'トマトパスタ', emoji: '🍝', calories: 400, unit: '皿', category: FOOD_CATEGORIES.NOODLES },
  { id: 'pasta_carbonara', name: 'カルボナーラ', emoji: '🍝', calories: 750, unit: '皿', category: FOOD_CATEGORIES.NOODLES },
  { id: 'pasta_peperoncino', name: 'ペペロンチーノ', emoji: '🍝', calories: 500, unit: '皿', category: FOOD_CATEGORIES.NOODLES },

  // ご飯もの
  { id: 'gohan', name: 'ご飯', emoji: '🍚', calories: 252, unit: '膳', category: FOOD_CATEGORIES.RICE },
  { id: 'curry_rice', name: 'カレーライス', emoji: '🍛', calories: 650, unit: '皿', category: FOOD_CATEGORIES.RICE },
  { id: 'katsu_curry', name: 'カツカレー', emoji: '🍛', calories: 1000, unit: '皿', category: FOOD_CATEGORIES.RICE },
  { id: 'oyakodon', name: '親子丼', emoji: '🍲', calories: 650, unit: '杯', category: FOOD_CATEGORIES.RICE },
  { id: 'gyudon', name: '牛丼', emoji: '🍲', calories: 700, unit: '杯', category: FOOD_CATEGORIES.RICE },
  { id: 'katsudon', name: 'カツ丼', emoji: '🍲', calories: 900, unit: '杯', category: FOOD_CATEGORIES.RICE },
  { id: 'tendon', name: '天丼', emoji: '🍲', calories: 800, unit: '杯', category: FOOD_CATEGORIES.RICE },
  { id: 'unadon', name: 'うな丼', emoji: '🍲', calories: 650, unit: '杯', category: FOOD_CATEGORIES.RICE },
  { id: 'chahan', name: 'チャーハン', emoji: '🍚', calories: 600, unit: '皿', category: FOOD_CATEGORIES.RICE },
  { id: 'omurice', name: 'オムライス', emoji: '🍚', calories: 700, unit: '皿', category: FOOD_CATEGORIES.RICE },
  { id: 'onigiri_salmon', name: '鮭おにぎり', emoji: '🍙', calories: 180, unit: '個', category: FOOD_CATEGORIES.RICE },
  { id: 'onigiri_tuna', name: 'ツナマヨおにぎり', emoji: '🍙', calories: 200, unit: '個', category: FOOD_CATEGORIES.RICE },
  { id: 'onigiri_ume', name: '梅おにぎり', emoji: '🍙', calories: 170, unit: '個', category: FOOD_CATEGORIES.RICE },

  // パン
  { id: 'bread', name: '食パン', emoji: '🍞', calories: 177, unit: '枚', category: FOOD_CATEGORIES.BREAD },
  { id: 'croissant', name: 'クロワッサン', emoji: '🥐', calories: 210, unit: '個', category: FOOD_CATEGORIES.BREAD },
  { id: 'anpan', name: 'あんぱん', emoji: '🍞', calories: 280, unit: '個', category: FOOD_CATEGORIES.BREAD },
  { id: 'cream_pan', name: 'クリームパン', emoji: '🍞', calories: 300, unit: '個', category: FOOD_CATEGORIES.BREAD },
  { id: 'curry_pan', name: 'カレーパン', emoji: '🍞', calories: 320, unit: '個', category: FOOD_CATEGORIES.BREAD },
  { id: 'melon_pan', name: 'メロンパン', emoji: '🍞', calories: 400, unit: '個', category: FOOD_CATEGORIES.BREAD },
  { id: 'yakisoba_pan', name: '焼きそばパン', emoji: '🍞', calories: 500, unit: '個', category: FOOD_CATEGORIES.BREAD },
  { id: 'sandwich', name: 'サンドイッチ', emoji: '🥪', calories: 350, unit: '個', category: FOOD_CATEGORIES.BREAD },
  { id: 'bagel', name: 'ベーグル', emoji: '🥯', calories: 250, unit: '個', category: FOOD_CATEGORIES.BREAD },

  // デザート
  { id: 'cake', name: 'ケーキ', emoji: '🍰', calories: 350, unit: '切れ', category: FOOD_CATEGORIES.DESSERT },
  { id: 'shortcake', name: 'ショートケーキ', emoji: '🍰', calories: 350, unit: '切れ', category: FOOD_CATEGORIES.DESSERT },
  { id: 'cheesecake', name: 'チーズケーキ', emoji: '🍰', calories: 315, unit: '切れ', category: FOOD_CATEGORIES.DESSERT },
  { id: 'tiramisu', name: 'ティラミス', emoji: '🍰', calories: 300, unit: '個', category: FOOD_CATEGORIES.DESSERT },
  { id: 'pancake', name: 'パンケーキ', emoji: '🥞', calories: 450, unit: '枚', category: FOOD_CATEGORIES.DESSERT },
  { id: 'waffle', name: 'ワッフル', emoji: '🧇', calories: 290, unit: '枚', category: FOOD_CATEGORIES.DESSERT },
  { id: 'crepe', name: 'クレープ', emoji: '🥞', calories: 400, unit: '個', category: FOOD_CATEGORIES.DESSERT },
  { id: 'parfait', name: 'パフェ', emoji: '🍨', calories: 450, unit: '個', category: FOOD_CATEGORIES.DESSERT },
  { id: 'soft_cream', name: 'ソフトクリーム', emoji: '🍦', calories: 150, unit: '個', category: FOOD_CATEGORIES.DESSERT },
  { id: 'taiyaki', name: 'たい焼き', emoji: '🐟', calories: 220, unit: '個', category: FOOD_CATEGORIES.DESSERT },
  { id: 'dango', name: '団子', emoji: '🍡', calories: 120, unit: '本', category: FOOD_CATEGORIES.DESSERT },
  { id: 'mochi', name: '餅', emoji: '🍡', calories: 120, unit: '個', category: FOOD_CATEGORIES.DESSERT },

  // 飲み物
  { id: 'cola', name: 'コーラ', emoji: '🥤', calories: 150, unit: '本', category: FOOD_CATEGORIES.DRINKS },
  { id: 'orange_juice', name: 'オレンジジュース', emoji: '🧃', calories: 165, unit: '本', category: FOOD_CATEGORIES.DRINKS },
  { id: 'apple_juice', name: 'アップルジュース', emoji: '🧃', calories: 175, unit: '本', category: FOOD_CATEGORIES.DRINKS },
  { id: 'coffee', name: 'コーヒー(砂糖なし)', emoji: '☕', calories: 5, unit: '杯', category: FOOD_CATEGORIES.DRINKS },
  { id: 'cafe_latte', name: 'カフェラテ', emoji: '☕', calories: 120, unit: '杯', category: FOOD_CATEGORIES.DRINKS },
  { id: 'milk_tea', name: 'ミルクティー', emoji: '🧋', calories: 100, unit: '杯', category: FOOD_CATEGORIES.DRINKS },
  { id: 'bubble_tea', name: 'タピオカミルクティー', emoji: '🧋', calories: 300, unit: '杯', category: FOOD_CATEGORIES.DRINKS },
  { id: 'sports_drink', name: 'スポーツドリンク', emoji: '🥤', calories: 100, unit: '本', category: FOOD_CATEGORIES.DRINKS },
  { id: 'green_tea', name: '緑茶', emoji: '🍵', calories: 0, unit: '杯', category: FOOD_CATEGORIES.DRINKS },
  { id: 'milk', name: '牛乳', emoji: '🥛', calories: 134, unit: '本', category: FOOD_CATEGORIES.DRINKS },
];

// よく見る食べ物のデフォルト設定
export const DEFAULT_FAVORITES = ['ramen', 'onigiri', 'beer', 'curry', 'sushi'];

// カテゴリ別に食べ物を取得
export const getFoodsByCategory = (category) => {
  return FOODS.filter(food => food.category === category);
};

// IDで食べ物を取得
export const getFoodById = (id) => {
  return FOODS.find(food => food.id === id);
};

// 検索機能
export const searchFoods = (query) => {
  const lowerQuery = query.toLowerCase();
  return FOODS.filter(food =>
    food.name.toLowerCase().includes(lowerQuery) ||
    food.emoji.includes(query)
  );
};

// カロリーから食べ物の量を計算
export const calculateFoodAmount = (calories, foodId) => {
  const food = getFoodById(foodId);
  if (!food) return 0;
  return (calories / food.calories).toFixed(2);
};
