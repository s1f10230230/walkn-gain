import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { AppIcon } from './AppIcon';
import ProgressRing from './ProgressRing';
import HourlyChart from './HourlyChart';
import ShareCTA from './ShareCTA';

// ============================================
// ヘルパー関数
// ============================================
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const formatNumber = (num) => {
  if (num >= 10000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toLocaleString();
};

// ============================================
// DataPage Component
// ============================================
export default function DataPage({
  theme,
  t,
  styles: externalStyles,
  // Steps & Progress
  steps,
  goal,
  progress,
  calories,
  distance,
  // Animations
  bumpAnim,
  pulseAnim,
  // Glow
  glowSizes,
  glowColors,
  // Hourly Chart
  isToday,
  selectedDate,
  formatMonthDay,
  hourlyDetailTooltip,
  setHourlyDetailTooltip,
  hourlyDetailTimerRef,
  hourlySteps,
  hourlyWeather,
  profile,
  setChartWidth,
  // Navigation
  navigation,
  // Feedback
  dailyFeedback,
  // Actions
  onLongPressRing,
}) {
  const { width: screenWidth } = useWindowDimensions();
  const ringP = clamp01(progress);
  const isFull = ringP >= 0.999;
  const ringColor = ringP >= 1.0 ? theme.success : theme.accent;

  return (
    <ScrollView
      style={[styles.container, { width: screenWidth }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================
          ⭕ プログレスリング
          ============================================ */}
      <View style={styles.circleContainer}>
        {/* グロー効果 */}
        <View style={styles.glowWrapper} pointerEvents="none">
          {(glowSizes || [])
            .map((size, index) => ({
              size,
              color: (glowColors || [])[index],
            }))
            .sort((a, b) => b.size - a.size)
            .map(({ size, color }, idx) => (
              <View
                key={`glow-${size}-${idx}`}
                style={[
                  styles.glow,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color || 'rgba(255, 107, 53, 0.03)',
                  },
                ]}
              />
            ))}
        </View>

        {/* リング */}
        <TouchableOpacity activeOpacity={1} onLongPress={onLongPressRing}>
          <View
            style={[
              styles.circleBackground,
              { backgroundColor: theme.card, shadowColor: theme.shadow },
            ]}
          >
            <ProgressRing
              size={200}
              progress={ringP}
              color={ringColor}
              unfilledColor={isFull ? 'transparent' : theme.circleUnfilled}
              thickness={12}
              bumpAnim={bumpAnim}
              pulseAnim={pulseAnim}
            />
            <View style={styles.circleCenter}>
              <Text style={[styles.percentText, { color: theme.text }]}>
                {formatNumber(steps)}
              </Text>
              <Text style={[styles.goalLabel, { color: theme.textSecondary }]}>
                {t('units.steps')}
              </Text>
              <Text style={[styles.progressSubtext, { color: theme.textSecondary }]}>
                {t('home.progress.rate')}: {Math.round(ringP * 100)}%
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* ============================================
          📊 カロリー・距離
          ============================================ */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <AppIcon name="flame" size={18} color={theme.primary} />
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {calories.toFixed(0)}
          </Text>
          <Text style={[styles.metricUnit, { color: theme.textSecondary }]}>
            {t('units.kcal')}
          </Text>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
        <View style={styles.metricItem}>
          <AppIcon name="location" size={18} color={theme.accent} />
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {distance.toFixed(1)}
          </Text>
          <Text style={[styles.metricUnit, { color: theme.textSecondary }]}>
            km
          </Text>
        </View>
      </View>

      {/* ============================================
          🔗 シェアボタン
          ============================================ */}
      <View style={styles.shareRow}>
        <ShareCTA
          selectedDate={selectedDate}
          steps={steps}
          goal={goal}
          navigation={navigation}
          theme={theme}
          t={t}
        />
      </View>

      {/* ============================================
          📈 時間別グラフ
          ============================================ */}
      <HourlyChart
        styles={externalStyles}
        theme={theme}
        t={t}
        isToday={isToday}
        selectedDate={selectedDate}
        formatMonthDay={formatMonthDay}
        hourlyDetailTooltip={hourlyDetailTooltip}
        setHourlyDetailTooltip={setHourlyDetailTooltip}
        hourlyDetailTimerRef={hourlyDetailTimerRef}
        hourlySteps={hourlySteps}
        hourlyWeather={hourlyWeather}
        profile={profile}
        setChartWidth={setChartWidth}
      />

      {/* ============================================
          💡 フィードバック
          ============================================ */}
      {dailyFeedback && (
        <View style={styles.feedbackContainer}>
          <View style={[styles.feedbackCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.feedbackHeader}>
              <AppIcon name="lightbulb" size={18} color={theme.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.feedbackLabel, { color: theme.textSecondary }]}>
                昨日のフィードバック
              </Text>
            </View>
            <Text style={[styles.feedbackText, { color: theme.text }]}>
              {dailyFeedback}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ============================================
// スタイル
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },

  // プログレスリング
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  glowWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  circleBackground: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  circleCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontSize: 36,
    fontWeight: '700',
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  progressSubtext: {
    fontSize: 12,
    marginTop: 4,
  },

  // メトリクス
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    gap: 24,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricValue: {
    marginLeft: 6,
    fontSize: 15,
    fontWeight: '600',
  },
  metricUnit: {
    marginLeft: 3,
    fontSize: 13,
  },
  metricDivider: {
    width: 1,
    height: 16,
  },

  // シェアボタン
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 12,
  },

  // フィードバック
  feedbackContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  feedbackCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedbackLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
});
