import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { getTheme } from '../utils/theme';
import { useI18n } from '../i18n/I18nProvider';

/**
 * 経験値バー風の食べ物レベル進捗コンポーネント
 * @param {object} nextLevel - 次のレベル情報
 * @param {number} currentCalories - 現在のカロリー
 * @param {number} progress - 進捗率 (0.0 ~ 1.0)
 * @param {number} remainingCalories - 残りカロリー
 * @param {number} remainingSteps - 残り歩数
 */
export default function FoodLevelProgress({
  nextLevel,
  currentCalories,
  progress,
  remainingCalories,
  remainingSteps
}) {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { t, formatNumber } = useI18n();

  const achievedLevels = Math.floor(currentCalories / 150);
  const currentLevelCalories = currentCalories - (achievedLevels * 150);

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {/* ヘッダー: 次の目標 */}
      <View style={styles.header}>
        <Text style={[styles.levelText, { color: theme.textSecondary }]}>
          {t('goals.next') || '次の目標'}
        </Text>
      </View>

      {/* 食べ物表示 */}
      <View style={styles.foodDisplay}>
        <Text style={styles.foodEmoji}>{nextLevel.food.emoji}</Text>
        <View style={styles.foodInfo}>
          <Text style={[styles.foodName, { color: theme.text }]}>
            {(() => {
              const key = `food.items.${nextLevel.food.id}.name`;
              const tName = t(key);
              return tName === key ? nextLevel.food.name : tName;
            })()}
          </Text>
          <Text style={[styles.foodCalories, { color: theme.textSecondary }]}>
            {nextLevel.food.calories}kcal
          </Text>
        </View>
      </View>

      {/* プログレスバー */}
      <View style={styles.progressSection}>
        <View style={[styles.progressBarContainer, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(progress * 100, 100)}%`,
                backgroundColor: theme.primary
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
            {formatNumber(currentLevelCalories)} / {formatNumber(nextLevel.targetCalories)} {t('units.kcal') || 'kcal'}
          </Text>
          <Text style={[styles.progressPercent, { color: theme.primary }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      </View>

      {/* 残り情報 */}
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
    </View>
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
    marginBottom: 16,
    gap: 8,
  },
  levelBadge: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600',
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
});
