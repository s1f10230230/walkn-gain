import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, PanResponder } from 'react-native';
import { getWeatherIconName } from '../utils/weather';
import { AppIcon } from './AppIcon';

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
  hideTitle = false,
}) {
  const labelHours = [0, 3, 6, 9, 12, 15, 18, 21];
  const weatherHours = [0, 6, 12, 18]; // Display weather at 6-hour intervals
  const chartWidthRef = useRef(0);

  const title = isToday(selectedDate)
    ? t('home.activity.today')
    : t('home.activity.onDate', { date: formatMonthDay(selectedDate) });

  const safeHourlySteps = hourlySteps || Array(24).fill(0);
  const maxSteps = Math.max(...safeHourlySteps, 1);

  // タッチ位置から時間を計算
  const getHourFromX = useCallback((x) => {
    if (chartWidthRef.current <= 0) return -1;
    const hour = Math.floor((x / chartWidthRef.current) * 24);
    return Math.max(0, Math.min(23, hour));
  }, []);

  // スライドジェスチャー用のPanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // 横方向の動きが大きい場合のみキャプチャ
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const hour = getHourFromX(x);
        if (hour >= 0) {
          if (hourlyDetailTimerRef.current) clearTimeout(hourlyDetailTimerRef.current);
          setHourlyDetailTooltip({ visible: true, hour });
        }
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const hour = getHourFromX(x);
        if (hour >= 0 && hour !== hourlyDetailTooltip.hour) {
          if (hourlyDetailTimerRef.current) clearTimeout(hourlyDetailTimerRef.current);
          setHourlyDetailTooltip({ visible: true, hour });
        }
      },
      onPanResponderRelease: () => {
        // 指を離したら3秒後に非表示
        hourlyDetailTimerRef.current = setTimeout(
          () => setHourlyDetailTooltip({ visible: false, hour: -1 }),
          3000
        );
      },
    })
  ).current;

  return (
    <View style={styles.chartSection}>
      {!hideTitle && (
        <>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
            {t('home.chart.hourlyDistribution')}
          </Text>
        </>
      )}

      <View style={[styles.chartCard, { backgroundColor: 'transparent' }]}>
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
                      const iconName = weatherCode !== null && weatherCode !== undefined ? getWeatherIconName(weatherCode) : null;
                      return (
                        <View key={hour} style={{ flex: 1, alignItems: 'center' }}>
                          {iconName ? (
                            <AppIcon name={iconName} size={26} color={theme.isDark ? '#F0F0F0' : theme.text} />
                          ) : (
                            <Text style={{ fontSize: 18 }}> </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
                <View
                  style={styles.chart}
                  onLayout={(e) => {
                    const width = e.nativeEvent.layout.width;
                    setChartWidth(width);
                    chartWidthRef.current = width;
                  }}
                  {...panResponder.panHandlers}
                >
                {safeHourlySteps.map((count, hour) => {
                  const heightPct = (count / maxSteps) * 100;
                  const isSelectedToday = selectedDate.toDateString() === new Date().toDateString();
                  const currentHour = new Date().getHours();
                  const isCurrentHour = isSelectedToday && hour === currentHour;
                  const isMaxBar = count === maxSteps && count > 0;
                  const shouldShowLabel = labelHours.includes(hour);
                  const isSelected = hourlyDetailTooltip.visible && hourlyDetailTooltip.hour === hour;

                    return (
                      <View key={hour} style={styles.barContainer}>
                        <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.barTouchable}
                      hitSlop={{ top: 6, bottom: 10, left: 4, right: 4 }}
                      onPress={() => {
                        try { if (hourlyDetailTimerRef.current) clearTimeout(hourlyDetailTimerRef.current); } catch (_) {}
                        // 同じバーをタップしたら非表示に
                        if (isSelected) {
                          setHourlyDetailTooltip({ visible: false, hour: -1 });
                        } else {
                          setHourlyDetailTooltip({ visible: true, hour });
                          hourlyDetailTimerRef.current = setTimeout(
                            () => setHourlyDetailTooltip({ visible: false, hour: -1 }),
                            3000
                          );
                        }
                      }}
                    >
                      {/* 選択時の歩数ラベル */}
                      {isSelected && (
                        <View style={{
                          position: 'absolute',
                          top: -24,
                          left: -20,
                          right: -20,
                          alignItems: 'center',
                          zIndex: 10,
                        }}>
                          <View style={{
                            backgroundColor: theme.primary,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 8,
                          }}>
                            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                              {count.toLocaleString()}
                            </Text>
                          </View>
                        </View>
                      )}
                      <View style={styles.barWrapper}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${Math.max(2, heightPct)}%`,
                            backgroundColor: isSelected
                              ? theme.primary // Orange for selected
                              : isMaxBar
                              ? theme.primary // Orange for max
                              : isCurrentHour
                              ? theme.success // Bright Teal for current
                              : theme.accent, // Teal for others
                            opacity: isSelected ? 1 : 0.9,
                            width: '75%',
                            borderTopLeftRadius: 4,
                            borderTopRightRadius: 4,
                            borderRadius: 0,
                            transform: isSelected ? [{ scaleX: 1.2 }] : [],
                          },
                        ]}
                      />
                    </View>
                      <Text
                        style={[
                          styles.hourLabel,
                          {
                            color: isSelected ? theme.primary : isCurrentHour ? theme.primary : theme.textSecondary,
                            opacity: shouldShowLabel || isSelected ? 1 : 0,
                            fontWeight: isSelected ? '700' : '400',
                          },
                        ]}
                      >
                        {isSelected ? hour : shouldShowLabel ? hour : ''}
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
