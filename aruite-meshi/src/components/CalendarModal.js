import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTheme } from '../utils/theme';
import { useI18n } from '../i18n/I18nProvider';
import { useSubscription, isDateWithinLimit } from '../contexts/SubscriptionContext';
import { getDailyData, getMultipleDaysData } from '../utils/storage';
import { toDateKeyLocal } from '../utils/calculations';
import { AppIcon } from './AppIcon';

const serifFont = Platform.select({ ios: 'Georgia', android: 'serif' });

export default function CalendarModal({ visible, onClose, onSelectDate, initialDate, onUpgrade }) {
  const theme = getTheme();
  const { t } = useI18n();
  const { isPremium, limits, presentPaywall } = useSubscription();
  const { width: screenWidth } = useWindowDimensions();
  const modalWidth = Math.min(screenWidth - 40, 360);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthlyData, setMonthlyData] = useState({});

  // 歩数データの閲覧は無期限（カレンダーでのロックなし）
  const isDateLocked = () => false;

  useEffect(() => {
    if (visible && initialDate) {
      setCurrentMonth(new Date(initialDate));
    }
  }, [visible, initialDate]);

  useEffect(() => {
    if (visible) {
      loadMonthlyData();
    }
  }, [currentMonth, visible]);

  const loadMonthlyData = async () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get all days in month
    const date = new Date(year, month, 1);
    const dates = [];
    while (date.getMonth() === month) {
      dates.push(toDateKeyLocal(date));
      date.setDate(date.getDate() + 1);
    }

    const data = await getMultipleDaysData(dates);
    const dataMap = {};
    data.forEach(day => {
      if (day && day.date) {
        dataMap[day.date] = day;
      }
    });
    setMonthlyData(dataMap);
  };

  const changeMonth = (delta) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentMonth(newDate);
  };

  const renderCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

    const days = [];
    
    // Empty slots for previous month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    const weeks = [];
    let week = [];
    days.forEach((day, index) => {
      week.push(day);
      if ((index + 1) % 7 === 0 || index === days.length - 1) {
        weeks.push(week);
        week = [];
      }
    });

    return (
      <View style={styles.calendarContainer}>
        {/* Weekday Headers */}
        <View style={styles.weekRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <Text key={i} style={[styles.weekdayText, i === 0 && { color: '#FF6B35' }, i === 6 && { color: '#00A896' }]}>
              {d}
            </Text>
          ))}
        </View>

        {/* Calendar Rows */}
        {weeks.map((week, wIndex) => (
          <View key={wIndex} style={styles.weekRow}>
            {week.map((date, dIndex) => {
              if (!date) return <View key={dIndex} style={styles.dayCell} />;
              
              const dateKey = toDateKeyLocal(date);
              const dayData = monthlyData[dateKey];
              const isToday = toDateKeyLocal(new Date()) === dateKey;
              const isSelected = initialDate && toDateKeyLocal(initialDate) === dateKey;
              
              const steps = dayData?.steps || 0;
              const goal = dayData?.goal || 10000;
              const calories = dayData?.calories || 0;
              const goalCalories = dayData?.goalCalories || 500;
              
              const stepsAchieved = steps >= goal;
              const caloriesAchieved = calories >= goalCalories;

              const locked = isDateLocked(date);

              return (
                <TouchableOpacity
                  key={dIndex}
                  style={[
                    styles.dayCell,
                    isSelected && styles.selectedDayCell,
                    locked && styles.lockedDayCell
                  ]}
                  onPress={() => {
                    if (locked) {
                      onClose();
                      presentPaywall();
                    } else {
                      onSelectDate(date);
                    }
                  }}
                >
                  {/* Achievement Background Circle */}
                  {stepsAchieved && !locked && (
                    <View style={[
                      styles.achievementCircle,
                      { backgroundColor: 'rgba(255, 107, 53, 0.15)' }
                    ]} />
                  )}

                  {locked ? (
                    <Text style={styles.lockIcon}>🔒</Text>
                  ) : (
                    <Text style={[
                      styles.dayText,
                      isToday && styles.todayText,
                      isSelected && styles.selectedDayText,
                      stepsAchieved && { color: theme.primary, fontWeight: 'bold' }
                    ]}>
                      {date.getDate()}
                    </Text>
                  )}

                  {/* Indicators */}
                  {!locked && (
                    <View style={styles.indicatorsRow}>
                      {caloriesAchieved && (
                        <View style={[styles.dot, { backgroundColor: theme.success }]} />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            {/* Fill remaining empty cells in the last week */}
            {week.length < 7 && [...Array(7 - week.length)].map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.container, { backgroundColor: '#FFFDF9', width: modalWidth }]}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navButton}>
                  <AppIcon name="arrow-left" size={20} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                  {currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
                </Text>
                <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navButton}>
                  <AppIcon name="arrow-right" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* Calendar */}
              {renderCalendarGrid()}

              {/* Legend / Footer */}
              <View style={styles.footer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: 'rgba(255, 107, 53, 0.3)' }]} />
                  <Text style={styles.legendText}>Goal Reached</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>CLOSE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthTitle: {
    fontSize: 18,
    fontFamily: serifFont,
    fontWeight: '600',
    color: '#333',
    letterSpacing: 1,
  },
  navButton: {
    padding: 8,
  },
  calendarContainer: {
    marginBottom: 20,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayText: {
    width: 40,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: serifFont,
    color: '#999',
    fontWeight: '600',
  },
  dayCell: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  selectedDayCell: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
  },
  lockedDayCell: {
    opacity: 0.5,
  },
  lockIcon: {
    fontSize: 14,
  },
  achievementCircle: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dayText: {
    fontSize: 16,
    fontFamily: serifFont,
    color: '#333',
  },
  todayText: {
    color: '#00A896',
    fontWeight: 'bold',
  },
  selectedDayText: {
    color: '#333',
  },
  indicatorsRow: {
    position: 'absolute',
    bottom: 4,
    flexDirection: 'row',
    gap: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    fontFamily: serifFont,
    color: '#666',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 12,
    fontFamily: serifFont,
    fontWeight: '600',
    color: '#333',
    letterSpacing: 1,
  },
});
