/**
 * RadarChart - 6軸レーダーチャート for Walking DNA
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, G, Polygon, Text as SvgText } from 'react-native-svg';
import { DNA_PARAMS } from '../utils/walkingDna';

const SIZE = 200; // チャートのサイズ
const CENTER = SIZE / 2;
const RADIUS = SIZE * 0.35; // 外周の半径
const LEVELS = 4; // 同心円の数

// 6軸の角度（12時から時計回り）
const ANGLES = [
  -90,    // 12時 (top)
  -30,    // 2時
  30,     // 4時
  90,     // 6時 (right)
  150,    // 8時
  210,    // 10時
].map(deg => (deg * Math.PI) / 180);

// パラメータの順序
const PARAM_ORDER = ['morning', 'burst', 'power', 'night', 'keep', 'weekend'];

const RadarChart = ({
  params,
  size = SIZE,
  showLabels = true,
  fillColor = 'rgba(0, 168, 150, 0.3)',
  strokeColor = '#00A896',
  gridColor = '#E0E0E0',
  labelColor = '#2D3142',
  theme,
}) => {
  const scale = size / SIZE;
  const center = CENTER * scale;
  const radius = RADIUS * scale;

  // 座標計算（0-100を半径にマッピング）
  const getPoint = (value, angleIndex) => {
    const angle = ANGLES[angleIndex];
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // 外周の座標を取得
  const getOuterPoint = (angleIndex, levelRatio = 1) => {
    const angle = ANGLES[angleIndex];
    const r = radius * levelRatio;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // グリッド（同心六角形）のパスを生成
  const getGridPath = (levelRatio) => {
    const points = PARAM_ORDER.map((_, i) => getOuterPoint(i, levelRatio));
    return points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ') + ' Z';
  };

  // データポイントのパスを生成
  const getDataPath = () => {
    if (!params) return '';
    const points = PARAM_ORDER.map((key, i) => getPoint(params[key] || 0, i));
    return points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ') + ' Z';
  };

  // ラベルの位置（外側に配置）
  const getLabelPosition = (angleIndex) => {
    const angle = ANGLES[angleIndex];
    const labelRadius = radius + 25 * scale;
    return {
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
    };
  };

  const effectiveLabelColor = theme?.text || labelColor;
  const effectiveGridColor = theme?.isDark ? 'rgba(255,255,255,0.2)' : gridColor;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* グリッド（同心六角形） */}
        {[1, 0.75, 0.5, 0.25].map((level, i) => (
          <Path
            key={`grid-${i}`}
            d={getGridPath(level)}
            fill="none"
            stroke={effectiveGridColor}
            strokeWidth={level === 1 ? 1.5 : 1}
            strokeDasharray={level === 1 ? '' : '4,4'}
          />
        ))}

        {/* 軸線 */}
        {PARAM_ORDER.map((_, i) => {
          const outer = getOuterPoint(i);
          return (
            <Line
              key={`axis-${i}`}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke={effectiveGridColor}
              strokeWidth={1}
            />
          );
        })}

        {/* データエリア */}
        {params && (
          <>
            <Path
              d={getDataPath()}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={2}
            />
            {/* データポイント */}
            {PARAM_ORDER.map((key, i) => {
              const point = getPoint(params[key] || 0, i);
              return (
                <Circle
                  key={`point-${i}`}
                  cx={point.x}
                  cy={point.y}
                  r={4 * scale}
                  fill={strokeColor}
                />
              );
            })}
          </>
        )}

        {/* ラベル */}
        {showLabels && PARAM_ORDER.map((key, i) => {
          const pos = getLabelPosition(i);
          const param = DNA_PARAMS[key];
          return (
            <SvgText
              key={`label-${i}`}
              x={pos.x}
              y={pos.y}
              fontSize={10 * scale}
              fontWeight="600"
              fill={effectiveLabelColor}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {param.emoji} {param.label}
            </SvgText>
          );
        })}
      </Svg>

      {/* 値のオーバーレイ（オプション） */}
      {params && showLabels && (
        <View style={styles.valuesContainer}>
          {PARAM_ORDER.map((key, i) => {
            const point = getPoint(params[key] || 0, i);
            const value = params[key] || 0;
            // 値が十分高い場合のみ表示
            if (value < 20) return null;
            return null; // SVGのポイントで十分なので省略
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default RadarChart;
