import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function StatsCards({
  styles,
  theme,
  t,
  activeTab,
  steps,
  calories,
  goal,
  goalCalories,
  formatNumber,
  navigation,
}) {
  return (
    <View style={styles.statsRow}>
      {activeTab === 'steps' ? (
        <>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              {t('home.stats.steps')}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatNumber(steps)}
            </Text>
            <Text style={[styles.statSubtext, { color: theme.textSecondary }]}>
              {t('home.labels.goal')}: <Text style={{ color: theme.accent, fontWeight: '600' }}>{formatNumber(goal)}</Text> {t('units.steps')}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              {t('home.stats.calories')}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatNumber(Math.round(calories))}
            </Text>
            <Text style={[styles.statSubtext, { color: theme.textSecondary }]}>
              {t('home.stats.kcalBurnedLabel')}
            </Text>
          </View>
        </>
      ) : (
        <>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              {t('home.stats.calories')}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatNumber(Math.round(calories))}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('home.labels.goal')}
              onPress={() => navigation?.navigate && navigation.navigate('Settings')}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={[styles.statSubtext, { color: theme.textSecondary }]}>
                {t('home.labels.goal')}: <Text style={{ color: theme.accent, fontWeight: '600' }}>{goalCalories}</Text> {t('units.kcal')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              {t('home.stats.steps')}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatNumber(steps)}
            </Text>
            <Text style={[styles.statSubtext, { color: theme.textSecondary }]}>
              {t('home.stats.steps')}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

