import React from 'react';
import { View, StyleSheet } from 'react-native';

// 色とサイズの定義（呼び出し側で指定も可能）
const DEFAULT_COLOR = '#9CA5B5'; // 薄いグレー
const DEFAULT_SIZE = 14; // アイコン全体のサイズ（正方形）
const STROKE_WIDTH = 1; // 線の太さ（極細）

const ThinCalendarIcon = ({ color = DEFAULT_COLOR, size = DEFAULT_SIZE }) => {
  // サイズに基づいた動的なスタイル計算
  const iconStyles = {
    width: size,
    height: size,
    borderColor: color,
  };
  const headerStyles = {
    height: size / 3.5, // 上部の帯の高さ
    borderBottomColor: color,
  };
  const textStyles = {
    // 中の線（擬似テキスト）のスタイル
    backgroundColor: color,
    height: STROKE_WIDTH,
    marginHorizontal: size / 4, // 左右の余白
    marginTop: size / 5, // 上下の間隔
  };
  // 上部のフック（留め具）のスタイル
  const hookStyles = {
      width: STROKE_WIDTH,
      height: size / 4,
      backgroundColor: color,
      position: 'absolute',
      top: -size / 8,
  };

  return (
    <View style={[styles.container, iconStyles]}>
      {/* --- 上部のフック（2本） --- */}
      <View style={[hookStyles, { left: size / 4 }]} />
      <View style={[hookStyles, { right: size / 4 }]} />

      {/* --- カレンダーの上部（帯） --- */}
      <View style={[styles.header, headerStyles]} />

      {/* --- カレンダーの中身（擬似的な予定の線） --- */}
      <View style={styles.body}>
        {/* 2本の細い線で予定を表現 */}
        <View style={textStyles} />
        <View style={textStyles} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: STROKE_WIDTH,
    borderRadius: 2, // 少し角を丸く
    overflow: 'visible', // フックをはみ出させるため
  },
  header: {
    borderBottomWidth: STROKE_WIDTH,
    width: '100%',
  },
  body: {
    flex: 1,
    justifyContent: 'flex-start', // 上寄せ
  },
});

export default ThinCalendarIcon;
