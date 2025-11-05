/**
 * テーマカラー定義
 * ライトモードとダークモードの両方に対応
 */

export const COLORS = {
  // メインカラー（Calm × Cute）
  primary: '#FF7043',            // 祝祭・強CTA（控えめに使用）
  primaryDark: '#FF8A65',
  accent: '#14B8A6',             // Teal 500（落ち着き＋少し可愛い）
  accentDark: '#2DD4BF',         // ダーク用ティール
  success: '#16A34A',            // Green 600
  successDark: '#22C55E',

  // ライトモード（Calm寄り）
  light: {
    background: '#F7FAFC',       // 淡いブルーグレー
    card: '#FFFFFF',
    cardWarm: '#F8FAFC',
    text: '#1A202C',             // Slate 900
    textSecondary: '#64748B',    // Slate 500
    textTertiary: '#94A3B8',     // Slate 400
    border: '#E5E7EB',           // Gray 200
    shadow: '#000000',
    progressUnfilled: '#E2E8F0', // Slate 200
    circleUnfilled: '#EDF2F7',   // Gray 100
    chartBar: '#CBD5E1',         // Slate 300（落ち着いたバー色）
  },

  // ダークモード（Calm寄り）
  dark: {
    background: '#111827',       // Slate 900
    card: '#1F2937',             // Slate 800
    cardWarm: '#1F2937',
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',    // Gray 300
    textTertiary: '#9CA3AF',     // Gray 400
    border: '#374151',           // Slate 700
    shadow: '#000000',
    progressUnfilled: '#374151',
    circleUnfilled: '#111827',
    chartBar: '#334155',         // Slate 700（暗所でも落ち着く）
  },
};

/**
 * テーマに応じた色を取得
 * @param {string} colorScheme - 'light' or 'dark'
 * @returns {object} テーマカラー
 */
export const getTheme = (colorScheme) => {
  const isDark = colorScheme === 'dark';

  return {
    primary: isDark ? COLORS.primaryDark : COLORS.primary,
    accent: isDark ? COLORS.accentDark : COLORS.accent,
    success: isDark ? COLORS.successDark : COLORS.success,
    background: isDark ? COLORS.dark.background : COLORS.light.background,
    card: isDark ? COLORS.dark.card : COLORS.light.card,
    cardWarm: isDark ? COLORS.dark.cardWarm : COLORS.light.cardWarm,
    text: isDark ? COLORS.dark.text : COLORS.light.text,
    textSecondary: isDark ? COLORS.dark.textSecondary : COLORS.light.textSecondary,
    textTertiary: isDark ? COLORS.dark.textTertiary : COLORS.light.textTertiary,
    border: isDark ? COLORS.dark.border : COLORS.light.border,
    shadow: isDark ? COLORS.dark.shadow : COLORS.light.shadow,
    progressUnfilled: isDark ? COLORS.dark.progressUnfilled : COLORS.light.progressUnfilled,
    circleUnfilled: isDark ? COLORS.dark.circleUnfilled : COLORS.light.circleUnfilled,
    chartBar: isDark ? COLORS.dark.chartBar : COLORS.light.chartBar,
    isDark,
  };
};

/**
 * 影のスタイルを取得（ダークモードでは影を強調）
 * @param {boolean} isDark - ダークモードかどうか
 * @returns {object} 影のスタイル
 */
export const getShadowStyle = (isDark) => {
  if (isDark) {
    return {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.6,  // ダークモードでは影を強く
      shadowRadius: 12,
      elevation: 12,
    };
  }

  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  };
};
