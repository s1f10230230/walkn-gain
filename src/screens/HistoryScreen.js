import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  getWeekDates,
  getMonthDates,
  calculateAverage,
  calculateTotal,
  formatDate,
  getDayOfWeek,
} from '../utils/calculations';
import { getMultipleDaysData, getSettings } from '../utils/storage';
import { calculateFoodAmount, getFoodById } from '../data/foodDatabase';

const { width } = Dimensions.get('window');

export default function HistoryScreen() {
  const [activeTab, setActiveTab] = useState('week'); // 'week' or 'month'
  const [historyData, setHistoryData] = useState([]);
  const [totalSteps, setTotalSteps] = useState(0);
  const [averageSteps, setAverageSteps] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);
  const [defaultFood, setDefaultFood] = useState('ramen');

  useEffect(() => {
    loadHistoryData();
  }, [activeTab]);

  const loadHistoryData = async () => {
    const settings = await getSettings();
    setDefaultFood(settings.defaultFood);

    const dates = activeTab === 'week' ? getWeekDates() : getMonthDates();
    const data = await getMultipleDaysData(dates);

    setHistoryData(data);

    const stepsList = data.map(d => d.steps);
    const caloriesList = data.map(d => d.calories);

    setTotalSteps(calculateTotal(stepsList));
    setAverageSteps(calculateAverage(stepsList));
    setTotalCalories(calculateTotal(caloriesList));
  };

  const renderDayItem = (dayData, index) => {
    const progressPercentage = Math.min((dayData.steps / dayData.goal) * 100, 100);
    const barWidth = (width - 100) * (progressPercentage / 100);

    return (
      <View key={index} style={styles.dayItem}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayDate}>
            {dayData.date.slice(5)} ({getDayOfWeek(dayData.date)})
          </Text>
          <Text style={styles.daySteps}>{dayData.steps.toLocaleString()}</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: barWidth }]} />
        </View>
      </View>
    );
  };

  const getFoodAmountForPeriod = () => {
    const food = getFoodById(defaultFood);
    if (!food) return '0';
    return calculateFoodAmount(totalCalories, defaultFood);
  };

  return (
    <View style={styles.container}>
      {/* タブ切り替え */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'week' && styles.activeTab]}
          onPress={() => setActiveTab('week')}
        >
          <Text style={[styles.tabText, activeTab === 'week' && styles.activeTabText]}>
            週
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'month' && styles.activeTab]}
          onPress={() => setActiveTab('month')}
        >
          <Text style={[styles.tabText, activeTab === 'month' && styles.activeTabText]}>
            月
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* サマリー */}
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>
            {activeTab === 'week' ? '週間' : '月間'}サマリー
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>合計</Text>
              <Text style={styles.summaryValue}>{totalSteps.toLocaleString()}</Text>
              <Text style={styles.summaryUnit}>歩</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={styles.divider} />
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>平均</Text>
              <Text style={styles.summaryValue}>{averageSteps.toLocaleString()}</Text>
              <Text style={styles.summaryUnit}>歩/日</Text>
            </View>
          </View>
          <View style={styles.foodSummary}>
            <Text style={styles.foodSummaryText}>
              {getFoodById(defaultFood)?.emoji} {getFoodAmountForPeriod()}{' '}
              {getFoodById(defaultFood)?.unit}分
            </Text>
          </View>
        </View>

        {/* 日別データ */}
        <View style={styles.dailyDataContainer}>
          <Text style={styles.sectionTitle}>日別データ</Text>
          {historyData.map((dayData, index) => renderDayItem(dayData, index))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 40,
    marginHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  activeTab: {
    backgroundColor: '#4CAF50',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  summaryContainer: {
    backgroundColor: '#FFF',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 10,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryUnit: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  divider: {
    width: 1,
    height: 60,
    backgroundColor: '#E0E0E0',
  },
  foodSummary: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  foodSummaryText: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '600',
  },
  dailyDataContainer: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  dayItem: {
    marginBottom: 15,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayDate: {
    fontSize: 14,
    color: '#666',
  },
  daySteps: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
});
