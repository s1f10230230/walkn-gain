import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FlipCard from './FlipCard';
import PaperTexture from './PaperTexture';
import ProgressRing from './ProgressRing';
import AchievementStamp from './AchievementStamp';
import HourlyChart from './HourlyChart';
import DiaryCard from './DiaryCard';
import homeStyles from '../screens/home/styles';

const COLORS = {
  teal: '#00A896',
  orange: '#FF6B35',
  textGray: '#9CA5B5',
};

export default function DataFlipCard({
  theme,
  t,
  selectedDate,
  steps,
  calories,
  distance,
  progress,
  hourlySteps,
  hourlyWeather,
  profile,
  bumpAnim,
  pulseAnim,
  isToday,
  formatMonthDay,
  formatNumber,
  clamp01,
  setChartWidth,
  todayEvents = [],
  isFlipped = false,
  onFlipChange,
}) {
  const [hourlyDetailTooltip, setHourlyDetailTooltip] = useState({ visible: false, hour: -1 });
  const hourlyDetailTimerRef = React.useRef(null);

  const ringP = clamp01(progress);
  const ringColor = ringP >= 1.0 ? theme.success : theme.accent;

  // ============================================
  // 表面（歩数データ）
  // ============================================
  const frontCard = (
    <View style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF' }]}>
      <PaperTexture isDark={theme.isDark} />

      {/* タイトル */}
      <Text style={[styles.cardTitle, { color: COLORS.teal }]}>TODAY'S STEPS</Text>

      {/* 円形プログレス */}
      <View style={styles.ringContainer}>
        <AchievementStamp visible={ringP >= 1.0} theme={theme} />
        <View style={[styles.ringBackground, { backgroundColor: theme.card }]}>
          <ProgressRing
            size={180}
            progress={ringP}
            color={ringColor}
            unfilledColor={ringP >= 0.999 ? 'transparent' : theme.circleUnfilled}
            thickness={10}
            bumpAnim={bumpAnim}
            pulseAnim={pulseAnim}
          />
          <View style={styles.ringCenter}>
            <Text style={[styles.stepsText, { color: theme.text }]}>
              {formatNumber(steps)}
            </Text>
            <Text style={[styles.stepsLabel, { color: theme.textSecondary }]}>
              {t('units.steps')}
            </Text>
            <Text style={[styles.progressText, { color: theme.textSecondary }]}>
              {t('home.progress.rate')}: {Math.round(ringP * 100)}%
            </Text>
          </View>
        </View>
      </View>

      {/* カロリー・距離 */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="fire" size={20} color={COLORS.orange} />
          <Text style={[styles.statValue, { color: theme.text }]}>{calories.toFixed(0)}</Text>
          <Text style={[styles.statUnit, { color: theme.textSecondary }]}>{t('units.kcal')}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="map-marker-distance" size={20} color={COLORS.teal} />
          <Text style={[styles.statValue, { color: theme.text }]}>{distance.toFixed(1)}</Text>
          <Text style={[styles.statUnit, { color: theme.textSecondary }]}>km</Text>
        </View>
      </View>

      {/* 時間帯別グラフ */}
      <HourlyChart
        styles={homeStyles}
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
        hideTitle={true}
      />

      {/* フリップヒント */}
      <View style={styles.flipHint}>
        <MaterialCommunityIcons name="rotate-3d-variant" size={14} color={COLORS.textGray} />
        <Text style={styles.flipHintText}>長押しで裏面へ</Text>
      </View>
    </View>
  );

  // ============================================
  // 裏面（DiaryCardを使用）
  // ============================================
  const backCard = (
    <DiaryCard
      theme={theme}
      selectedDate={selectedDate}
      steps={steps}
      calories={calories}
      distance={distance}
      todayEvents={todayEvents}
      formatNumber={formatNumber}
      showFlipHint={true}
      flipHintText="長押しで表面へ"
    />
  );

  return (
    <FlipCard
      front={frontCard}
      back={backCard}
      isFlipped={isFlipped}
      onFlipChange={onFlipChange}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    shadowColor: '#8B8178',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E8E4DF',
    borderLeftWidth: 3,
    borderLeftColor: '#E0DCD6',
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'Roboto',
    letterSpacing: 1,
  },
  ringContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  ringBackground: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  stepsText: {
    fontSize: 36,
    fontWeight: '900',
  },
  stepsLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressText: {
    fontSize: 12,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 40,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    marginLeft: 6,
    fontSize: 18,
    fontWeight: '700',
  },
  statUnit: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 18,
    opacity: 0.4,
  },
  flipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8E4DF',
  },
  flipHintText: {
    fontSize: 11,
    color: '#9CA5B5',
    marginLeft: 4,
    fontWeight: '500',
  },
});
