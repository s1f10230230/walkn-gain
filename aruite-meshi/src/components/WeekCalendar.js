import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated } from 'react-native';
import * as Progress from 'react-native-progress';

export default function WeekCalendar({
  theme,
  t,
  styles,
  calendarDates,
  selectedDate,
  onSelectDate,
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
  return (
    <View style={{ position: 'relative' }}>
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
          const dateKey = date.toISOString().split('T')[0];
          const dayData = weeklyData[dateKey];

          const animValue = calendarAnimValues[index] || new Animated.Value(1);
          const scale = animValue;
          const translateY = animValue.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
          const opacity = animValue.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 1] });

          return (
            <Animated.View key={index} style={{ transform: [{ scale }, { translateY }], opacity }}>
              <TouchableOpacity
                onPress={() => !future && onSelectDate(date)}
                style={[
                  styles.calendarItem,
                  selected && styles.calendarItemSelected,
                  today && !selected && { borderWidth: 2, borderColor: theme.isDark ? '#2DD4BF' : '#14B8A6' },
                  {
                    backgroundColor: theme.card,
                    borderWidth: selected ? 2 : today ? 2 : 0,
                    borderColor: selected ? '#FF9E57' : today ? (theme.isDark ? '#2DD4BF' : '#14B8A6') : 'transparent',
                  },
                ]}
                disabled={future}
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
                      <View style={{ alignItems: 'center', justifyContent: 'center', opacity: future ? 0.4 : 1 }}>
                        <Progress.Circle
                          size={34}
                          progress={ratio}
                          thickness={3}
                          borderWidth={0}
                          color={ringColor}
                          unfilledColor={theme.circleUnfilled}
                        />
                        <Text
                          style={[
                            styles.calendarRingDay,
                            { position: 'absolute', color: selected ? theme.text : (future ? theme.textTertiary : theme.textSecondary) },
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                        {ratio >= 1 && (
                          <Text style={{ position: 'absolute', top: -8, left: -8, fontSize: 12 }}>🏆</Text>
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
