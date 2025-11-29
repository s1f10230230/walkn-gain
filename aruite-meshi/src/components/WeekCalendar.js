import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Alert, StyleSheet, Dimensions } from 'react-native';
import { toDateKeyLocal } from '../utils/calculations';
import { useSubscription } from '../contexts/SubscriptionContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// カラー定義
const COLORS = {
  teal: '#00A896',
  orange: '#FF6B35',
  success: '#16A34A',
};

export default function WeekCalendar({
  theme,
  t,
  styles: externalStyles,
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
    d.setDate(d.getDate() - 6);
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

  // 曜日を3文字で取得
  const getDayName = (date) => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return days[date.getDay()];
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={calendarScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleCalendarScroll}
        onScrollEndDrag={handleCalendarScrollEnd}
        scrollEventThrottle={16}
        decelerationRate={0.985}
        snapToInterval={60}
        snapToAlignment="center"
      >
        {calendarDates.map((date, index) => {
          const selected = date.toDateString() === selectedDate.toDateString();
          const today = isToday(date);
          const future = isFuture(date);
          const locked = isDateLocked(date);
          const dateKey = toDateKeyLocal(date);
          const dayData = weeklyData[dateKey];

          // 達成率を計算
          const stepsVal = dayData?.steps || 0;
          const dayGoal = dayData?.goal || goal || 10000;
          const isGoalAchieved = stepsVal >= dayGoal && !future && !locked;

          const animValue = calendarAnimValues[index] || new Animated.Value(1);

          return (
            <Animated.View
              key={index}
              style={[
                styles.dayContainer,
                {
                  opacity: animValue,
                  transform: [{ scale: animValue }],
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  if (future) {
                    Alert.alert('', t('home.futureDateAlert'));
                    return;
                  }
                  if (locked) {
                    onUpgrade?.();
                    return;
                  }
                  onSelectDate(date);
                }}
                style={styles.dayButton}
                activeOpacity={0.7}
              >
                {/* 曜日 */}
                <Text
                  style={[
                    styles.dayName,
                    {
                      color: selected
                        ? COLORS.orange
                        : future || locked
                        ? theme.textTertiary
                        : theme.textSecondary,
                      fontWeight: selected ? '700' : '600',
                    },
                  ]}
                >
                  {getDayName(date)}
                </Text>

                {/* 日付サークル */}
                <View
                  style={[
                    styles.dateCircle,
                    selected && styles.dateCircleSelected,
                    today && !selected && styles.dateCircleToday,
                    { opacity: future || locked ? 0.4 : 1 },
                  ]}
                >
                  {locked ? (
                    <Text style={styles.lockIcon}>🔒</Text>
                  ) : (
                    <Text
                      style={[
                        styles.dateNumber,
                        {
                          color: selected
                            ? '#FFF'
                            : future
                            ? theme.textTertiary
                            : theme.text,
                        },
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  )}
                </View>

                {/* 達成ドット */}
                <View style={styles.dotContainer}>
                  {!future && !locked && (
                    <View
                      style={[
                        styles.progressDot,
                        {
                          backgroundColor: isGoalAchieved
                            ? COLORS.success
                            : theme.border,
                        },
                      ]}
                    />
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_WIDTH / 2 - 30,
    alignItems: 'center',
    gap: 8,
  },
  dayContainer: {
    width: 52,
    alignItems: 'center',
  },
  dayButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayName: {
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dateCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dateCircleSelected: {
    backgroundColor: COLORS.orange,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  dateCircleToday: {
    borderWidth: 2,
    borderColor: COLORS.teal,
  },
  dateNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  lockIcon: {
    fontSize: 14,
  },
  dotContainer: {
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
