import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Path, Circle, G, Rect, Line } from 'react-native-svg';

// --- デフォルト設定 ---
const DEFAULT_SIZE = 24;
const DEFAULT_COLOR = '#2D3142';

// --- アイコン画像のマッピング ---
const ICON_IMAGES = {
  trophy: require('../../assets/trophy.png'),
  fire: require('../../assets/fire.png'),
  footsteps: require('../../assets/foots.png'),
  sunny: require('../../assets/sunny.png'),
  cloudy: require('../../assets/cloudy.png'),
  rainy: require('../../assets/rainy.png'),
};

// ============================================
// SVGアイコン定義（画像がないもの用）
// ============================================

const STROKE_WIDTH = 1.5;

// 🖊️ ペン (Pen) - 万年筆のペン先
const IconPen = ({ color }) => (
  <G fill="none" stroke={color} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 19l7-7 3 3-7 7-3-3z" />
    <Path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <Path d="M2 2l7.586 7.586" />
    <Circle cx="11" cy="11" r="2" />
  </G>
);

// 📅 カレンダー (Calendar) - シンプルな日めくり
const IconCalendar = ({ color }) => (
  <G fill="none" stroke={color} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Line x1="16" y1="2" x2="16" y2="6" />
    <Line x1="8" y1="2" x2="8" y2="6" />
    <Line x1="3" y1="10" x2="21" y2="10" />
  </G>
);

// 💬 コメント (Comment) - 吹き出し
const IconComment = ({ color }) => (
  <Path
    fill="none"
    stroke={color}
    strokeWidth={STROKE_WIDTH}
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
  />
);

// 💡 電球 (Lightbulb) - アイデア・ヒント
const IconLightbulb = ({ color }) => (
  <G fill="none" stroke={color} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18h6" />
    <Path d="M10 22h4" />
    <Path d="M12 2a7 7 0 0 0-7 7c0 2 2 3 2 6h10c0-3 2-4 2-6a7 7 0 0 0-7-7z" />
  </G>
);

// ============================================
// メインコンポーネント
// ============================================
export const AppIcon = ({ name, color = DEFAULT_COLOR, size = DEFAULT_SIZE, style }) => {
  // 画像ファイルが存在する場合は画像を使用
  if (ICON_IMAGES[name]) {
    return (
      <Image
        source={ICON_IMAGES[name]}
        style={[
          {
            width: size,
            height: size,
          },
          style,
        ]}
        resizeMode="contain"
      />
    );
  }

  // 画像がない場合はSVGアイコンを使用
  const viewBox = "0 0 24 24";
  let iconContent;

  switch (name) {
    case 'pen':
      iconContent = <IconPen color={color} />;
      break;
    case 'calendar':
      iconContent = <IconCalendar color={color} />;
      break;
    case 'comment':
      iconContent = <IconComment color={color} />;
      break;
    case 'lightbulb':
      iconContent = <IconLightbulb color={color} />;
      break;
    default:
      // デフォルトは四角形（開発用）
      iconContent = <Rect x="2" y="2" width="20" height="20" stroke={color} strokeWidth={STROKE_WIDTH} fill="none" />;
      break;
  }

  return (
    <Svg width={size} height={size} viewBox={viewBox} style={style}>
      {iconContent}
    </Svg>
  );
};
