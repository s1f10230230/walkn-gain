import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { calculateCalories, calculateDistance } from '../utils/calculations';
import { getWeatherIcon } from '../utils/weather';

export default function HourlyChart({
  styles,
  theme,
  t,
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
}) {
  const labelHours = [0, 3, 6, 9, 12, 15, 18, 21];
  const weatherHours = [0, 6, 12, 18]; // Display weather at 6-hour intervals

  const title = isToday(selectedDate)
    ? t('home.activity.today')
    : t('home.activity.onDate', { date: formatMonthDay(selectedDate) });

  const maxSteps = Math.max(...hourlySteps, 1);

  return (
    <View style={styles.chartSection}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
        {t('home.chart.hourlyDistribution')}
      </Text>

      {hourlyDetailTooltip.visible && hourlyDetailTooltip.hour >= 0 && (
        <View pointerEvents="none" style={styles.hourlyDetailTooltipWrapper}>
          <View
            style={[
              styles.hourlyDetailTooltip,
              { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.hourlyDetailTooltipTitle, { color: theme.text }]}>
              {hourlyDetailTooltip.hour}:00 - {hourlyDetailTooltip.hour}:59
            </Text>
            <View style={styles.hourlyDetailTooltipRow}>
              <Text style={[styles.hourlyDetailTooltipLabel, { color: theme.textSecondary }]}>歩数:</Text>
              <Text style={[styles.hourlyDetailTooltipValue, { color: theme.primary }]}>
                {(hourlySteps[hourlyDetailTooltip.hour] || 0).toLocaleString()} 歩
              </Text>
            </View>
            <View style={styles.hourlyDetailTooltipRow}>
              <Text style={[styles.hourlyDetailTooltipLabel, { color: theme.textSecondary }]}>カロリー:</Text>
              <Text style={[styles.hourlyDetailTooltipValue, { color: theme.accent }]}>
                {calculateCalories(hourlySteps[hourlyDetailTooltip.hour] || 0, profile.weight).toFixed(1)} kcal
              </Text>
            </View>
            <View style={styles.hourlyDetailTooltipRow}>
              <Text style={[styles.hourlyDetailTooltipLabel, { color: theme.textSecondary }]}>距離:</Text>
              <Text style={[styles.hourlyDetailTooltipValue, { color: theme.success }]}>
                {calculateDistance(hourlySteps[hourlyDetailTooltip.hour] || 0, profile.stride).toFixed(2)} km
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={[styles.chartCard, { backgroundColor: theme.card }]}>
        <View style={styles.chartWithAxis}>
          <View style={styles.yAxis}>
            {(() => {
              const yLabels = [
                {
                  value: maxSteps,
                  label: maxSteps >= 1000 ? `${(maxSteps / 1000).toFixed(1)}k` : maxSteps,
                },
                {
                  value: maxSteps * 0.5,
                  label:
                    maxSteps >= 2000 ? `${((maxSteps * 0.5) / 1000).toFixed(1)}k` : Math.round(maxSteps * 0.5),
                },
                { value: 0, label: '0' },
              ];
              return yLabels.map((item, i) => (
                <Text key={i} style={[styles.yAxisLabel, { color: theme.textSecondary }]}>
                  {item.label}
                </Text>
              ));
            })()}
          </View>
              <View style={styles.chartArea}>
                {/* Weather Icons Row */}
                {hourlyWeather && hourlyWeather.length === 24 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 }}>
                    {weatherHours.map((hour) => {
                      const weatherCode = hourlyWeather[hour];
                      const icon = weatherCode !== null && weatherCode !== undefined ? getWeatherIcon(weatherCode) : '';
                      return (
                        <View key={hour} style={{ flex: 1, alignItems: 'center' }}>
                          <Text style={{ fontSize: 18 }}>{icon}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
                <View style={styles.chart} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
                {hourlySteps.map((count, hour) => {
                  const heightPct = (count / maxSteps) * 100;
                  const isSelectedToday = selectedDate.toDateString() === new Date().toDateString();
                  const currentHour = new Date().getHours();
                  const isCurrentHour = isSelectedToday && hour === currentHour;
                  const isMaxBar = count === maxSteps && count > 0;
                    const shouldShowLabel = labelHours.includes(hour);

                    return (
                      <View key={hour} style={styles.barContainer}>
                        <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.barTouchable}
                      hitSlop={{ top: 6, bottom: 10, left: 4, right: 4 }}
                      onPress={() => {
                        try { if (hourlyDetailTimerRef.current) clearTimeout(hourlyDetailTimerRef.current); } catch (_) {}
                        setHourlyDetailTooltip({ visible: true, hour });
                        hourlyDetailTimerRef.current = setTimeout(
                          () => setHourlyDetailTooltip({ visible: false, hour: -1 }),
                          1800
                        );
                      }}
                    >
                      <View style={styles.barWrapper}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${Math.max(2, heightPct)}%`,
                            backgroundColor: isMaxBar
                              ? theme.primary
                              : isCurrentHour
                              ? theme.success
                              : theme.chartBar,
                          },
                        ]}
                      />
                    </View>
                      <Text
                        style={[
                          styles.hourLabel,
                          { color: isCurrentHour ? theme.primary : theme.textSecondary, opacity: shouldShowLabel ? 1 : 0 },
                        ]}
                      >
                        {shouldShowLabel ? hour : ''}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
