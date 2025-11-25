/**
 * テーマカラー定義
 * ライトモードとダークモードの両方に対応
 */

export const COLORS = {
  // Journal Color Palette (Teal × Orange)
  primary: '#FF6B35',            // Coral Orange (accent, CTAs)
  primaryDark: '#FF8050',
  accent: '#00A896',             // Teal Green (brand color)
  accentDark: '#14B8A6',
  success: '#16A34A',            // Green 600
  successDark: '#22C55E',

  // Light Mode (Journal Paper)
  light: {
    background: '#F8F4E3',       // Warm ivory (paper)
    card: '#FFFDF9',             // Paper white
    cardWarm: '#FFFEF9',
    text: '#2D3142',             // Ink dark
    textSecondary: '#9CA5B5',    // Muted gray
    textTertiary: '#B8BFC9',     // Light gray
    border: '#F0F0F0',           // Paper edge
    lineGray: '#E0E0E0',         // Ruled lines
    shadow: '#1B1F23',           // Deep shadow
    progressUnfilled: '#E8E4D8', // Subtle tan
    circleUnfilled: '#EDF2F7',
    chartBar: '#D4CFC0',         // Muted tan bar
  },

  // Dark Mode (Dark Paper/Parchment)
  dark: {
    background: '#1C1917',       // Dark brown-gray
    card: '#292524',             // Warm dark card
    cardWarm: '#292524',
    text: '#F5F5F4',             // Warm white
    textSecondary: '#A8A29E',    // Warm gray
    textTertiary: '#78716C',     // Muted warm gray
    border: '#44403C',           // Dark border
    lineGray: '#57534E',         // Dark ruled line
    shadow: '#000000',
    progressUnfilled: '#44403C',
    circleUnfilled: '#1C1917',
    chartBar: '#57534E',
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
    lineGray: isDark ? COLORS.dark.lineGray : COLORS.light.lineGray,
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
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 12,
    };
  }

  // Richer shadow for paper depth
  return {
    shadowColor: '#1B1F23',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  };
};
