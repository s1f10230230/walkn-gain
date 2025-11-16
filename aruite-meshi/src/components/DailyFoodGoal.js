import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, useColorScheme } from 'react-native';
import { getTheme } from '../utils/theme';
import { useI18n } from '../i18n/I18nProvider';

/**
 * 今日の食べ物目標コンポーネント
 * @param {object} currentGoal - 現在の目標
 * @param {number} currentCalories - 現在のカロリー
 * @param {boolean} achieved - 目標達成したか
 * @param {number} remainingCalories - 残りカロリー
 * @param {number} remainingSteps - 残り歩数
 */
export default function DailyFoodGoal({
  currentGoal,
  currentCalories,
  achieved,
  remainingCalories,
  remainingSteps,
  level,
  totalLevels,
  nextGoal,
}) {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { t, formatNumber } = useI18n();

  const progress = Math.min(currentCalories / currentGoal.food.calories, 1.0);

  // 軽いフェードイン（目標切替時）
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    try { fade.setValue(0); } catch (_) {}
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [currentGoal?.food?.calories, currentGoal?.food?.id]);

  return (
    <Animated.View style={[
      styles.container,
      {
        backgroundColor: theme.card,
        opacity: fade,
        transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
      }
    ]}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {typeof level === 'number' && typeof totalLevels === 'number' && (
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Lv {level}/{Math.max(totalLevels, level)}</Text>
            </View>
          )}
          {achieved && (
            <View style={[styles.achievedBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.achievedText}>✓ {t('goals.achieved') || '達成'}</Text>
            </View>
          )}
        </View>
      </View>

      {/* 食べ物表示 */}
      <View style={styles.foodDisplay}>
        <Text style={styles.foodEmoji}>{currentGoal.food.emoji}</Text>
        <View style={styles.foodInfo}>
          <Text style={[styles.foodName, { color: theme.text }]}>
            {(() => {
              const key = `food.items.${currentGoal.food.id}.name`;
              const tName = t(key);
              return tName === key ? currentGoal.food.name : tName;
            })()}
          </Text>
          <Text style={[styles.foodCalories, { color: theme.textSecondary }]}>
            {currentGoal.food.calories}kcal
          </Text>
        </View>
      </View>

      {/* プログレスバー */}
      <View style={styles.progressSection}>
        <View
          style={[
            styles.progressBarContainer,
            { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
          ]}
        >
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(progress * 100, 100)}%`,
                backgroundColor: achieved ? '#4CAF50' : theme.primary
              }
            ]}
          >
            {/* シャイン効果 */}
            <View style={[styles.progressShine, { backgroundColor: '#FFF' }]} />
          </View>
        </View>

        {/* 進捗テキスト */}
        <View style={styles.progressText}>
          <Text style={[styles.progressLabel, { color: theme.text }]}>
            {formatNumber(Math.round(currentCalories))} / {formatNumber(currentGoal.food.calories)} {t('units.kcal') || 'kcal'}
          </Text>
          <Text style={[styles.progressPercent, { color: achieved ? '#4CAF50' : theme.primary }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      </View>

      {/* 残り情報 */}
      {!achieved && (
        <View style={styles.remainingInfo}>
          <View style={styles.remainingItem}>
            <Text style={[styles.remainingLabel, { color: theme.textSecondary }]}>
              {t('labels.remaining') || 'あと'}
            </Text>
            <Text style={[styles.remainingValue, { color: theme.primary }]}>
              {formatNumber(Math.ceil(remainingCalories))} {t('units.kcal') || 'kcal'}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.remainingItem}>
            <Text style={[styles.remainingLabel, { color: theme.textSecondary }]}>
              {t('labels.about') || '約'}
            </Text>
            <Text style={[styles.remainingValue, { color: theme.accent }]}>
              {formatNumber(Math.ceil(remainingSteps))} {t('units.steps') || '歩'}
            </Text>
          </View>
        </View>
      )}

      {/* 次の目標（最大レベルでない場合のみ表示） */}
      {nextGoal && level < totalLevels && (
        <View style={{ marginTop: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>
            {t('goals.next') || '次'}: {formatNumber(nextGoal.food.calories)} {t('units.kcal') || 'kcal'} · {(() => {
              const key = `food.items.${nextGoal.food.id}.name`;
              const tName = t(key);
              return tName === key ? nextGoal.food.name : tName;
            })()}
          </Text>
        </View>
      )}

      {/* 達成メッセージ */}
      {achieved && (
        <View style={[styles.achievedMessage, { backgroundColor: '#E8F5E9' }]}>
          <Text style={[styles.achievedMessageText, { color: '#2E7D32' }]}>
            🎉 おめでとうございます！もっと歩いて次のレベルに挑戦！
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  achievedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  achievedText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)'
  },
  levelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#424242',
  },
  foodDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  foodEmoji: {
    fontSize: 56,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  foodCalories: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressBarContainer: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  progressShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    opacity: 0.3,
    borderRadius: 6,
  },
  progressText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: '800',
  },
  remainingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  remainingItem: {
    alignItems: 'center',
    flex: 1,
  },
  remainingLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  remainingValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  divider: {
    width: 1,
    height: 32,
    opacity: 0.2,
  },
  achievedMessage: {
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  achievedMessageText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
