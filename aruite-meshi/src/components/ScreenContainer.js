import React from 'react';
import { SafeAreaView, ScrollView, View, StyleSheet } from 'react-native';

/**
 * 共通スクリーンラッパ
 * - SafeAreaを考慮し背景を全画面に敷く
 * - scroll=true で ScrollView に切り替え
 * - contentContainerStyle で中央寄せや余白を調整可能
 */
export default function ScreenContainer({
  children,
  scroll = false,
  style,
  contentStyle,
}) {
  const Wrapper = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safe}>
      <Wrapper
        style={[styles.fill, style]}
        // ScrollView の contentContainerStyle に `flex: 1` を付けると、
        // コンテンツが「はみ出す」だけでスクロール領域が伸びず、スクロールできないことがある。
        // `flexGrow: 1` で最小は画面を満たしつつ、内容に応じて伸びるようにする。
        contentContainerStyle={scroll ? [styles.grow, contentStyle] : undefined}
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={scroll ? 'handled' : undefined}
      >
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8F4E3', // デフォルト背景（テーマ背景に上書き可）
  },
  fill: {
    flex: 1,
  },
  grow: {
    flexGrow: 1,
  },
});
