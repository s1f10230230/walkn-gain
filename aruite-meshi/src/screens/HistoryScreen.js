import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  InteractionManager,
  Platform,
  ImageBackground,
  PanResponder,
  Animated,
  useWindowDimensions,
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
import { getStepsInRange } from '../utils/healthKit';
import { LineChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getWeekDates,
  getMonthDates,
  getCalendarWeekDates,
  getCalendarMonthDates,
  getWeekLabel,
  getMonthLabel,
  isFutureDate,
  calculateAverage,
  calculateTotal,
  formatDate,
  getDayOfWeek,
  calculateCalories,
  calculateDistance,
  estimateStrideLength,
} from '../utils/calculations';
import { useSubscription } from '../contexts/SubscriptionContext';
// HealthKitは背景配信のみ使用
import { getMultipleDaysData, getSettings, getUserProfile, saveDailyData, getDailyData } from '../utils/storage';
import { calculateFoodAmount, getFoodById } from '../data/foodDatabase';
import { useI18n } from '../i18n/I18nProvider';
import { getTheme } from '../utils/theme';
import { logEvent } from '../utils/analytics';
import HistoryDayItem from '../components/HistoryDayItem';

export default function HistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t, formatNumber, getWeekdayShort, locale } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { width: screenWidth } = useWindowDimensions();
  const MAX_CONTENT_WIDTH = 720;
  const contentWidth = Math.min(screenWidth, MAX_CONTENT_WIDTH);
  const { isPremium, presentPaywall } = useSubscription();
  const [activeTab, setActiveTab] = useState('week'); // 'week' or 'month'
  const [weekOffset, setWeekOffset] = useState(0); // Pro: 0=今週, -1=先週...
  const [monthOffset, setMonthOffset] = useState(0); // Pro: 0=今月, -1=先月...

  // 直近データ（Free + Pro両方で使用）
  const [recentData, setRecentData] = useState([]);
  const [recentStats, setRecentStats] = useState({ total: 0, average: 0, calories: 0, distance: 0, achieved: 0 });

  // カレンダーデータ（Pro用）
  const [calendarData, setCalendarData] = useState([]);
  const [calendarStats, setCalendarStats] = useState({ total: 0, average: 0, calories: 0, distance: 0, achieved: 0 });

  // 日別リストで使用するデータ（Proはカレンダーデータ、Freeは直近データ）
  const historyData = isPremium ? calendarData : recentData;

  // サマリーは常に直近データの統計を使用
  const totalSteps = recentStats.total;
  const averageSteps = recentStats.average;
  const totalCalories = recentStats.calories;
  const totalDistance = recentStats.distance;
  const goalAchievedDays = recentStats.achieved;

  const [defaultFood, setDefaultFood] = useState('ramen');
  const [pointTip, setPointTip] = useState({ visible: false, x: 0, y: 0, value: 0 });
  const [calendarPointTip, setCalendarPointTip] = useState({ visible: false, x: 0, y: 0, value: 0 });
  const tipTimerRef = React.useRef(null);
  const calendarTipTimerRef = React.useRef(null);
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
    // タブ切り替え時にオフセットをリセット
    if (newTab === 'week') {
      setWeekOffset(0);
    } else {
      setMonthOffset(0);
    }
  };

  // Pro用: 週を移動
  const navigateWeek = (direction) => {
    if (!isPremium) return;
    if (Haptics?.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setWeekOffset(prev => prev + direction);
  };

  // Pro用: 月を移動
  const navigateMonth = (direction) => {
    if (!isPremium) return;
    if (Haptics?.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setMonthOffset(prev => prev + direction);
  };

  // 現在のオフセットを取得
  const currentOffset = activeTab === 'week' ? weekOffset : monthOffset;

  // データロード用のヘルパー関数
  const loadDataForDates = async (dates, settings, userProfile) => {
    const data = [];
    const startStr = dates[0];
    const endStr = dates[dates.length - 1];
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    const rangeStart = new Date(sy, sm - 1, sd); rangeStart.setHours(0,0,0,0);
    const rangeEnd = new Date(ey, em - 1, ed);
    if (rangeEnd.toDateString() === new Date().toDateString()) {
      rangeEnd.setTime(Date.now());
    } else {
      rangeEnd.setHours(23,59,59,999);
    }

    const hkList = await getStepsInRange(rangeStart, rangeEnd);
    const map = new Map();
    (hkList || []).forEach((item) => {
      if (item?.date) map.set(item.date, Number(item.steps || 0));
    });

    for (const dateStr of dates) {
      const isFuture = isFutureDate(dateStr);
      const stepsVal = isFuture ? 0 : Number(map.get(dateStr) || 0);
      const caloriesVal = isFuture ? 0 : calculateCalories(stepsVal, userProfile.weight);
      const dayData = {
        date: dateStr,
        steps: stepsVal,
        calories: caloriesVal,
        distance: 0,
        goal: settings.dailyGoal,
        isFuture,
      };
      data.push(dayData);

      if (stepsVal > 0 && !isFuture) {
        await saveDailyData(dateStr, dayData);
      }
    }

    // 統計計算
    const pastData = data.filter(d => !d.isFuture);
    const stepsList = pastData.map(d => d.steps);
    const caloriesList = pastData.map(d => d.calories);
    const total = calculateTotal(stepsList);
    const avg = pastData.length > 0 ? calculateAverage(stepsList) : 0;
    const totalCal = calculateTotal(caloriesList);
    const strideLength = estimateStrideLength(userProfile.height || 165);
    const totalDist = calculateDistance(total, strideLength);
    const achievedDays = pastData.filter(d => d.steps >= d.goal).length;

    return {
      list: data,
      stats: { total, average: avg, calories: totalCal, distance: totalDist, achieved: achievedDays }
    };
  };

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      loadHistoryData();
    });
    try { logEvent('history_viewed', { range: activeTab === 'week' ? '7d' : '30d', isPremium, offset: currentOffset }); } catch (_) {}
  }, [activeTab, weekOffset, monthOffset, isPremium]);

  // 初回マウント時にプレフェッチ
  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      prefetchTab('week');
      prefetchTab('month');
    });
  }, []);

  const loadHistoryData = async () => {
    if (inFlightRef.current) return;

    const now = Date.now();
    const cacheKey = activeTab;
    const cached = cacheRef.current[cacheKey];
    const cachedAt = cacheAtRef.current[cacheKey] || 0;

    // キャッシュが有効ならまず即座に表示（UX向上）
    if (cached && (now - cachedAt) < CACHE_TTL_MS) {
      setRecentData(cached.list);
      setRecentStats({
        total: cached.totalSteps,
        average: cached.averageSteps,
        calories: cached.totalCalories,
        distance: cached.totalDistance,
        achieved: cached.goalAchievedDays,
      });
      return; // キャッシュが新しければ再フェッチしない
    }

    // キャッシュがあれば先に表示（古くても）
    if (cached) {
      setRecentData(cached.list);
      setRecentStats({
        total: cached.totalSteps,
        average: cached.averageSteps,
        calories: cached.totalCalories,
        distance: cached.totalDistance,
        achieved: cached.goalAchievedDays,
      });
    }

    inFlightRef.current = true;
    const myToken = ++loadTokenRef.current;

    try {
      const settings = await getSettings();
      const userProfile = await getUserProfile();
      setDefaultFood(settings.defaultFood);

      // 直近データ（常にロード）
      const recentDates = activeTab === 'week' ? getWeekDates() : getMonthDates();
      const recentResult = await loadDataForDates(recentDates, settings, userProfile);

      // キャッシュを更新
      cacheRef.current[cacheKey] = {
        list: recentResult.list,
        totalSteps: recentResult.stats.total,
        averageSteps: recentResult.stats.average,
        totalCalories: recentResult.stats.calories,
        totalDistance: recentResult.stats.distance,
        goalAchievedDays: recentResult.stats.achieved,
      };
      cacheAtRef.current[cacheKey] = Date.now();

      setRecentData(recentResult.list);
      setRecentStats(recentResult.stats);

      // Pro: カレンダーデータもロード
      if (isPremium) {
        const calendarDates = activeTab === 'week'
          ? getCalendarWeekDates(weekOffset)
          : getCalendarMonthDates(monthOffset);
        const calendarResult = await loadDataForDates(calendarDates, settings, userProfile);
        setCalendarData(calendarResult.list);
        setCalendarStats(calendarResult.stats);
      }
    } catch (error) {
      console.error('Error loading history data:', error);
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
      const today = new Date(); today.setHours(0,0,0,0);
      const rangeList = await getStepsInRange(rangeStart, rangeEnd);
      const map = new Map();
      (rangeList || []).forEach((item) => {
        if (item?.date) map.set(item.date, Number(item.steps || 0));
      });

      const data = [];
      for (const dateStr of dates) {
        const stepsVal = Number(map.get(dateStr) || 0);
        const caloriesVal = calculateCalories(stepsVal, userProfile.weight);
        const dayData = { date: dateStr, steps: stepsVal, calories: caloriesVal, distance: 0, goal: settings.dailyGoal };
        data.push(dayData);

        // AsyncStorageに保存（トロフィー・ストリーク計算用）
        if (stepsVal > 0) {
          await saveDailyData(dateStr, dayData);
        }
      }
      const stepsList = data.map(d => d.steps);
      const caloriesList = data.map(d => d.calories);
      const total = calculateTotal(stepsList);
      const strideLength = estimateStrideLength(userProfile.height || 165);
      const totalDist = calculateDistance(total, strideLength);
      const achievedDays = data.filter(d => d.steps >= d.goal).length;
      cacheRef.current[tab] = {
        list: data,
        totalSteps: total,
        averageSteps: calculateAverage(stepsList),
        totalCalories: calculateTotal(caloriesList),
        totalDistance: totalDist,
        goalAchievedDays: achievedDays,
      };
      cacheAtRef.current[tab] = Date.now();
    } catch (_) {}
  };

  // 汎用グラフレンダリング関数
  const renderChartWithData = (chartDataList, title, accentColor, tipState, setTipState, timerRef) => {
    if (chartDataList.length === 0) return null;

    const labels = chartDataList.map(d => d.date.slice(5)); // MM-DD
    const data = chartDataList.map(d => d.steps);

    // 月表示または7日以上の場合は、表示するラベルを間引く
    const displayLabels = chartDataList.length <= 7
      ? labels
      : labels.map((label, i) => i % 5 === 0 ? label : '');

    const chartData = {
      labels: displayLabels,
      datasets: [
        {
          data: data.length > 0 ? data : [0],
          color: (opacity = 1) => `rgba(0, 168, 150, ${opacity})`,
          strokeWidth: 3,
        },
      ],
    };

    const chartConfig = {
      backgroundColor: theme.card,
      backgroundGradientFrom: theme.card,
      backgroundGradientTo: theme.card,
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(0, 168, 150, ${opacity})`,
      labelColor: () => theme.textSecondary,
      style: { borderRadius: 20 },
      propsForDots: {
        r: 5,
        strokeWidth: 2,
        stroke: '#FFFDF9',
        fill: theme.accent,
      },
      propsForBackgroundLines: {
        strokeWidth: 1,
        stroke: theme.lineGray,
        strokeDasharray: "5, 5",
      },
      propsForLabels: {
        fontSize: 10,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
      },
      fillShadowGradient: theme.accent,
      fillShadowGradientOpacity: 0.2,
      fillShadowGradientFrom: theme.accent,
      fillShadowGradientFromOpacity: 0.3,
      fillShadowGradientTo: theme.accent,
      fillShadowGradientToOpacity: 0.05,
    };

    return (
      <View style={{ position: 'relative' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <MaterialCommunityIcons name="chart-areaspline" size={20} color={accentColor} style={{ marginRight: 8 }} />
          <Text style={[styles.chartTitle, { color: theme.text, fontFamily: serifFont, marginBottom: 0 }]}>{title}</Text>
        </View>
        <LineChart
          data={chartData}
          width={lineChartWidth}
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
            try { if (timerRef.current) clearTimeout(timerRef.current); } catch (_) {}
            setTipState({ visible: true, x, y, value });
            timerRef.current = setTimeout(() => setTipState({ visible: false, x: 0, y: 0, value: 0 }), 1800);
          }}
        />
        {tipState.visible && (
          <View
            pointerEvents="none"
            style={[
              styles.chartTooltip,
              {
                left: Math.max(6, Math.min(lineChartWidth - 66, tipState.x - 30)),
                top: Math.max(6, Math.min(220 - 34, tipState.y - 30)),
                backgroundColor: theme.card,
                borderColor: theme.border,
              }
            ]}
          >
            <Text style={[styles.chartTooltipText, { color: theme.text }]}>{formatNumber(Math.round(tipState.value))} {t('units.steps')}</Text>
          </View>
        )}
      </View>
    );
  };

  // 直近データグラフ（Free + Pro両方で表示）
  const renderRecentChart = () => {
    if (recentData.length === 0) return null;

    return (
      <View style={[styles.chartContainer, { backgroundColor: theme.card, borderLeftWidth: 4, borderLeftColor: '#FF6B35' }]}>
        {renderChartWithData(
          recentData,
          t('history.chart.stepsTrend'),
          '#FF6B35',
          pointTip,
          setPointTip,
          tipTimerRef
        )}
      </View>
    );
  };

  // カルーセル用アニメーション値
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const carouselWidth = Math.max(280, contentWidth - 40); // チャートコンテナの幅
  const lineChartWidth = Math.max(240, contentWidth - 70);

  // 隣接期間のデータ（プリロード用）
  const [prevPeriodData, setPrevPeriodData] = useState([]);
  const [nextPeriodData, setNextPeriodData] = useState([]);

  // 隣接期間のデータをプリロード
  useEffect(() => {
    if (!isPremium) return;

    const loadAdjacentData = async () => {
      try {
        const settings = await getSettings();
        const userProfile = await getUserProfile();

        // 前の期間
        const prevDates = activeTab === 'week'
          ? getCalendarWeekDates(weekOffset - 1)
          : getCalendarMonthDates(monthOffset - 1);
        const prevResult = await loadDataForDates(prevDates, settings, userProfile);
        setPrevPeriodData(prevResult.list);

        // 次の期間（currentOffset < 0 の場合のみ）
        if (currentOffset < 0) {
          const nextDates = activeTab === 'week'
            ? getCalendarWeekDates(weekOffset + 1)
            : getCalendarMonthDates(monthOffset + 1);
          const nextResult = await loadDataForDates(nextDates, settings, userProfile);
          setNextPeriodData(nextResult.list);
        } else {
          setNextPeriodData([]);
        }
      } catch (e) {
        console.log('Adjacent data load error:', e);
      }
    };

    loadAdjacentData();
  }, [activeTab, weekOffset, monthOffset, isPremium]);

  // スワイプジェスチャー用の最新状態を保持するref
  const swipeStateRef = useRef({ activeTab, weekOffset, monthOffset });
  useEffect(() => {
    swipeStateRef.current = { activeTab, weekOffset, monthOffset };
  }, [activeTab, weekOffset, monthOffset]);

  // スワイプ完了時のアニメーション＆状態更新
  const snapToOffset = (direction) => {
    const { activeTab: tab, weekOffset: wOffset, monthOffset: mOffset } = swipeStateRef.current;
    const offset = tab === 'week' ? wOffset : mOffset;

    if (direction === 0) {
      // 元に戻す
      Animated.spring(swipeAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    } else if (direction === -1) {
      // 過去へ（右スワイプ）
      Animated.timing(swipeAnim, {
        toValue: carouselWidth,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        if (tab === 'week') {
          setWeekOffset(prev => prev - 1);
        } else {
          setMonthOffset(prev => prev - 1);
        }
        swipeAnim.setValue(0);
      });
      if (Haptics?.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } else if (direction === 1 && offset < 0) {
      // 未来へ（左スワイプ）
      Animated.timing(swipeAnim, {
        toValue: -carouselWidth,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        if (tab === 'week') {
          setWeekOffset(prev => prev + 1);
        } else {
          setMonthOffset(prev => prev + 1);
        }
        swipeAnim.setValue(0);
      });
      if (Haptics?.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } else {
      // 戻す
      Animated.spring(swipeAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    }
  };

  // スワイプジェスチャー用PanResponder
  const swipeThreshold = 60;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 15;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2 && Math.abs(gestureState.dx) > 20;
      },
      onPanResponderGrant: () => {
        swipeAnim.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        // スワイプに追従してアニメーション
        const { weekOffset: wOffset, monthOffset: mOffset, activeTab: tab } = swipeStateRef.current;
        const offset = tab === 'week' ? wOffset : mOffset;

        // 未来への制限（offset >= 0 の場合は左スワイプを制限）
        let dx = gestureState.dx;
        if (offset >= 0 && dx < 0) {
          dx = dx * 0.2; // 抵抗感
        }
        swipeAnim.setValue(dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const velocity = gestureState.vx;

        if (gestureState.dx > swipeThreshold || velocity > 0.5) {
          snapToOffset(-1); // 過去へ
        } else if (gestureState.dx < -swipeThreshold || velocity < -0.5) {
          snapToOffset(1); // 未来へ
        } else {
          snapToOffset(0); // 戻す
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  // ミニチャートレンダリング（カルーセル用）
  const renderMiniChart = (chartDataList, opacity = 1) => {
    if (!chartDataList || chartDataList.length === 0) return null;

    const labels = chartDataList.map(d => d.date.slice(8)); // DD only
    const data = chartDataList.map(d => d.steps);
    const displayLabels = chartDataList.length <= 7
      ? labels
      : labels.map((label, i) => i % 7 === 0 ? label : '');

    const chartData = {
      labels: displayLabels,
      datasets: [{
        data: data.length > 0 ? data : [0],
        color: (o = 1) => `rgba(0, 168, 150, ${o * opacity})`,
        strokeWidth: 2,
      }],
    };

    const bgColor = theme.card;
    const chartConfig = {
      backgroundColor: bgColor,
      backgroundGradientFrom: bgColor,
      backgroundGradientTo: bgColor,
      decimalPlaces: 0,
      color: (o = 1) => `rgba(0, 168, 150, ${o * opacity})`,
      labelColor: () => theme.textSecondary,
      style: { borderRadius: 8 },
      propsForDots: { r: 3, strokeWidth: 1, stroke: bgColor, fill: theme.accent },
      propsForBackgroundLines: { strokeWidth: 0 },
      propsForLabels: { fontSize: 9, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
      fillShadowGradient: theme.accent,
      fillShadowGradientOpacity: 0.15 * opacity,
    };

    return (
      <LineChart
        data={chartData}
        width={Math.max(200, carouselWidth - 30)}
        height={180}
        chartConfig={chartConfig}
        bezier
        withInnerLines={false}
        withOuterLines={false}
        withVerticalLines={false}
        withHorizontalLines={false}
        fromZero={true}
      />
    );
  };

  // Pro用カレンダーグラフ（スワイプ可能カルーセル）
  const renderCalendarChart = () => {
    if (!isPremium || calendarData.length === 0) return null;

    const periodLabel = activeTab === 'week'
      ? getWeekLabel(weekOffset)
      : getMonthLabel(monthOffset, locale);

    const prevLabel = activeTab === 'week'
      ? getWeekLabel(weekOffset - 1)
      : getMonthLabel(monthOffset - 1, locale);

    const nextLabel = activeTab === 'week'
      ? getWeekLabel(weekOffset + 1)
      : getMonthLabel(monthOffset + 1, locale);

    return (
      <View style={[styles.chartContainer, { backgroundColor: theme.card, borderLeftWidth: 4, borderLeftColor: theme.accent, overflow: 'hidden' }]}>
        {/* ナビゲーションヘッダー */}
        <View style={styles.calendarNavHeader}>
          <TouchableOpacity
            onPress={() => snapToOffset(-1)}
            style={styles.calendarNavButton}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color={theme.accent} />
          </TouchableOpacity>

          <View style={styles.calendarNavLabelContainer}>
            <Text style={[styles.calendarNavLabel, { color: theme.text, fontFamily: serifFont }]}>
              {periodLabel}
            </Text>
            {currentOffset === 0 && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>
                  {activeTab === 'week' ? t('history.nav.thisWeek') : t('history.nav.thisMonth')}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={() => snapToOffset(1)}
            style={styles.calendarNavButton}
            disabled={currentOffset >= 0}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={currentOffset >= 0 ? theme.accent + '40' : theme.accent}
            />
          </TouchableOpacity>
        </View>

        {/* カルーセルコンテナ */}
        <View
          {...panResponder.panHandlers}
          style={[styles.carouselContainer, { height: 200 }]}
        >
          <Animated.View
            style={[
              styles.carouselTrack,
              {
                width: carouselWidth * 3,
                transform: [{ translateX: Animated.add(swipeAnim, new Animated.Value(-carouselWidth)) }],
              }
            ]}
          >
            {/* 前の期間 */}
            <View style={[styles.carouselSlide, { width: carouselWidth, opacity: 0.5 }]}>
              {renderMiniChart(prevPeriodData, 0.7)}
            </View>

            {/* 現在の期間 */}
            <View style={[styles.carouselSlide, { width: carouselWidth }]}>
              {renderMiniChart(calendarData, 1)}
            </View>

            {/* 次の期間 */}
            <View style={[styles.carouselSlide, { width: carouselWidth, opacity: currentOffset < 0 ? 0.5 : 0.2 }]}>
              {currentOffset < 0 ? (
                renderMiniChart(nextPeriodData, 0.7)
              ) : (
                <View style={styles.carouselEndIndicator}>
                  <MaterialCommunityIcons name="calendar-check" size={40} color={theme.accent + '40'} />
                </View>
              )}
            </View>
          </Animated.View>
        </View>

        {/* スワイプインジケーター */}
        <View style={styles.swipeIndicator}>
          <View style={[styles.swipeIndicatorDot, { backgroundColor: theme.textSecondary + '40' }]} />
          <View style={[styles.swipeIndicatorDot, styles.swipeIndicatorDotActive, { backgroundColor: theme.accent }]} />
          <View style={[styles.swipeIndicatorDot, { backgroundColor: currentOffset < 0 ? theme.textSecondary + '40' : 'transparent' }]} />
        </View>

        {/* カレンダー期間の統計 */}
        <View style={styles.calendarStats}>
          <View style={styles.calendarStatItem}>
            <Text style={[styles.calendarStatValue, { color: theme.text }]}>{formatNumber(calendarStats.total)}</Text>
            <Text style={[styles.calendarStatLabel, { color: theme.textSecondary }]}>{t('history.summary.totalSteps')}</Text>
          </View>
          <View style={styles.calendarStatItem}>
            <Text style={[styles.calendarStatValue, { color: theme.text }]}>{formatNumber(calendarStats.average)}</Text>
            <Text style={[styles.calendarStatLabel, { color: theme.textSecondary }]}>{t('history.unit.stepsPerDay')}</Text>
          </View>
          <View style={styles.calendarStatItem}>
            <Text style={[styles.calendarStatValue, { color: theme.accent }]}>{calendarStats.achieved}</Text>
            <Text style={[styles.calendarStatLabel, { color: theme.textSecondary }]}>{t('history.calendar.daysAchieved')}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderDayItem = (dayData, index) => {
    return (
      <HistoryDayItem
        key={index}
        dayData={dayData}
        contentWidth={contentWidth}
        getWeekdayShort={getWeekdayShort}
        formatNumber={formatNumber}
        t={t}
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

  const serifFont = Platform.select({ ios: 'Georgia', android: 'serif' });

  return (
    <ImageBackground
      source={require('../../assets/paper-texture.png')}
      style={[styles.container, { backgroundColor: theme.background }]}
      imageStyle={{ opacity: 0.03, resizeMode: 'repeat' }}
    >
      <View style={{ flex: 1, width: contentWidth, alignSelf: 'center' }}>
        {/* Journal Header */}
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="chart-line" size={28} color={theme.accent} style={{ marginRight: 10 }} />
            <Text style={{ fontSize: 32, fontFamily: serifFont, color: theme.text, fontWeight: '600' }}>History</Text>
          </View>
          <Text style={{ fontSize: 14, fontFamily: serifFont, color: theme.textSecondary, fontStyle: 'italic', marginTop: 4, marginLeft: 38 }}>
            {t('history.subtitle')}
          </Text>
        </View>

        {/* Pill-style Tabs */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', backgroundColor: theme.isDark ? '#2A2A2A' : '#F5F5F5', borderRadius: 25, padding: 4 }}>
            <TouchableOpacity
              onPress={() => changeTab('week')}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 24,
                borderRadius: 20,
                backgroundColor: activeTab === 'week' ? theme.accent : 'transparent',
              }}
            >
              <Text style={{
                fontFamily: serifFont,
                fontSize: 14,
                fontWeight: '600',
                color: activeTab === 'week' ? '#FFF' : theme.textSecondary
              }}>
                {t('history.tabs.week')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => changeTab('month')}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 24,
                borderRadius: 20,
                backgroundColor: activeTab === 'month' ? theme.accent : 'transparent',
              }}
            >
              <Text style={{
                fontFamily: serifFont,
                fontSize: 14,
                fontWeight: '600',
                color: activeTab === 'month' ? '#FFF' : theme.textSecondary
              }}>
                {t('history.tabs.month')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contentContainer}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
          >
        {/* 期間説明 */}
        <View style={styles.freeRangeContainer}>
          <Text style={[styles.freeRangeText, { color: theme.textSecondary }]}>
            {activeTab === 'week' ? t('history.free.last7Days') : t('history.free.last30Days')}
          </Text>
        </View>

        <View style={[styles.summaryContainer, { backgroundColor: theme.card, borderLeftWidth: 4, borderLeftColor: theme.accent }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <MaterialCommunityIcons name="walk" size={22} color={theme.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.summaryTitle, { color: theme.text, fontFamily: serifFont, marginBottom: 0 }]}>
              {activeTab === 'week' ? t('history.summary.titleWeek') : t('history.summary.titleMonth')}
            </Text>
            {goalAchievedDays > 0 && (
              <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD93D20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ fontSize: 14 }}>🏆</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#D4A500', marginLeft: 4 }}>{t('history.summary.daysAchieved', { count: goalAchievedDays })}</Text>
              </View>
            )}
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('history.summary.totalSteps')}</Text>
              <Text style={[styles.summaryValue, { color: theme.text, fontFamily: serifFont }]}>{formatNumber(totalSteps)}</Text>
              <Text style={[styles.summaryUnit, { color: theme.textSecondary }]}>{t('units.steps')}</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={styles.divider} />
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('history.summary.averageSteps')}</Text>
              <Text style={[styles.summaryValue, { color: theme.text, fontFamily: serifFont }]}>{formatNumber(averageSteps)}</Text>
              <Text style={[styles.summaryUnit, { color: theme.textSecondary }]}>{t('history.unit.stepsPerDay')}</Text>
            </View>
          </View>
          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('history.summary.totalCalories')}</Text>
              <Text style={[styles.summaryValue, { color: theme.text, fontFamily: serifFont, fontSize: 24 }]}>{formatNumber(Math.round(totalCalories))}</Text>
              <Text style={[styles.summaryUnit, { color: '#FF6B35', fontWeight: '600' }]}>{t('units.kcal')}</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={styles.divider} />
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('history.summary.distance')}</Text>
              <Text style={[styles.summaryValue, { color: theme.text, fontFamily: serifFont, fontSize: 24 }]}>{totalDistance.toFixed(1)}</Text>
              <Text style={[styles.summaryUnit, { color: theme.accent, fontWeight: '600' }]}>km</Text>
            </View>
          </View>
        </View>

        {/* 直近データグラフ（Free + Pro両方） */}
        {renderRecentChart()}

        {/* Free用: Pro誘導カード（グラフの下） */}
        {!isPremium && (
          <TouchableOpacity
            onPress={presentPaywall}
            activeOpacity={0.8}
            style={[styles.proPromoCard, { backgroundColor: theme.card }]}
          >
            <View style={styles.proPromoContent}>
              <View style={styles.proPromoIcon}>
                <MaterialCommunityIcons name="crown" size={24} color="#FFD700" />
              </View>
              <View style={styles.proPromoTextContainer}>
                <Text style={[styles.proPromoTitle, { color: theme.text }]}>
                  {activeTab === 'week' ? t('history.promo.weekTitle') : t('history.promo.monthTitle')}
                </Text>
                <Text style={[styles.proPromoDesc, { color: theme.textSecondary }]}>
                  {activeTab === 'week' ? t('history.promo.weekDesc') : t('history.promo.monthDesc')}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
            </View>
          </TouchableOpacity>
        )}

        {/* Pro用: カレンダーグラフ（スワイプ可能） */}
        {renderCalendarChart()}

        <View style={[styles.dailyDataContainer, { backgroundColor: theme.card, borderLeftWidth: 4, borderLeftColor: theme.accent }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <MaterialCommunityIcons name="calendar-clock" size={20} color={theme.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>{t('history.section.dailyData')}</Text>
          </View>
          {historyData.map((dayData, index) => renderDayItem(dayData, index))}
        </View>
          </ScrollView>
        </View>
      </View>
    </ImageBackground>
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
  // Pro用ナビゲーション
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  navButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  navLabelContainer: {
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  currentBadge: {
    backgroundColor: '#00A896',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  currentBadgeText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  // Free用期間説明
  freeRangeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 8,
  },
  freeRangeText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Pro誘導カード
  proPromoCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFD70050',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  proPromoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proPromoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD70020',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  proPromoTextContainer: {
    flex: 1,
  },
  proPromoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  proPromoDesc: {
    fontSize: 12,
  },
  // カレンダーグラフ用
  calendarNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarNavButton: {
    padding: 8,
  },
  calendarNavLabelContainer: {
    alignItems: 'center',
  },
  calendarNavLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  swipeHint: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  calendarStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  calendarStatItem: {
    alignItems: 'center',
  },
  calendarStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  calendarStatLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  // カルーセル用
  carouselContainer: {
    overflow: 'hidden',
    marginHorizontal: -15,
  },
  carouselTrack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carouselSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  carouselPeriodLabel: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  carouselEndIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
    width: '100%',
  },
  swipeIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  swipeIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  swipeIndicatorDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
