import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  InteractionManager,
} from 'react-native';
import { useColorScheme } from 'react-native';

// Haptics のインポート（利用可能な場合のみ）
let Haptics;
try {
  Haptics = require('expo-haptics');
} catch (e) {
  console.log('expo-haptics not available');
}

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pedometer } from 'expo-sensors';
import { LineChart } from 'react-native-chart-kit';
import {
  getWeekDates,
  getMonthDates,
  calculateAverage,
  calculateTotal,
  formatDate,
  getDayOfWeek,
  calculateCalories,
} from '../utils/calculations';
import { getStepsHybrid, getStepsInRange } from '../utils/healthKit';
import { getMultipleDaysData, getSettings, getUserProfile } from '../utils/storage';
import { calculateFoodAmount, getFoodById } from '../data/foodDatabase';
import { useI18n } from '../i18n/I18nProvider';
import { getTheme } from '../utils/theme';
import { logEvent } from '../utils/analytics';
import HistoryDayItem from '../components/HistoryDayItem';

const { width } = Dimensions.get('window');

export default function HistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t, formatNumber, getWeekdayShort } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const [activeTab, setActiveTab] = useState('week'); // 'week' or 'month'
  const [historyData, setHistoryData] = useState([]);
  const [totalSteps, setTotalSteps] = useState(0);
  const [averageSteps, setAverageSteps] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);
  const [defaultFood, setDefaultFood] = useState('ramen');
  const [pointTip, setPointTip] = useState({ visible: false, x: 0, y: 0, value: 0 });
  const tipTimerRef = React.useRef(null);
  // 軽量キャッシュと多重実行防止でラグを軽減
  const cacheRef = useRef({ week: null, month: null });
  const cacheAtRef = useRef({ week: 0, month: 0 });
  const inFlightRef = useRef(false);
  const loadTokenRef = useRef(0);
  const CACHE_TTL_MS = 10000; // 10秒は即時キャッシュを許容

  const changeTab = (newTab) => {
    if (Haptics?.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setActiveTab(newTab);
  };

  useEffect(() => {
    const key = activeTab === 'week' ? 'week' : 'month';
    const now = Date.now();
    const cached = cacheRef.current[key];
    const cachedAt = cacheAtRef.current[key] || 0;
    if (cached && (now - cachedAt) < CACHE_TTL_MS) {
      setHistoryData(cached.list);
      setTotalSteps(cached.totalSteps);
      setAverageSteps(cached.averageSteps);
      setTotalCalories(cached.totalCalories);
    } else {
      InteractionManager.runAfterInteractions(() => {
        loadHistoryData();
      });
    }
    try { logEvent('history_viewed', { range: key === 'week' ? '7d' : '30d' }); } catch (_) {}
  }, [activeTab]);

  // 初回マウント時に両方の範囲をプレフェッチ（バックグラウンド）
  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      prefetchTab('week');
      prefetchTab('month');
    });
  }, []);

  const loadHistoryData = async () => {
    if (inFlightRef.current) return; // 多重実行防止
    inFlightRef.current = true;
    const myToken = ++loadTokenRef.current;
    const settings = await getSettings();
    const userProfile = await getUserProfile();
    setDefaultFood(settings.defaultFood);

    const dates = activeTab === 'week' ? getWeekDates() : getMonthDates();

    // HealthKitから実際のデータを取得（範囲APIで安定取得）
    try {
      const data = [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      // 範囲を一括取得してから日別にマップ
      const startStr = dates[0];
      const endStr = dates[dates.length - 1];
      const [sy, sm, sd] = startStr.split('-').map(Number);
      const [ey, em, ed] = endStr.split('-').map(Number);
      const rangeStart = new Date(sy, sm - 1, sd); rangeStart.setHours(0,0,0,0);
      const rangeEnd = new Date(ey, em - 1, ed);
      // 終端が今日なら現在時刻まで
      if (rangeEnd.toDateString() === new Date().toDateString()) {
        rangeEnd.setTime(Date.now());
      } else {
        rangeEnd.setHours(23,59,59,999);
      }

      const rangeList = await getStepsInRange(rangeStart, rangeEnd);
      if (loadTokenRef.current !== myToken) { inFlightRef.current = false; return; }
      const byDate = new Map((rangeList || []).map(it => [it.date, Number(it.steps) || 0]));

      for (const dateStr of dates) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        if (date > today) continue; // 未来日は除外
        const stepsVal = byDate.get(dateStr) || 0;
        const caloriesVal = calculateCalories(stepsVal, userProfile.weight);
        data.push({
          date: dateStr,
          steps: stepsVal,
          calories: caloriesVal,
          distance: 0,
          goal: settings.dailyGoal,
        });
      }

      const stepsList = data.map(d => d.steps);
      const caloriesList = data.map(d => d.calories);
      const total = calculateTotal(stepsList);
      const avg = calculateAverage(stepsList);
      const totalCal = calculateTotal(caloriesList);

      // まとめて反映（再レンダ回数を最小化）
      setHistoryData(data);
      setTotalSteps(total);
      setAverageSteps(avg);
      setTotalCalories(totalCal);

      // 簡易キャッシュ
      const key = activeTab === 'week' ? 'week' : 'month';
      cacheRef.current[key] = { list: data, totalSteps: total, averageSteps: avg, totalCalories: totalCal };
      cacheAtRef.current[key] = Date.now();

      // 次に切り替えそうなもう一方もプレフェッチ
      const other = key === 'week' ? 'month' : 'week';
      prefetchTab(other);
    } catch (error) {
      console.error('Error loading history data:', error);
      // エラー時はストレージからデータを取得
      const data = await getMultipleDaysData(dates);
      const stepsList = data.map(d => d.steps);
      const caloriesList = data.map(d => d.calories);
      setHistoryData(data);
      setTotalSteps(calculateTotal(stepsList));
      setAverageSteps(calculateAverage(stepsList));
      setTotalCalories(calculateTotal(caloriesList));
    }
    inFlightRef.current = false;
  };

  // バックグラウンドで指定タブ範囲をキャッシュ
  const prefetchTab = async (tab) => {
    try {
      const dates = tab === 'week' ? getWeekDates() : getMonthDates();
      const settings = await getSettings();
      const userProfile = await getUserProfile();
      const startStr = dates[0];
      const endStr = dates[dates.length - 1];
      const [sy, sm, sd] = startStr.split('-').map(Number);
      const [ey, em, ed] = endStr.split('-').map(Number);
      const rangeStart = new Date(sy, sm - 1, sd); rangeStart.setHours(0,0,0,0);
      const rangeEnd = new Date(ey, em - 1, ed);
      if (rangeEnd.toDateString() === new Date().toDateString()) rangeEnd.setTime(Date.now());
      else rangeEnd.setHours(23,59,59,999);
      const rangeList = await getStepsInRange(rangeStart, rangeEnd);
      const byDate = new Map((rangeList || []).map(it => [it.date, Number(it.steps) || 0]));
      const today = new Date(); today.setHours(0,0,0,0);
      const data = [];
      for (const dateStr of dates) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        if (date > today) continue;
        const stepsVal = byDate.get(dateStr) || 0;
        const caloriesVal = calculateCalories(stepsVal, userProfile.weight);
        data.push({ date: dateStr, steps: stepsVal, calories: caloriesVal, distance: 0, goal: settings.dailyGoal });
      }
      const stepsList = data.map(d => d.steps);
      const caloriesList = data.map(d => d.calories);
      cacheRef.current[tab] = {
        list: data,
        totalSteps: calculateTotal(stepsList),
        averageSteps: calculateAverage(stepsList),
        totalCalories: calculateTotal(caloriesList),
      };
      cacheAtRef.current[tab] = Date.now();
    } catch (_) {}
  };

  const renderChart = () => {
    if (historyData.length === 0) return null;

    const labels = historyData.map(d => d.date.slice(5)); // MM-DD
    const data = historyData.map(d => d.steps);

    // 月表示の場合は、表示するラベルを間引く（グラフはすべてのデータポイントを保持）
    const displayLabels = activeTab === 'week'
      ? labels
      : labels.map((label, i) => i % 5 === 0 ? label : '');

    const chartData = {
      labels: displayLabels,
      datasets: [
        {
          data: data.length > 0 ? data : [0],
          color: (opacity = 1) => `rgba(0, 191, 165, ${opacity})`, // #00BFA5 アクセントカラー
          strokeWidth: 3, // 線を太く
        },
      ],
    };

    const chartConfig = {
      backgroundColor: theme.card,
      backgroundGradientFrom: theme.card,
      backgroundGradientTo: theme.card,
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(0, 191, 165, ${opacity})`,
      labelColor: (opacity = 1) => theme.textSecondary,
      style: {
        borderRadius: 16,
      },
      propsForDots: {
        r: 6,
        strokeWidth: 3,
        stroke: theme.card,
        fill: '#00BFA5',
      },
      propsForBackgroundLines: {
        strokeWidth: 1,
        stroke: theme.border,
        strokeDasharray: 0,
      },
      propsForLabels: {
        fontSize: 10,
      },
    };

    return (
      <View style={[styles.chartContainer, { position: 'relative', backgroundColor: theme.card }] }>
        <Text style={[styles.chartTitle, { color: theme.text }]}>{t('history.chart.stepsTrend')}</Text>
        <LineChart
          data={chartData}
          width={width - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withInnerLines={true}
          withOuterLines={true}
          withVerticalLines={false}
          withHorizontalLines={true}
          fromZero={true}
          onDataPointClick={({ value, x, y }) => {
            try { if (tipTimerRef.current) clearTimeout(tipTimerRef.current); } catch (_) {}
            setPointTip({ visible: true, x, y, value });
            tipTimerRef.current = setTimeout(() => setPointTip({ visible: false, x: 0, y: 0, value: 0 }), 1800);
          }}
        />
        {pointTip.visible && (
          <View
            pointerEvents="none"
            style={[
              styles.chartTooltip,
              {
                left: Math.max(6, Math.min((width - 40) - 66, pointTip.x - 30)),
                top: Math.max(6, Math.min(220 - 34, pointTip.y - 30)),
                backgroundColor: theme.card,
                borderColor: theme.border,
              }
            ]}
          >
            <Text style={[styles.chartTooltipText, { color: theme.text }]}>{formatNumber(Math.round(pointTip.value))} {t('units.steps')}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderDayItem = (dayData, index) => {
    return (
      <HistoryDayItem
        key={index}
        dayData={dayData}
        getWeekdayShort={getWeekdayShort}
        formatNumber={formatNumber}
        onDatePress={(date) => {
          // わずかなディレイを入れて、タップ感を提供
          setTimeout(() => {
            // HomeStackのHomeMainに遷移し、日付パラメータを渡す
            navigation.navigate('Home', {
              screen: 'HomeMain',
              params: { selectedDate: date },
            });
          }, 120);
        }}
      />
    );
  };

  const getFoodAmountForPeriod = () => {
    const food = getFoodById(defaultFood);
    if (!food) return '0';
    return calculateFoodAmount(totalCalories, defaultFood);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* タブ切り替え */}
      <View style={[styles.tabContainer, { paddingTop: insets.top + 10, backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'week' && styles.activeTab, { backgroundColor: theme.card, borderColor: activeTab === 'week' ? theme.primary : 'transparent' }]}
          onPress={() => changeTab('week')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'week' ? theme.primary : theme.textSecondary }]}>
            {t('history.tabs.week')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'month' && styles.activeTab, { backgroundColor: theme.card, borderColor: activeTab === 'month' ? theme.accent : 'transparent' }]}
          onPress={() => changeTab('month')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'month' ? theme.accent : theme.textSecondary }]}>
            {t('history.tabs.month')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        >
        {/* サマリー */}
        <View style={[styles.summaryContainer, { backgroundColor: theme.card }]}>
          <Text style={[styles.summaryTitle, { color: theme.text }]}>
            {activeTab === 'week' ? t('history.summary.titleWeek') : t('history.summary.titleMonth')}
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('history.summary.totalSteps')}</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{formatNumber(totalSteps)}</Text>
              <Text style={[styles.summaryUnit, { color: theme.textSecondary }]}>{t('units.steps')}</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={styles.divider} />
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('history.summary.averageSteps')}</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{formatNumber(averageSteps)}</Text>
              <Text style={[styles.summaryUnit, { color: theme.textSecondary }]}>{t('history.unit.stepsPerDay')}</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('history.summary.totalCalories')}</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{formatNumber(Math.round(totalCalories))}</Text>
              <Text style={[styles.summaryUnit, { color: theme.accent, fontWeight: '600' }]}>{t('units.kcal')}</Text>
            </View>
          </View>
          <View style={styles.foodSummary}>
            <Text style={[styles.foodSummaryText, { color: theme.primary }]}>
              {(() => {
                const food = getFoodById(defaultFood);
                if (!food) return '';
                const unitKey = `food.items.${food.id}.unit`;
                const tUnit = t(unitKey);
                const displayUnit = tUnit === unitKey ? food.unit : tUnit;
                const amount = getFoodAmountForPeriod();
                const suffix = t('food.amountSuffix') || '分';
                return `${food.emoji} ${amount} ${displayUnit}${suffix}`;
              })()}
            </Text>
          </View>
        </View>

        {/* グラフ */}
        {renderChart()}

        {/* 日別データ */}
        <View style={[styles.dailyDataContainer, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('history.section.dailyData')}</Text>
          {historyData.map((dayData, index) => renderDayItem(dayData, index))}
        </View>
      </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
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
    backgroundColor: '#FF7043',
  },
  tabText: {
    fontSize: 16,
    color: '#616161',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFF',
  },
  contentContainer: {
    flex: 1,
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
    color: '#212121',
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
    color: '#616161',
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#212121',
  },
  summaryUnit: {
    fontSize: 14,
    color: '#616161',
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
    color: '#FF7043',
    fontWeight: '600',
  },
  chartContainer: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginVertical: 15,
    padding: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 10,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartTooltip: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chartTooltipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#212121',
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
    color: '#212121',
    marginBottom: 15,
  },
});
