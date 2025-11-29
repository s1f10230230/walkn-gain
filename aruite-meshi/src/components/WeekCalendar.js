import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Alert } from 'react-native';
import * as Progress from 'react-native-progress';
import { toDateKeyLocal } from '../utils/calculations';
import { AppIcon } from './AppIcon';
import { useSubscription } from '../contexts/SubscriptionContext';

export default function WeekCalendar({
  theme,
  t,
  styles,
  calendarDates,
  selectedDate,
  onSelectDate,
  onUpgrade,
  weeklyData,
  weeklyDisplayMode,
  goal,
  goalCalories,
  notesMap,
  getWeekdayShort,
  isToday,
  isFuture,
  calendarAnimValues,
  calendarScrollRef,
  handleCalendarScroll,
  handleCalendarScrollEnd,
}) {
  const { isPremium } = useSubscription();

  // 7日前の制限日を計算
  const limitDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6); // 今日を含めて7日
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // 日付がロックされているかチェック
  const isDateLocked = (date) => {
    if (isPremium) return false;
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < limitDate;
  };
  return (
    <View style={{ position: 'relative', zIndex: 20, elevation: 20 }}>
      <ScrollView
        ref={calendarScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.calendarScroll}
        contentContainerStyle={styles.calendarContent}
        onScroll={handleCalendarScroll}
        onScrollEndDrag={handleCalendarScrollEnd}
        scrollEventThrottle={16}
        decelerationRate={0.985}
        snapToInterval={82}
        snapToAlignment="center"
        disableIntervalMomentum={false}
      >
        {calendarDates.map((date, index) => {
          const selected = date.toDateString() === selectedDate.toDateString();
          const today = isToday(date);
          const future = isFuture(date);
          const locked = isDateLocked(date);
          const dateKey = toDateKeyLocal(date);
          const dayData = weeklyData[dateKey];

          const animValue = calendarAnimValues[index] || new Animated.Value(1);
          const scale = animValue;
          const translateY = animValue.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
          const opacity = animValue.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 1] });

          return (
            <Animated.View key={index} style={{ transform: [{ scale }, { translateY }], opacity }}>
              <TouchableOpacity
                onPress={() => {
                  if (future) {
                    Alert.alert("", t("home.futureDateAlert"));
                    return;
                  }
                  if (locked) {
                    onUpgrade?.();
                    return;
                  }
                  onSelectDate(date);
                }}
                style={[
                  styles.calendarItem,
                  selected && styles.calendarItemSelected,
                  today && !selected && { borderWidth: 2, borderColor: theme.isDark ? '#2DD4BF' : '#14B8A6' },
                  {
                    backgroundColor: selected ? (theme.isDark ? '#334155' : '#E2E8F0') : theme.card, // 選択時の背景色を少し濃く
                    borderWidth: selected ? 2 : today ? 2 : 0,
                    borderColor: selected ? '#FF9E57' : today ? (theme.isDark ? '#2DD4BF' : '#14B8A6') : 'transparent',
                  },
                ]}
                disabled={false} // 未来の日付もタップ可能にしてアラートを表示
              >
                <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                  {(() => {
                    const stepsVal = dayData?.steps || 0;
                    const calVal = dayData?.calories || 0;
                    const ratio = (() => {
                      if (weeklyDisplayMode === 'calories') {
                        const denom = goalCalories || 1;
                        return Math.max(0, Math.min(1, calVal / denom));
                      }
                      const dayGoal = dayData?.goal || goal || 1;
                      return Math.max(0, Math.min(1, stepsVal / dayGoal));
                    })();
                    const ringColor = ratio >= 1 ? theme.success : theme.accent;
                    return (
                      <View style={{ alignItems: 'center', justifyContent: 'center', opacity: future || locked ? 0.4 : 1 }}>
                        <Progress.Circle
                          size={34}
                          progress={locked ? 0 : ratio}
                          thickness={3}
                          borderWidth={0}
                          color={ringColor}
                          unfilledColor={theme.circleUnfilled}
                        />
                        {locked ? (
                          <Text style={{ position: 'absolute', fontSize: 14 }}>🔒</Text>
                        ) : (
                          <Text
                            style={[
                              styles.calendarRingDay,
                              { position: 'absolute', color: selected ? theme.text : (future ? theme.textTertiary : theme.textSecondary) },
                            ]}
                          >
                            {date.getDate()}
                          </Text>
                        )}
                        {ratio >= 1 && !locked && (
                          <View style={{ position: 'absolute', top: -10, left: -10 }}>
                            <AppIcon name="trophy" size={14} color={theme.success} />
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
                <Text
                  style={[
                    styles.calendarWeekday,
                    { color: selected ? theme.text : future ? theme.textTertiary : theme.textSecondary },
                  ]}
                >
                  {getWeekdayShort(date)}
                </Text>
                {notesMap[dateKey] && (
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: selected ? '#FFF' : theme.primary,
                      marginVertical: 2,
                    }}
                  />
                )}
                {!future && dayData && (
                  <>
                    {weeklyDisplayMode === 'calories' ? (
                      <Text style={[styles.calendarCalories, { color: selected ? theme.text : theme.textSecondary }]}>
                        {dayData.calories.toFixed(0)} {t('units.kcal')}
                      </Text>
                    ) : (
                      <Text style={[styles.calendarCalories, { color: selected ? theme.text : theme.textSecondary }]}>
                        {dayData.steps >= 1000 ? `${(dayData.steps / 1000).toFixed(1)}k` : dayData.steps} {t('units.steps')}
                      </Text>
                    )}
                  </>
                )}
                {!future && !dayData && (
                  <Text style={[styles.calendarCalories, { color: selected ? theme.text : theme.textSecondary }]}>-</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}
