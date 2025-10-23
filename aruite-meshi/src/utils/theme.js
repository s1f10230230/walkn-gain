/**
 * テーマカラー定義
 * ライトモードとダークモードの両方に対応
 */

export const COLORS = {
  // メインカラー
  primary: '#FF7043',
  primaryDark: '#FF8A65',  // ダークモード用に少し明るく
  success: '#00C853',
  successDark: '#00E676',  // ダークモード用に少し明るく

  // ライトモード
  light: {
    background: '#F5F5F5',
    card: '#FFFFFF',
    text: '#212121',
    textSecondary: '#757575',
    textTertiary: '#9E9E9E',
    border: '#E0E0E0',
    shadow: '#000000',
    progressUnfilled: '#E0E0E0',
    circleUnfilled: '#F5F5F5',
  },

  // ダークモード
  dark: {
    background: '#121212',
    card: '#1E1E1E',
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textTertiary: '#808080',
    border: '#2C2C2C',
    shadow: '#000000',
    progressUnfilled: '#2C2C2C',
    circleUnfilled: '#2C2C2C',
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
    success: isDark ? COLORS.successDark : COLORS.success,
    background: isDark ? COLORS.dark.background : COLORS.light.background,
    card: isDark ? COLORS.dark.card : COLORS.light.card,
    text: isDark ? COLORS.dark.text : COLORS.light.text,
    textSecondary: isDark ? COLORS.dark.textSecondary : COLORS.light.textSecondary,
    textTertiary: isDark ? COLORS.dark.textTertiary : COLORS.light.textTertiary,
    border: isDark ? COLORS.dark.border : COLORS.light.border,
    shadow: isDark ? COLORS.dark.shadow : COLORS.light.shadow,
    progressUnfilled: isDark ? COLORS.dark.progressUnfilled : COLORS.light.progressUnfilled,
    circleUnfilled: isDark ? COLORS.dark.circleUnfilled : COLORS.light.circleUnfilled,
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
