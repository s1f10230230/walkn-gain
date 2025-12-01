import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * 紙/黒板のテクスチャオーバーレイ
 * - ノイズ粒子（ランダムドット）
 * - ビネット効果（周辺減光）
 */
export default function PaperTexture({ isDark = false, style }) {
  // ノイズ粒子を生成（メモ化）
  const noiseParticles = useMemo(() => {
    const particles = [];
    // ライト: ごく薄く / ダーク: チョークの粉感を維持
    const count = isDark ? 120 : 50;

    for (let i = 0; i < count; i++) {
      const size = Math.random() * 2 + 0.5;
      particles.push({
        key: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        width: size,
        height: size,
        // ライト: 3-5%の超薄いノイズ / ダーク: 少し見える程度
        opacity: isDark
          ? Math.random() * 0.12 + 0.03
          : Math.random() * 0.03 + 0.02,
        borderRadius: size / 2,
      });
    }
    return particles;
  }, [isDark]);

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      {/* ノイズ粒子 */}
      <View style={styles.noiseLayer}>
        {noiseParticles.map((p) => (
          <View
            key={p.key}
            style={[
              styles.particle,
              {
                left: p.left,
                top: p.top,
                width: p.width,
                height: p.height,
                opacity: p.opacity,
                borderRadius: p.borderRadius,
                backgroundColor: isDark ? '#F0EDE5' : '#2D3142',
              },
            ]}
          />
        ))}
      </View>

      {/* ダークモードのみ: ビネット効果（黒板の縁を暗く） */}
      {isDark && (
        <>
          <LinearGradient
            colors={['transparent', 'rgba(10, 20, 14, 0.4)']}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0, y: 0 }}
            style={styles.vignetteCorner}
          />
          <LinearGradient
            colors={['transparent', 'rgba(10, 20, 14, 0.4)']}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 0 }}
            style={styles.vignetteCorner}
          />
          <LinearGradient
            colors={['transparent', 'rgba(10, 20, 14, 0.4)']}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0, y: 1 }}
            style={styles.vignetteCorner}
          />
          <LinearGradient
            colors={['transparent', 'rgba(10, 20, 14, 0.4)']}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
            style={styles.vignetteCorner}
          />
        </>
      )}

      {/* ダークモードのみ: 上部の光源効果（チョーク感） */}
      {isDark && (
        <LinearGradient
          colors={['rgba(127, 207, 196, 0.08)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.4 }}
          style={styles.topLight}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  noiseLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: 'absolute',
  },
  vignetteCorner: {
    ...StyleSheet.absoluteFillObject,
  },
  topLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
});
