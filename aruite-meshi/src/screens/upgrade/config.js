export const PREMIUM_FEATURES = [
  {
    icon: '✨',
    title: 'AIインサイト（毎日・毎週・毎月）',
    description: 'その日の調子や1週間の傾向をコーチ目線でフィードバック',
  },
  {
    icon: '🧠',
    title: '自動目標チューニング',
    description: '連続達成や疲れを考慮して歩数目標を提案・調整',
  },
  {
    icon: '🌦️',
    title: '環境分析',
    description: '気温・天気と歩数の相性を解析しベストコンディションを提示',
  },
  {
    icon: '🧭',
    title: '月次スタイル診断',
    description: '平日・週末・朝夜などの型をレーダーチャートで可視化',
  },
  {
    icon: '📅',
    title: '履歴・グラフ無制限',
    description: '過去すべての歩数・時間帯グラフをさかのぼり放題',
  },
  {
    icon: '📷',
    title: '写真4枚/日',
    description: '思い出を1日に最大4枚まで保存',
  },
];

export const PRICING = {
  monthly: {
    price: '¥680',
    period: '月額',
    productId: 'premium_monthly',
    note: '1日あたり約¥23',
    purchaseLabel: '月額でProを始める',
    renewalSuffix: '/月',
    packageType: 'monthly',
  },
  yearly: {
    price: '¥5,760',
    period: '年額',
    productId: 'premium_yearly',
    discount: '2ヶ月分お得',
    note: '月あたり約¥480',
    purchaseLabel: '年額でProを始める',
    renewalSuffix: '/年',
    packageType: 'annual',
  },
};

export const PLAN_ORDER = ['yearly', 'monthly'];
