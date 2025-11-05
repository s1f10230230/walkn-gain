import React from 'react';
import { View, Text, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { getTheme } from '../utils/theme';
import { useI18n } from '../i18n/I18nProvider';

/**
 * 達成済み食べ物リストコンポーネント
 * @param {array} achievedFoods - 達成済み食べ物の配列
 */
export default function AchievedFoodsList({ achievedFoods }) {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { t, formatNumber } = useI18n();

  if (achievedFoods.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.card }] }>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          {t('achievements.noneTitle') || 'まだ食べ物を獲得していません'}
        </Text>
        <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
          {t('achievements.noneSubtitle') || '歩いてカロリーを消費しよう！'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerText, { color: theme.text }]}>
          {t('achievements.today') || '今日の達成'}
        </Text>
        <Text style={[styles.headerCount, { color: theme.primary }]}>
          {formatNumber(achievedFoods.length)}{t('achievements.countUnit') || '個'}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {achievedFoods.map((level, index) => (
          <View
            key={level.level}
            style={[styles.foodCard, { backgroundColor: theme.card }]}
          >
            {/* チェックマーク */}
            <View style={[styles.checkmark, { backgroundColor: theme.primary }]}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>

            {/* 食べ物 */}
            <Text style={styles.foodEmoji}>{level.food.emoji}</Text>
            <Text style={[styles.foodName, { color: theme.text }]}>
              {(() => {
                const key = `food.items.${level.food.id}.name`;
                const tName = t(key);
                return tName === key ? level.food.name : tName;
              })()}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerCount: {
    fontSize: 16,
    fontWeight: '800',
  },
  scrollContent: {
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  foodCard: {
    width: 100,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  foodEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  foodName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  levelBadge: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    fontWeight: '500',
  },
});
