import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  AppState,
  useColorScheme,
  Modal,
  ActivityIndicator,
  Animated,
  PanResponder,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Pedometer } from 'expo-sensors';
import * as Progress from 'react-native-progress';
import { getTheme } from '../utils/theme';
import { useI18n } from '../i18n/I18nProvider';
import {
  calculateCalories,
  calculateDistance,
  calculateGoalProgress,
  getTodayDateString,
} from '../utils/calculations';
import {
  getTodayData,
  saveTodayData,
  getUserProfile,
  getSettings,
  getFavorites,
  getHealthSyncEnabled,
  getHourlyStepsForDate,
  saveHourlyStepsForDate,
} from '../utils/storage';
import {
  getCachedTodayData,
  cacheTodayData,
  getLatestCachedData,
} from '../utils/cache';
import { getFoodById, calculateFoodAmount } from '../data/foodDatabase';
import { getCurrentGoal, isGoalAchieved } from '../data/dailyGoals';
import { getOrCreateTodayGoals, getOrCreateGoalsForDate } from '../utils/dynamicGoals';
import { getCurrentGoalLevel, saveCurrentGoalLevel, getCurrentGoalLevelDate, saveCurrentGoalLevelDate } from '../utils/storage';
import DailyFoodGoal from '../components/DailyFoodGoal';
import {
  initializePedometer,
} from '../utils/pedometer';
import {
  requestNotificationPermissions,
  sendGoalAchievedNotification,
  sendImmediateNotification,
  getEncouragementMessage,
  setupNotificationListeners,
  canSendProgressNotification,
  markProgressNotificationSent,
  updatePersistentWidget,
} from '../utils/notifications';
import { logEvent } from '../utils/analytics';
import { getStepsHybrid, startStepsBackgroundUpdates } from '../utils/healthKit';
import { CalendarIcon } from '../components/SettingsIcons';
import { getEventsForDate, getEventsSummary } from '../utils/calendar';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  // 日付関連（週単位のスライドウィンドウ）
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStartDate, setWeekStartDate] = useState(() => {
    // 今週の月曜日を取得
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day; // 日曜日は-6、それ以外は月曜日まで
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [calendarDates, setCalendarDates] = useState([]);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [weeklyData, setWeeklyData] = useState({}); // 週間データ { 'YYYY-MM-DD': { steps, calories } }
  const [monthlyData, setMonthlyData] = useState({}); // 月間データ { 'YYYY-MM-DD': { steps, calories } }
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [activeTab, setActiveTab] = useState('steps'); // 'steps' or 'calories'
  const [steps, setSteps] = useState(0);
  const [calories, setCalories] = useState(0);
  const [distance, setDistance] = useState(0);
  const [goal, setGoal] = useState(10000);
  const [goalCalories, setGoalCalories] = useState(500); // 目標カロリー
  const [progress, setProgress] = useState(0);
  const [caloriesProgress, setCaloriesProgress] = useState(0);
  const [favorites, setFavorites] = useState(['ramen', 'onigiri', 'beer']);
  const [profile, setProfile] = useState({ height: 170, weight: 65, stride: 72 });
  const [currentGoalLevel, setCurrentGoalLevel] = useState(1);
  const [todayGoals, setTodayGoals] = useState([]);
  const [isPedometerAvailable, setIsPedometerAvailable] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hourlySteps, setHourlySteps] = useState(Array(24).fill(0));
  const selectedLoadTokenRef = useRef(0);
  const selectedDebounceTimerRef = useRef(null);
  const lastRefreshRef = useRef(0);
  const [todayEvents, setTodayEvents] = useState([]); // 今日のカレンダーイベント
  // インライン通知は使用しない
  const [inlineNotice, setInlineNotice] = useState('');
  const [weeklyDisplayMode, setWeeklyDisplayMode] = useState('calories'); // 'calories' | 'steps'
  const [hourlyTooltip, setHourlyTooltip] = useState({ index: -1, value: 0 });
  // タイマーは使わず、押下中のみ表示
  const hourlyTooltipTimerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [selectedGoalsLevel, setSelectedGoalsLevel] = useState(1);
  const [hourlyDetailTooltip, setHourlyDetailTooltip] = useState({ visible: false, hour: -1 });
  const hourlyDetailTimerRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pullToRefreshIndicator, setPullToRefreshIndicator] = useState(false); // リフレッシュ引っ張りインジケーター
  const [calendarPullIndicator, setCalendarPullIndicator] = useState({ left: false, right: false }); // カレンダー引っ張りインジケーター
  const [mainSwipeIndicator, setMainSwipeIndicator] = useState({ left: false, right: false }); // メイン画面スワイプインジケーター
  const appState = useRef(AppState.currentState);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bumpAnim = useRef(new Animated.Value(1)).current; // 値更新時のワンショット弾む演出
  // 円アニメ用（近接パルス/値更新バンプ）のみ維持
  const pulseLoopRef = useRef(null);
  const goalReachedRef = useRef({ steps: false, calories: false });
  const levelUpLockRef = useRef(false); // レベルアップの同時実行防止
  const slideAnim = useRef(new Animated.Value(0)).current; // 日付切替のスライド
  const selectedDateRef = useRef(selectedDate); // PanResponder内で最新日付を参照
  const weekStartDateRef = useRef(weekStartDate); // PanResponder内で最新週開始日を参照
  const calendarScrollRef = useRef(null); // カレンダースクロールのref
  const isChangingWeekRef = useRef(false); // 週切り替え中フラグ
  const calendarAnimValues = useRef(Array(7).fill(0).map(() => new Animated.Value(1))).current; // カレンダーアイテムのアニメーション
  let Haptics = null;
  try {
    // 存在する環境のみ使用（依存未追加でも壊れないように）
    // eslint-disable-next-line global-require
    Haptics = require('expo-haptics');
  } catch (e) {
    Haptics = null;
  }

  // 🌙 ダークモード対応
  const systemColorScheme = useColorScheme();
  const theme = getTheme(systemColorScheme);

  // セーフエリア対応
  const insets = useSafeAreaInsets();
  const { t, formatNumber, getWeekdayShort, formatWeekRange: i18nFormatWeekRange, locale } = useI18n();
  // 週バー表示モードはタブに追従（歩数タブ=歩、カロリータブ=kcal）
  useEffect(() => {
    setWeeklyDisplayMode(activeTab === 'calories' ? 'calories' : 'steps');
  }, [activeTab]);

  // 週バーの表示モードはタブに追従（歩数タブ=歩、カロリータブ=kcal）
  useEffect(() => {
    setWeeklyDisplayMode(activeTab === 'calories' ? 'calories' : 'steps');
  }, [activeTab]);

  // 日付変更用のスワイプジェスチャー
  const panResponder = useMemo(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // 横方向のスワイプを軽く検出 + フリックも許容
        const horizontalBias = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.1 || Math.abs(gestureState.vx) > Math.abs(gestureState.vy);
        return (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.vx) > 0.15) && horizontalBias;
      },
      onPanResponderGrant: () => {
        slideAnim.setValue(0);
        setMainSwipeIndicator({ left: false, right: false });
      },
      onPanResponderMove: (evt, gestureState) => {
        // 指に追従して少しだけスライド
        slideAnim.setValue(gestureState.dx);

        // インジケーター表示（閾値30px）
        const threshold = 30;
        setMainSwipeIndicator({
          left: gestureState.dx > threshold, // 右スワイプ（前の日へ）
          right: gestureState.dx < -threshold, // 左スワイプ（次の日へ）
        });
      },
      onPanResponderRelease: (evt, gestureState) => {
        // インジケーターを非表示
        setMainSwipeIndicator({ left: false, right: false });
        const distThreshold = 40; // ある程度の距離
        const velocityThreshold = 0.2; // 速度重視: 軽いフリックで反応
        const dx = gestureState.dx;
        const vx = gestureState.vx;

        const tryChange = async (direction) => {
          // 未来日は不可判定
          const base = selectedDateRef.current;
          const candidate = new Date(base);
          candidate.setDate(base.getDate() + direction);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);
          if (candidate > todayEnd) {
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
            return;
          }

          const outTo = direction < 0 ? width : -width; // prev: 右スワイプ=左方向へ表示移動
          Animated.timing(slideAnim, { toValue: outTo, duration: 140, useNativeDriver: true }).start(() => {
            // 日付更新（週も必要なら更新）
            const oldWeekStart = weekStartDateRef.current;
            const newDate = candidate;

            // 週の範囲チェック
            const weekEnd = new Date(oldWeekStart);
            weekEnd.setDate(oldWeekStart.getDate() + 6);
            if (newDate < oldWeekStart || newDate > weekEnd) {
              const day = newDate.getDay();
              const diff = day === 0 ? -6 : 1 - day;
              const newWeekStart = new Date(newDate);
              newWeekStart.setDate(newDate.getDate() + diff);
              newWeekStart.setHours(0, 0, 0, 0);
              setWeekStartDate(newWeekStart);
            }
            setSelectedDate(newDate);
            if (Haptics?.impactAsync) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }

            // 反対側から戻す
            slideAnim.setValue(direction < 0 ? -width : width);
            Animated.timing(slideAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start();
          });
        };

        // 速度優先: 軽いフリックで素早く反応
        if (vx > velocityThreshold || dx > distThreshold) {
          // 右スワイプ: 前の日
          tryChange(-1);
        } else if (vx < -velocityThreshold || dx < -distThreshold) {
          // 左スワイプ: 次の日
          tryChange(1);
        } else {
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  , [slideAnim, width, selectedDateRef, weekStartDateRef, Haptics]);

  // 月モーダル内の左右スワイプで月移動
  // 月モーダルのスワイプ操作は削除（◀/▶ボタンのみで切替）

  // 日付を変更する関数
  const changeDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + direction);

    // 未来の日付には進めない
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (newDate > today) {
      return;
    }

    setSelectedDate(newDate);
    if (Haptics?.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    // 新しい日付が現在の週の範囲外なら週も変更
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekStartDate.getDate() + 6);
    if (newDate < weekStartDate || newDate > weekEnd) {
      const newWeekStart = new Date(newDate);
      const day = newDate.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      newWeekStart.setDate(newDate.getDate() + diff);
      newWeekStart.setHours(0, 0, 0, 0);
      setWeekStartDate(newWeekStart);
    }
  };

  // Refsを最新に保つ
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);
  useEffect(() => {
    weekStartDateRef.current = weekStartDate;
  }, [weekStartDate]);

  // カレンダー用の日付配列を生成（週の7日分）
  useEffect(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(weekStartDate.getDate() + i);
      dates.push(date);
    }
    setCalendarDates(dates);

    // 週が変わったら、その週のデータを取得
    loadWeeklyData(dates);
  }, [weekStartDate]);

  // 月データを取得
  const loadMonthlyData = async (baseDate = new Date()) => {
    try {
      const isAvailable = await Pedometer.isAvailableAsync();
      if (!isAvailable) {
        console.log('Pedometer is not available');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const data = {};
      const userProfile = await getUserProfile();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        // 未来の日付はスキップ
        if (date > todayDate) {
          continue;
        }

        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        // 今日の場合は現在時刻まで
        if (date.toDateString() === todayDate.toDateString()) {
          end.setTime(Date.now());
        }

        try {
          const result = await Pedometer.getStepCountAsync(start, end);
          const dateKey = date.toISOString().split('T')[0];

          data[dateKey] = {
            steps: result.steps,
            calories: calculateCalories(result.steps, userProfile.weight),
          };
        } catch (error) {
          console.error(`Failed to get steps for ${date.toDateString()}:`, error);
        }
      }

      setMonthlyData(data);
    } catch (error) {
      console.error('Error loading monthly data:', error);
    }
  };

  // 過去1週間分のデータを取得（並列取得 + キャンセルセーフ）
  const weekLoadTokenRef = useRef(0);
  const loadWeeklyData = async (dates) => {
    try {
      const isAvailable = await Pedometer.isAvailableAsync();
      if (!isAvailable) {
        console.log('Pedometer is not available');
        return;
      }

      const data = {};
      const userProfile = await getUserProfile();

      const token = ++weekLoadTokenRef.current;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const results = await Promise.all(dates.map(async (date) => {
        if (date > today) return null;
        const start = new Date(date); start.setHours(0, 0, 0, 0);
        const end = new Date(date); end.setHours(23, 59, 59, 999);
        if (date.toDateString() === today.toDateString()) end.setTime(Date.now());
        try {
          const res = await Pedometer.getStepCountAsync(start, end);
          return { key: date.toISOString().split('T')[0], steps: res.steps };
        } catch (e) {
          console.error(`Failed to get steps for ${date.toDateString()}:`, e);
          return { key: date.toISOString().split('T')[0], steps: 0 };
        }
      }));

      if (weekLoadTokenRef.current !== token) return; // 新しいリクエストに負けたら破棄

      for (const r of results) {
        if (!r) continue;
        data[r.key] = {
          steps: r.steps,
          calories: calculateCalories(r.steps, userProfile.weight),
        };
      }

      setWeeklyData(data);
    } catch (error) {
      console.error('Error loading weekly data:', error);
    }
  };

  // 週の期間をローカライズして表示
  // 使用: i18nFormatWeekRange(weekStartDate)

  // カレンダーカードのアニメーション
  const animateCalendarCards = (direction) => {
    // 各カードを順番にアニメーション
    const animations = calendarAnimValues.map((anim, index) => {
      // まず縮小＋移動
      anim.setValue(0);
      return Animated.timing(anim, {
        toValue: 1,
        duration: 250,
        delay: index * 30, // 順番にアニメーション
        useNativeDriver: true,
      });
    });

    Animated.parallel(animations).start();
  };

  // 週を前後に移動
  const changeWeek = (direction) => {
    isChangingWeekRef.current = true;
    const newWeekStart = new Date(weekStartDate);
    newWeekStart.setDate(weekStartDate.getDate() + (direction * 7));
    setWeekStartDate(newWeekStart);

    // 選択中の日付も同じ週内に維持
    const newSelected = new Date(selectedDate);
    newSelected.setDate(selectedDate.getDate() + (direction * 7));
    setSelectedDate(newSelected);

    // アニメーション実行
    animateCalendarCards(direction);
    setTimeout(() => { isChangingWeekRef.current = false; }, 200);
  };

  // カレンダースクロール中のインジケーター表示
  const handleCalendarScroll = (event) => {
    if (isChangingWeekRef.current) return;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollX = contentOffset.x;
    const contentWidth = contentSize.width;
    const viewWidth = layoutMeasurement.width;

    const threshold = 50;
    const leftPulling = scrollX < -20; // 左に引っ張り始めた
    const rightPulling = scrollX + viewWidth > contentWidth + 20; // 右に引っ張り始めた

    setCalendarPullIndicator({
      left: leftPulling,
      right: rightPulling,
    });
  };

  // カレンダースクロール時の週切り替え検知（指を離した時のみ）
  const handleCalendarScrollEnd = (event) => {
    // インジケーターを非表示
    setCalendarPullIndicator({ left: false, right: false });

    if (isChangingWeekRef.current) return;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollX = contentOffset.x;
    const contentWidth = contentSize.width;
    const viewWidth = layoutMeasurement.width;

    // 閾値: より強く引っ張らないと切り替わらないように
    const edgeThreshold = -50; // 左端から50px以上オーバースクロール
    const rightEdgeThreshold = 50; // 右端から50px以上オーバースクロール

    // 左端に到達（前の週へ）- 意図的に引っ張って止める必要がある
    if (scrollX < edgeThreshold) {
      isChangingWeekRef.current = true;
      changeWeek(-1);
      if (Haptics?.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      // 少し待ってから中央にスクロール
      setTimeout(() => {
        calendarScrollRef.current?.scrollTo({ x: 100, animated: false });
        isChangingWeekRef.current = false;
      }, 100);
    }
    // 右端に到達（次の週へ）- 意図的に引っ張って止める必要がある
    else if (scrollX + viewWidth > contentWidth + rightEdgeThreshold) {
      isChangingWeekRef.current = true;
      changeWeek(1);
      if (Haptics?.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      // 少し待ってから中央にスクロール
      setTimeout(() => {
        calendarScrollRef.current?.scrollTo({ x: contentWidth - viewWidth - 100, animated: false });
        isChangingWeekRef.current = false;
      }, 100);
    }
  };

  // 今日かどうか判定
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // 未来の日付かどうか判定
  const isFuture = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };

  // 進捗スイープの手動制御は撤廃（ライブラリの標準animatedに戻す）

  // 選択された日付が変更されたときの更新（デバウンス）
  useEffect(() => {
    if (selectedDebounceTimerRef.current) clearTimeout(selectedDebounceTimerRef.current);
    selectedDebounceTimerRef.current = setTimeout(() => {
      loadSelectedDateData();
    }, 150);
    return () => {
      if (selectedDebounceTimerRef.current) clearTimeout(selectedDebounceTimerRef.current);
    };
  }, [selectedDate]);

  // 選択された日付のデータを取得
  const loadSelectedDateData = async () => {
    try {
      const isAvailable = await Pedometer.isAvailableAsync();
      if (!isAvailable) {
        console.log('Pedometer is not available');
        return;
      }

      const dateKey = selectedDate.toISOString().split('T')[0];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedStart = new Date(selectedDate);
      selectedStart.setHours(0, 0, 0, 0);

      // 未来の日付（翌日以降）の場合は何もしない
      if (selectedStart > today) {
        setSteps(0);
        setCalories(0);
        setDistance(0);
        setProgress(0);
        setHourlySteps(Array(24).fill(0));
        return;
      }

      // その日の開始と終了時刻
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);

      // 今日の場合は現在時刻まで
      const isSelectedToday = selectedStart.toDateString() === today.toDateString();
      if (isSelectedToday) {
        end.setTime(Date.now());
      }

      const result = await Pedometer.getStepCountAsync(start, end);
      const userProfile = await getUserProfile();
      const settings = await getSettings();

      const daySteps = result.steps;
      const dayCalories = calculateCalories(daySteps, userProfile.weight);
      const dayDistance = calculateDistance(daySteps, userProfile.stride);
      const dayProgress = calculateGoalProgress(daySteps, settings.dailyGoal);
      const dayCaloriesProgress = (dayCalories / goalCalories) * 100;

      setSteps(daySteps);
      setCalories(dayCalories);
      setDistance(dayDistance);
      const nextNorm = dayProgress / 100;
      setProgress(nextNorm);
      setCaloriesProgress(dayCaloriesProgress / 100);

      // スイープの手動制御はしない（標準animatedに任せる）

      // 値が大きく変わったときは、過去日でも軽い“弾む”演出を適用
      try {
        const prev = progress; // 現在のstate（0-1）
        const next = dayProgress / 100; // 新しい進捗（0-1）
        if (Math.abs(next - prev) > 0.005) {
          bumpAnim.stopAnimation(() => {
            bumpAnim.setValue(1);
            Animated.sequence([
              Animated.timing(bumpAnim, { toValue: 1.06, duration: 180, useNativeDriver: true }),
              Animated.timing(bumpAnim, { toValue: 1.0, duration: 250, useNativeDriver: true }),
            ]).start();
          });
        }
      } catch (_) {}

      // 過去日100%の特別演出は無効化

      // 時間帯別のデータを取得（今日のみ詳細、過去日はキャッシュがあれば表示）
      if (isSelectedToday) {
        const hourlyData = Array(24).fill(0);
        const currentHour = new Date().getHours();
        for (let hour = 0; hour <= currentHour; hour++) {
          const hourStart = new Date(selectedDate);
          hourStart.setHours(hour, 0, 0, 0);
          const hourEnd = new Date(selectedDate);
          hourEnd.setHours(hour, 59, 59, 999);
          if (hour === currentHour) hourEnd.setTime(Date.now());
          try {
            const hourResult = await Pedometer.getStepCountAsync(hourStart, hourEnd);
            hourlyData[hour] = hourResult.steps;
          } catch (error) {
            console.warn(`Failed to get steps for hour ${hour}:`, error);
          }
        }
        setHourlySteps(hourlyData);
        try { await saveHourlyStepsForDate(dateKey, hourlyData); } catch (_) {}
      } else {
        try {
          const cachedHourly = await getHourlyStepsForDate(dateKey);
          if (cachedHourly) setHourlySteps(cachedHourly);
          else setHourlySteps(Array(24).fill(0));
        } catch (_) {
          setHourlySteps(Array(24).fill(0));
        }
      }

      // 選択日のゴールを取得（今日/過去共通）
      try {
        const goalsForDate = await getOrCreateGoalsForDate(selectedStart);
        setSelectedGoals(goalsForDate);
        // 過去日の表示用に「次に目指す段階」を計算（cal < goal の最初）
        const idx = goalsForDate.findIndex(g => dayCalories < g.food.calories);
        setSelectedGoalsLevel(idx === -1 ? goalsForDate.length : idx + 1);
      } catch (_) {}

      // カレンダーイベントを取得
      try {
        const events = await getEventsForDate(selectedDate);
        setTodayEvents(events);
      } catch (calendarError) {
        console.log('Calendar not available:', calendarError);
        setTodayEvents([]);
      }
    } catch (error) {
      console.error('Error loading selected date data:', error);
    }
  };

  useEffect(() => {
    // 🚀 起動1秒表示: キャッシュから即座に読み込み
    loadCachedData();

    // バックグラウンドで最新データを取得
    loadData();
    setupPedometer();
    initializeApp();

    // ⚡ リアルタイム自動更新: アプリがフォアグラウンドに戻った時に更新
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  // 画面がフォーカスされたときにお気に入りを再読み込み
  useFocusEffect(
    React.useCallback(() => {
      const reloadFavorites = async () => {
        const userFavorites = await getFavorites();
        setFavorites(userFavorites.slice(0, 3));
      };
      const reloadSettings = async () => {
        const s = await getSettings();
        setGoal(s.dailyGoal);
        setGoalCalories(s.goalCalories || 500);
        // カロリー進捗の再計算（現在のcaloriesに対して）
        setCaloriesProgress((prev) => {
          const base = calories;
          const target = s.goalCalories || 500;
          return target > 0 ? base / target : 0;
        });
      };
      reloadFavorites();
      reloadSettings();
    }, [])
  );

  // アプリの状態が変わった時の処理
  const handleAppStateChange = async (nextAppState) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      console.log('⚡ アプリがフォアグラウンドに復帰 - データを自動更新');
      await ensureTodayGoalLevelStart();
      try { setTodayGoals(await getOrCreateTodayGoals()); } catch (_) {}
      await refreshData();
    }
    appState.current = nextAppState;
  };

  // データを強制的に更新（フォアグラウンド復帰時）
  const refreshData = async () => {
    // 選択されている日付のデータを再取得
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isSelectedToday = selectedDate.toDateString() === today.toDateString();

    if (isSelectedToday) {
      const nowTs = Date.now();
      if (nowTs - (lastRefreshRef.current || 0) < 2000) return;
      lastRefreshRef.current = nowTs;
      // 今日の場合は updateSteps で更新（ハイブリッド取得）
      try {
        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const result = await getStepsHybrid(start, end);
        console.log(`🔄 更新: ${result.steps}歩 (ソース: ${result.source})`);

        if (result.steps > 0 || result.source !== 'none') {
          updateSteps(result.steps);
        }
      } catch (error) {
        console.error('歩数データ更新に失敗:', error);
      }
    } else {
      // 今日以外の場合は選択日付のデータを再取得
      await loadSelectedDateData();
    }
  };

  // キャッシュから即座にデータを表示（0.1秒以内）
  const loadCachedData = async () => {
    try {
      const cached = await getCachedTodayData();
      if (cached) {
        setSteps(cached.steps);
        setCalories(cached.calories);
        setDistance(cached.distance);
        setProgress(calculateGoalProgress(cached.steps, cached.goal || 10000) / 100);
        console.log('✅ キャッシュからデータを表示しました');
      }
    } catch (error) {
      console.error('キャッシュの読み込みに失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeApp = async () => {
    // 通知の権限をリクエスト
    await requestNotificationPermissions();

    // 通知リスナーを設定
    const subscription = setupNotificationListeners((data) => {
      console.log('通知がタップされました:', data);
      try { logEvent('notification_opened', { type: data?.type || 'unknown' }); } catch (_) {}
      // 必要に応じて画面遷移などの処理を追加
    });

    // 歩数計の初期化
    try {
      const initialized = await initializePedometer();
      if (initialized) {
        console.log('歩数計が有効化されました');
      }
    } catch (error) {
      console.error('歩数計の初期化に失敗:', error);
      // 🌍 オフライン対応: エラー時はキャッシュデータを使用（既に表示済み）
      const latestCache = await getLatestCachedData();
      if (latestCache) {
        console.log('📦 オフラインモード: キャッシュデータを使用');
      }
    }

    // HealthKit背景更新（通知用）
    try {
      const enabled = await getHealthSyncEnabled();
      if (enabled) {
        console.log('🔔 HealthKit背景更新を開始（通知用）');
        await startStepsBackgroundUpdates();
      }
    } catch (e) {
      console.warn('背景歩数更新の開始に失敗（オプショナル）', e);
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  };

  const loadData = async () => {
    const todayData = await getTodayData();
    // 毎日レベル1から: 日付が変わっていたらリセット
    await ensureTodayGoalLevelStart();
    const userProfile = await getUserProfile();
    const settings = await getSettings();
    const userFavorites = await getFavorites();
    const goalLevel = await getCurrentGoalLevel();
    const goals = await getOrCreateTodayGoals();

    setProfile(userProfile);
    setGoal(settings.dailyGoal);
    // カロリー目標を設定から反映（未設定時は500kcal）
    setGoalCalories(settings.goalCalories || 500);
    setFavorites(userFavorites.slice(0, 3));
    setCurrentGoalLevel(goalLevel);
    setTodayGoals(goals);

    if (todayData) {
      setSteps(todayData.steps);
      setCalories(todayData.calories);
      setDistance(todayData.distance);
      // プログレスは0-1で保持
      setProgress(calculateGoalProgress(todayData.steps, settings.dailyGoal) / 100);
      setCaloriesProgress((todayData.calories / (settings.goalCalories || 500)));

      // 毎日リセット方針のため、前日達成による持ち越しは行わない
    }
  };

  // プルトゥリフレッシュ: データを再読み込み
  const onRefresh = async () => {
    setRefreshing(true);
    setPullToRefreshIndicator(false);
    try {
      // 歩数データをリロード
      await loadData();
      // 選択日のデータをリロード（カレンダーイベント含む）
      await loadSelectedDateData();
      // ハプティックフィードバック
      if (Haptics?.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // スクロールハンドラ: プルトゥリフレッシュのインジケーター表示
  const handleScroll = (event) => {
    if (refreshing) return;
    const scrollY = event.nativeEvent.contentOffset.y;
    // 上に引っ張っている（scrollYが負の値）
    setPullToRefreshIndicator(scrollY < -30);
  };

  // 毎日レベル1から: 最終リセット日と今日の日付を比較し、必要ならリセット
  const ensureTodayGoalLevelStart = async () => {
    try {
      const today = getTodayDateString();
      const last = await getCurrentGoalLevelDate();
      if (last !== today) {
        await saveCurrentGoalLevel(1);
        await saveCurrentGoalLevelDate(today);
        setCurrentGoalLevel(1);
        console.log('🔁 目標レベルをリセット（新しい日）');
      }
    } catch (error) {
      console.error('Error ensuring daily goal level reset:', error);
    }
  };

  // 食べ物目標達成チェック - その日中にレベルアップ
  const checkFoodGoalAchievement = async (currentCalories) => {
    try {
      if (levelUpLockRef.current) return; // 多重実行を防止
      const currentDynamic = todayGoals[currentGoalLevel - 1] || getCurrentGoal(currentGoalLevel);

      // 現在のカロリーが目標カロリー以上かチェック
      if (isGoalAchieved(currentCalories, currentDynamic.food.calories)) {
        levelUpLockRef.current = true;
        // 次のレベルを取得（段階は+1ずつ）
        const newLevel = currentGoalLevel + 1;
        const nextGoal = todayGoals[newLevel - 1] || getCurrentGoal(newLevel);

        // 次のレベルが存在するかチェック（最大レベルに達していないか）
        if (nextGoal && nextGoal.id !== currentDynamic.id) {
          // レベルアップ処理
          await saveCurrentGoalLevel(newLevel);
          setCurrentGoalLevel(newLevel);

          console.log('🎉 食べ物レベルアップ！', {
            oldLevel: currentGoalLevel,
            newLevel: newLevel,
            oldFood: currentDynamic.food.name,
            newFood: nextGoal.food.name,
            currentCalories: currentCalories
          });
          // 段階通知は送らない（全体ポリシー: 80%/100% のみ）
        } else {
          console.log('✨ 最高レベル達成！', currentDynamic.food.name);
        }
      }
    } catch (error) {
      console.error('Error checking food goal achievement:', error);
    } finally {
      levelUpLockRef.current = false;
    }
  };

  const setupPedometer = async () => {
    try {
      const isAvailable = await Pedometer.isAvailableAsync();
      setIsPedometerAvailable(isAvailable);

      if (isAvailable) {
        // ハイブリッド取得: HealthKit優先、Pedometerフォールバック
        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const result = await getStepsHybrid(start, end);
        console.log(`📊 歩数取得: ${result.steps}歩 (ソース: ${result.source})`);

        if (result.steps > 0 || result.source !== 'none') {
          updateSteps(result.steps);
        }

        // Subscribe to real-time updates
        // 注意: watchStepCountは増分を返すため、再度getStepCountAsyncで合計を取得
        const subscription = Pedometer.watchStepCount(result => {
          // 歩数が更新されたら、今日の合計を再取得（ハイブリッド）
          refreshData();
        });

        return () => subscription && subscription.remove();
      }
    } catch (error) {
      console.error('歩数計のセットアップに失敗:', error);
      // 🌍 オフライン対応: エラー時はキャッシュデータを使用（既に表示済み）
      setIsPedometerAvailable(false);
    }
  };

  // Pedometerからのデータを更新（アプリ内で計算）
  const updateSteps = async (newSteps) => {
    const oldSteps = steps;
    setSteps(newSteps);
    // 体重を考慮した歩行カロリー計算
    const cal = calculateCalories(newSteps, profile.weight);
    const dist = calculateDistance(newSteps, profile.stride);
    const prog = calculateGoalProgress(newSteps, goal);

    setCalories(cal);
    setDistance(dist);
    const nextNorm = prog / 100;
    setProgress(nextNorm);

    const data = {
      date: getTodayDateString(),
      steps: newSteps,
      calories: cal,
      distance: dist,
      hourlySteps: [],
      goal: goal,
    };

    // Save to storage
    await saveTodayData(data);

    // 🚀 キャッシュにも保存（起動高速化）
    await cacheTodayData(data);

    // 食べ物目標達成チェック - その日中にレベルアップ
    await checkFoodGoalAchievement(cal);

    // 分析: 同期イベント（Pedometerアプリ内計測）
    try {
      await logEvent('steps_synced', {
        date: data.date,
        steps: newSteps,
        provider: 'pedometer',
      });
    } catch (_) {}

    // 通知の送信（バランス: 80%/100% のみ + CD/上限）
    const settings = await getSettings();
    if (settings.notifications) {
      const prevProgress = (oldSteps / goal) * 100;
      const newProgress = (newSteps / goal) * 100;
      // 80%達成時にインライン通知（静かめ）
      // 80%時のインライン通知は出さない
      if (prevProgress < 100 && newProgress >= 100) {
        if (await canSendProgressNotification()) {
          await sendGoalAchievedNotification(newSteps, goal);
          await markProgressNotificationSent();
        }
      }

      // 常駐型通知ウィジェットを更新（音なし、リアルタイム更新）
      try {
        // 次の食べ物目標を取得
        const currentGoals = todayGoals.length > 0 ? todayGoals : [];
        const nextGoalIndex = currentGoals.findIndex(g => cal < g.food.calories);
        let nextFoodName = null;
        let nextFoodCalories = null;

        if (nextGoalIndex !== -1) {
          const nextGoal = currentGoals[nextGoalIndex];
          nextFoodName = nextGoal.food.name;
          nextFoodCalories = nextGoal.food.calories - cal;
        }

        await updatePersistentWidget(newSteps, goal, cal, nextFoodName, nextFoodCalories);
      } catch (err) {
        console.log('常駐通知更新エラー（スキップ）:', err);
      }
      }

    // スイープの手動制御はしない（標準animatedに任せる）

    // 小気味よい弾む演出（大きく変化したとき）
    try {
      const prev = (oldSteps / Math.max(1, goal));
      if (nextNorm - prev > 0.005) {
        bumpAnim.stopAnimation(() => {
          bumpAnim.setValue(1);
          Animated.sequence([
            Animated.timing(bumpAnim, { toValue: 1.06, duration: 180, useNativeDriver: true }),
            Animated.timing(bumpAnim, { toValue: 1.0, duration: 250, useNativeDriver: true }),
          ]).start();
        });
      }
    } catch (_) {}

  };

  const renderFoodCard = (foodId) => {
    const food = getFoodById(foodId);
    if (!food) return null;

    const amount = calculateFoodAmount(calories, foodId);
    const unitKey = `food.items.${foodId}.unit`;
    const tUnit = t(unitKey);
    const displayUnit = tUnit === unitKey ? food.unit : tUnit;

    return (
      <TouchableOpacity
        key={foodId}
        style={[
          styles.foodCard,
          { backgroundColor: theme.card, borderColor: theme.border }
        ]}
      >
        <Text style={styles.foodEmoji}>{food.emoji}</Text>
        <Text style={[styles.foodAmount, { color: theme.primary }]}>{amount}</Text>
        <Text style={[styles.foodUnit, { color: theme.textSecondary }]}>{displayUnit}</Text>
      </TouchableOpacity>
    );
  };

  const isStepGoalAchieved = progress >= 1.0;
  const progressColor = isStepGoalAchieved ? theme.success : theme.accent;

  // ロケールに応じた日付表示（M/DまたはM月D日）
  const formatMonthDay = (date) => {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    if (locale === 'en') return `${m}/${d}`;
    if (locale === 'zh-Hans') return `${m}月${d}日`;
    return `${m}月${d}日`; // ja
  };

  const formatMonthYear = (date) => {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    if (locale === 'en') return `${y}/${m}`;
    if (locale === 'zh-Hans') return `${y}年${m}月`;
    return `${y}年${m}月`; // ja
  };

  // 80%でやさしいパルス、100%でハプティクス（対応端末）: 今日のみ
  useEffect(() => {
    const isSelectedToday = selectedDate.toDateString() === new Date().toDateString();
    const nearSteps = isSelectedToday && progress >= 0.8 && progress < 1.0;
    const nearCalories = isSelectedToday && caloriesProgress >= 0.8 && caloriesProgress < 1.0;
    const near = activeTab === 'steps' ? nearSteps : nearCalories;

    if (near) {
      if (!pulseLoopRef.current) {
        const seq = Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ]);
        const loop = Animated.loop(seq);
        loop.start();
        pulseLoopRef.current = loop;
      }
    } else {
      if (pulseLoopRef.current) {
        try { pulseLoopRef.current.stop(); } catch (_) {}
        pulseLoopRef.current = null;
      }
      pulseAnim.setValue(1);
    }
  }, [activeTab, progress, caloriesProgress, selectedDate]);

  useEffect(() => {
    const isSelectedToday = selectedDate.toDateString() === new Date().toDateString();
    const stepsReached = progress >= 1.0;
    const caloriesReached = caloriesProgress >= 1.0;
    if (isSelectedToday) {
      if (!goalReachedRef.current.steps && stepsReached && Haptics?.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      if (!goalReachedRef.current.calories && caloriesReached && Haptics?.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
    goalReachedRef.current = { steps: stepsReached, calories: caloriesReached };
  }, [progress, caloriesProgress, selectedDate]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }] }>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      {/* プルトゥリフレッシュインジケーター */}
      {pullToRefreshIndicator && !refreshing && (
        <View style={{
          position: 'absolute',
          top: 50,
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <View style={{
            backgroundColor: theme.primary,
            borderRadius: 25,
            padding: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 8,
          }}>
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>↓</Text>
          </View>
        </View>
      )}
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
      {isPedometerAvailable === false && (
        <View style={[styles.infoBanner, { backgroundColor: theme.card, borderColor: theme.border }] }>
          <Text style={{ color: theme.textSecondary }}>{t('home.banner.sensorUnavailable')}</Text>
        </View>
      )}
      {/* 週のナビゲーション */}
      <View style={[styles.dateNavigation, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('home.a11y.prevWeek')}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          onPress={() => changeWeek(-1)}
          style={styles.navButton}
        >
          <Text style={[styles.navButtonText, { color: theme.text }]}>◀</Text>
        </TouchableOpacity>
        <Text style={[styles.dateText, { color: theme.text }]}>
          {i18nFormatWeekRange(weekStartDate)}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('home.a11y.nextWeek')}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          onPress={() => changeWeek(1)}
          style={styles.navButton}
        >
          <Text style={[styles.navButtonText, { color: theme.text }]}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* 今日へ戻るチップ（右利き向けに右寄せ） */}
      {/* 配置: 横スクロールの週カレンダーの直下に表示 */}
      {/* カレンダーアイコン（画面右上固定） */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('home.a11y.openCalendar')}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        style={[styles.calendarIconButton, { top: insets.top + 10 }]}
        onPress={() => {
          setShowCalendarModal(true);
          loadMonthlyData(calendarMonth); // モーダルを開く時に当月データを取得
        }}
      >
        <CalendarIcon color={theme.text} size={24} />
      </TouchableOpacity>

      {/* インライン通知は非表示 */}

      {/* 歩数/カロリー タブ */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'steps' && styles.tabActive,
            { borderColor: activeTab === 'steps' ? theme.primary : 'transparent' }
          ]}
          onPress={() => setActiveTab('steps')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'steps' ? theme.primary : theme.textSecondary }
          ]}>
            🦶 {t('home.tabs.steps')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'calories' && styles.tabActive,
            { borderColor: activeTab === 'calories' ? theme.accent : 'transparent' }
          ]}
          onPress={() => setActiveTab('calories')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'calories' ? theme.accent : theme.textSecondary }
          ]}>
            🔥 {t('home.tabs.calories')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 週の操作ボタン群は削除（上部に重複する今日へをなくす） */}

      {/* 横スクロールカレンダー */}
      <View style={{ position: 'relative' }}>
        {/* 左端の引っ張りインジケーター */}
        {calendarPullIndicator.left && (
          <View style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            marginTop: -15,
            zIndex: 10,
            backgroundColor: theme.primary,
            borderRadius: 20,
            padding: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 5,
          }}>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>◀</Text>
          </View>
        )}
        {/* 右端の引っ張りインジケーター */}
        {calendarPullIndicator.right && (
          <View style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            marginTop: -15,
            zIndex: 10,
            backgroundColor: theme.primary,
            borderRadius: 20,
            padding: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 5,
          }}>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>▶</Text>
          </View>
        )}
        <ScrollView
          ref={calendarScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.calendarScroll}
          contentContainerStyle={styles.calendarContent}
          onScroll={handleCalendarScroll}
          onScrollEndDrag={handleCalendarScrollEnd}
          scrollEventThrottle={16}
          decelerationRate="fast"
        >
        {calendarDates.map((date, index) => {
          const selected = date.toDateString() === selectedDate.toDateString();
          const today = isToday(date);
          const future = isFuture(date);
          const dateKey = date.toISOString().split('T')[0];
          const dayData = weeklyData[dateKey];

          const animValue = calendarAnimValues[index] || new Animated.Value(1);
          const scale = animValue;
          const translateY = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          });
          const opacity = animValue.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0.5, 1],
          });

          return (
            <Animated.View
              key={index}
              style={{
                transform: [{ scale }, { translateY }],
                opacity,
              }}
            >
              <TouchableOpacity
                onPress={() => !future && setSelectedDate(date)}
                style={[
                  styles.calendarItem,
                  selected && styles.calendarItemSelected,
                  today && styles.calendarItemToday,
                  { backgroundColor: selected ? theme.primary : theme.card }
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
                    return Math.max(0, Math.min(1, stepsVal / (goal || 1)));
                  })();
                  const ringColor = ratio >= 1 ? theme.success : theme.accent;
                  return (
                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <Progress.Circle
                        size={34}
                        progress={ratio}
                        thickness={3}
                        borderWidth={0}
                        color={selected ? '#FFF' : ringColor}
                        unfilledColor={selected ? 'rgba(255,255,255,0.25)' : theme.circleUnfilled}
                      />
                      <Text style={[
                        styles.calendarRingDay,
                        { position: 'absolute', color: selected ? '#FFF' : future ? theme.textTertiary : theme.textSecondary }
                      ]}>
                        {date.getDate()}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <Text style={[
                styles.calendarWeekday,
                { color: selected ? '#FFF' : future ? theme.textTertiary : theme.textSecondary }
              ]}>
                {getWeekdayShort(date)}
              </Text>
              {!future && dayData && (
                <>
                  {weeklyDisplayMode === 'calories' ? (
                    <Text style={[styles.calendarCalories, { color: selected ? '#FFF' : theme.textSecondary }]}>
                      {dayData.calories.toFixed(0)} kcal
                    </Text>
                  ) : (
                    <Text style={[styles.calendarCalories, { color: selected ? '#FFF' : theme.textSecondary }]}>
                      {dayData.steps >= 1000 ? `${(dayData.steps / 1000).toFixed(1)}k` : dayData.steps} 歩
                    </Text>
                  )}
                </>
              )}
              {!future && !dayData && (
                <>
                  <Text style={[
                    styles.calendarCalories,
                    { color: selected ? '#FFF' : theme.textSecondary }
                  ]}>
                    -
                  </Text>
                </>
              )}
            </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
      </View>

      {/* 今日へ戻るチップ（横スクロール週の直下・右寄せ） */}
      {!isToday(selectedDate) && (
        <View style={{ alignItems: 'flex-end', marginTop: 6, paddingHorizontal: 20 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={'今日へ戻る'}
            onPress={() => {
              const now = new Date();
              const today = new Date(now);
              today.setHours(0, 0, 0, 0);
              const day = today.getDay();
              const diff = day === 0 ? -6 : 1 - day;
              const monday = new Date(today);
              monday.setDate(today.getDate() + diff);
              monday.setHours(0, 0, 0, 0);
              setWeekStartDate(monday);
              setSelectedDate(today);
            }}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>今日へ</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* スワイプ可能なメインコンテンツエリア */}
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX: slideAnim }], position: 'relative' }}>
        {/* スワイプインジケーター */}
        {mainSwipeIndicator.left && (
          <View style={{
            position: 'absolute',
            left: 20,
            top: '40%',
            zIndex: 100,
            backgroundColor: theme.primary,
            borderRadius: 25,
            padding: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 8,
          }}>
            <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>◀</Text>
          </View>
        )}
        {mainSwipeIndicator.right && (
          <View style={{
            position: 'absolute',
            right: 20,
            top: '40%',
            zIndex: 100,
            backgroundColor: theme.primary,
            borderRadius: 25,
            padding: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 8,
          }}>
            <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>▶</Text>
          </View>
        )}
        {/* 円形プログレス（タブ切替） */}
        <View style={styles.circleContainer}>
          <TouchableOpacity activeOpacity={1} onLongPress={() => {
            const now = new Date();
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            setSelectedDate(today);
            const day = today.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            const monday = new Date(today);
            monday.setDate(today.getDate() + diff);
            monday.setHours(0, 0, 0, 0);
            setWeekStartDate(monday);
          }}>
          <View style={[styles.circleBackground, { backgroundColor: theme.card }]}>
          <Animated.View style={{ transform: [{ scale: bumpAnim }] }}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }], position: 'relative' }}>
            <Progress.Circle
              size={200}
              progress={activeTab === 'steps' ? progress : caloriesProgress}
              showsText={false}
              animated={!isChangingWeekRef.current}
              color={activeTab === 'steps' ? (progress >= 1.0 ? theme.success : theme.accent) : (caloriesProgress >= 1.0 ? theme.success : theme.accent)}
              unfilledColor={theme.circleUnfilled}
              borderWidth={0}
              thickness={12}
            />
          </Animated.View>
          </Animated.View>
          <View style={styles.circleCenter}>
            {activeTab === 'steps' ? (
              <>
                <Text style={[styles.percentText, { color: theme.text }]}>
                  {formatNumber(steps)}
                </Text>
                <Text style={[styles.goalLabel, { color: theme.textSecondary }]}>{t('units.steps')}</Text>
                <Text style={[styles.progressSubtext, { color: theme.textSecondary }]}>
                  {t('home.progress.rate')}: {Math.round(progress * 100)}%
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.percentText, { color: theme.text }]}>
                  {calories.toFixed(0)}
                </Text>
                <Text style={[styles.goalLabel, { color: theme.textSecondary }]}>{t('units.kcal')}</Text>
                <Text style={[styles.progressSubtext, { color: theme.textSecondary }]}>
                  {t('home.progress.rate')}: {Math.round(caloriesProgress * 100)}%
                </Text>
              </>
            )}
          </View>
          </View>
          </TouchableOpacity>
        </View>

        {/* Share CTA */}
        <View style={{ alignItems: 'flex-end', paddingHorizontal: 20, marginTop: 8, marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('SharePreview', { steps, goal, selectedDate })}
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: theme.accent,
              paddingVertical: 10, paddingHorizontal: 14,
              borderRadius: 999,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6,
            }}
          >
            <Text style={{ color: '#FFF', fontWeight: '800', letterSpacing: 1, marginRight: 6 }}>{t('common.share')}</Text>
            <Text style={{ color: '#FFF', fontSize: 16 }}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* Stats カード（タブ切替） */}
        <View style={styles.statsRow}>
          {activeTab === 'steps' ? (
            <>
              <View style={[styles.statCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('home.stats.steps')}</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{formatNumber(steps)}</Text>
                <Text style={[styles.statSubtext, { color: theme.textSecondary }]}>
                  {t('home.labels.goal')}: <Text style={{ color: theme.accent, fontWeight: '600' }}>{formatNumber(goal)}</Text> {t('units.steps')}
                </Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('home.stats.calories')}</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{formatNumber(Math.round(calories))}</Text>
                <Text style={[styles.statSubtext, { color: theme.textSecondary }]}>
                  {t('home.stats.kcalBurnedLabel')}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.statCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('home.stats.calories')}</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{formatNumber(Math.round(calories))}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('home.labels.goal')}
                  onPress={() => navigation.navigate('Settings')}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <Text style={[styles.statSubtext, { color: theme.textSecondary }]}>
                    {t('home.labels.goal')}: <Text style={{ color: theme.accent, fontWeight: '600' }}>{goalCalories}</Text> {t('units.kcal')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('home.stats.steps')}</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{formatNumber(steps)}</Text>
                <Text style={[styles.statSubtext, { color: theme.textSecondary }]}>
                  {t('home.stats.steps')}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* 時間帯別グラフ */}
        <View style={styles.chartSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {isToday(selectedDate)
              ? t('home.activity.today')
              : t('home.activity.onDate', { date: formatMonthDay(selectedDate) })}
          </Text>
          <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>{t('home.chart.hourlyDistribution')}</Text>

          {/* 時間別詳細ツールチップ（グラフの上に表示） */}
          {hourlyDetailTooltip.visible && hourlyDetailTooltip.hour >= 0 && (
            <View
              pointerEvents="none"
              style={styles.hourlyDetailTooltipWrapper}
            >
              <View style={[
                styles.hourlyDetailTooltip,
                {
                  backgroundColor: theme.card,
                  borderWidth: 1,
                  borderColor: theme.border,
                }
              ]}>
                <Text style={[styles.hourlyDetailTooltipTitle, { color: theme.text }]}>
                  {hourlyDetailTooltip.hour}:00 - {hourlyDetailTooltip.hour}:59
                </Text>
                <View style={styles.hourlyDetailTooltipRow}>
                  <Text style={[styles.hourlyDetailTooltipLabel, { color: theme.textSecondary }]}>
                    歩数:
                  </Text>
                  <Text style={[styles.hourlyDetailTooltipValue, { color: theme.primary }]}>
                    {formatNumber(hourlySteps[hourlyDetailTooltip.hour] || 0)} 歩
                  </Text>
                </View>
                <View style={styles.hourlyDetailTooltipRow}>
                  <Text style={[styles.hourlyDetailTooltipLabel, { color: theme.textSecondary }]}>
                    カロリー:
                  </Text>
                  <Text style={[styles.hourlyDetailTooltipValue, { color: theme.accent }]}>
                    {calculateCalories(hourlySteps[hourlyDetailTooltip.hour] || 0, profile.weight).toFixed(1)} kcal
                  </Text>
                </View>
                <View style={styles.hourlyDetailTooltipRow}>
                  <Text style={[styles.hourlyDetailTooltipLabel, { color: theme.textSecondary }]}>
                    距離:
                  </Text>
                  <Text style={[styles.hourlyDetailTooltipValue, { color: theme.success }]}>
                    {calculateDistance(hourlySteps[hourlyDetailTooltip.hour] || 0, profile.stride).toFixed(2)} km
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={[styles.chartCard, { backgroundColor: theme.card }]}>
          {/* Y軸のメモリ */}
          <View style={styles.chartWithAxis}>
            <View style={styles.yAxis}>
              {(() => {
                const maxSteps = Math.max(...hourlySteps, 1);
                const yLabels = [
                  { value: maxSteps, label: maxSteps >= 1000 ? `${(maxSteps / 1000).toFixed(1)}k` : maxSteps },
                  { value: maxSteps * 0.5, label: maxSteps >= 2000 ? `${(maxSteps * 0.5 / 1000).toFixed(1)}k` : Math.round(maxSteps * 0.5) },
                  { value: 0, label: '0' }
                ];
                return yLabels.map((item, i) => (
                  <Text key={i} style={[styles.yAxisLabel, { color: theme.textSecondary }]}>
                    {item.label}
                  </Text>
                ));
              })()}
            </View>
            <View style={styles.chartArea}>
              <View
                style={styles.chart}
                onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
              >
                {hourlySteps.map((count, hour) => {
                  const maxSteps = Math.max(...hourlySteps, 1);
                  const barHeight = (count / maxSteps) * 100;
                  const isSelectedToday = selectedDate.toDateString() === new Date().toDateString();
                  const currentHour = new Date().getHours();
                  const isCurrentHour = isSelectedToday && hour === currentHour;
                  const isMaxBar = count === maxSteps && count > 0;

                  return (
                    <View key={hour} style={styles.barContainer}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.barTouchable}
                        hitSlop={{ top: 6, bottom: 10, left: 4, right: 4 }}
                        onPress={() => {
                          // ドリルダウン: 履歴画面風のツールチップ表示
                          try { if (hourlyDetailTimerRef.current) clearTimeout(hourlyDetailTimerRef.current); } catch (_) {}
                          setHourlyDetailTooltip({ visible: true, hour: hour });
                          hourlyDetailTimerRef.current = setTimeout(() => setHourlyDetailTooltip({ visible: false, hour: -1 }), 3000);
                          if (Haptics?.impactAsync) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          }
                        }}
                      >
                        <View style={styles.barWrapper}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: `${barHeight}%`,
                                backgroundColor: isMaxBar ? theme.accent : (isCurrentHour ? theme.primary : theme.chartBar),
                              }
                            ]}
                          />
                        </View>
                        {hour % 3 === 0 && (
                          <Text style={[styles.hourLabel, { color: theme.textSecondary }]}>
                            {hour}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
          </View>

          {/* カレンダーイベント表示 */}
          {todayEvents.length > 0 && (
            <View style={[styles.eventsContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.eventsTitle, { color: theme.text }]}>📅 予定</Text>
              {todayEvents.slice(0, 3).map((event, index) => (
                <View key={index} style={[styles.eventItem, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={1}>
                    {event.title}
                  </Text>
                  {event.startDate && (
                    <Text style={[styles.eventTime, { color: theme.textSecondary }]}>
                      {new Date(event.startDate).toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  )}
                </View>
              ))}
              {todayEvents.length > 3 && (
                <Text style={[styles.moreEvents, { color: theme.textSecondary }]}>
                  他 {todayEvents.length - 3} 件
                </Text>
              )}
            </View>
          )}
        </View>

        {/* 今日の食べ物目標 */}
        <View style={styles.foodSection}>
          {(() => {
            const isSelToday = (() => {
              const s = new Date(selectedDate); s.setHours(0,0,0,0);
              const t = new Date(); t.setHours(0,0,0,0);
              return s.getTime() === t.getTime();
            })();
            const goalsForView = isSelToday ? todayGoals : selectedGoals;
            const lvlForView = isSelToday ? currentGoalLevel : selectedGoalsLevel;
            const curr = (goalsForView[lvlForView - 1] || getCurrentGoal(lvlForView));
            const next = (goalsForView[lvlForView] || getCurrentGoal(lvlForView + 1));
            const currTarget = curr?.food?.calories || 0;
            return (
              <DailyFoodGoal
                currentGoal={curr}
                currentCalories={calories}
                achieved={isGoalAchieved(calories, currTarget)}
                remainingCalories={Math.max(0, currTarget - calories)}
                remainingSteps={Math.ceil(Math.max(0, currTarget - calories) * (1 / (0.00055 * (profile.weight || 65))))}
                level={lvlForView}
                totalLevels={goalsForView.length || 0}
                nextGoal={next}
              />
            );
          })()}
        </View>
      </Animated.View>

      {/* デバッグ情報 */}
      {isPedometerAvailable === false && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>{t('home.debug.pedometerUnavailable')}</Text>
          <Text style={styles.debugText}>{t('home.debug.tipManual')}</Text>
        </View>
      )}
      {isPedometerAvailable === null && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>{t('home.debug.pedometerChecking')}</Text>
        </View>
      )}

      {/* カレンダーモーダル */}
      <Modal
        visible={showCalendarModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCalendarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t('home.modal.selectDate')}</Text>
              <TouchableOpacity onPress={() => setShowCalendarModal(false)}>
                <Text style={[styles.modalClose, { color: theme.text }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 月切替 */}
            <View style={styles.monthSwitcher}>
              <TouchableOpacity
                accessibilityRole="button"
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                style={styles.navButton}
                onPress={async () => {
                  const prev = new Date(calendarMonth);
                  prev.setMonth(calendarMonth.getMonth() - 1);
                  prev.setDate(1);
                  prev.setHours(0, 0, 0, 0);
                  setCalendarMonth(prev);
                  await loadMonthlyData(prev);
                }}
              >
                <Text style={[styles.navButtonText, { color: theme.text }]}>◀</Text>
              </TouchableOpacity>
              <Text style={[styles.dateText, { color: theme.text }]}>{formatMonthYear(calendarMonth)}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                style={styles.navButton}
                onPress={async () => {
                  const next = new Date(calendarMonth);
                  next.setMonth(calendarMonth.getMonth() + 1);
                  next.setDate(1);
                  next.setHours(0, 0, 0, 0);
                  setCalendarMonth(next);
                  await loadMonthlyData(next);
                }}
              >
                <Text style={[styles.navButtonText, { color: theme.text }]}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* 月カレンダーグリッド */}
            <View style={styles.calendarGrid}>
              <View style={styles.weekdayRow}>
                {(() => {
                  const base = (t('weekdaysShort') || ['日', '月', '火', '水', '木', '金', '土']);
                  const firstDow = locale === 'en' ? 0 : 1;
                  const ordered = [...base.slice(firstDow), ...base.slice(0, firstDow)];
                  return ordered.map((day, i) => (
                    <Text key={i} style={[styles.weekdayText, { color: theme.textSecondary }]}>
                      {day}
                    </Text>
                  ));
                })()}
              </View>

              {(() => {
                const today = new Date();
                const base = calendarMonth;
                const year = base.getFullYear();
                const month = base.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const daysInMonth = lastDay.getDate();
                const startDayOfWeek = firstDay.getDay();
                const firstDow = locale === 'en' ? 0 : 1;

                const days = [];
                // 空白セル（週頭に合わせてオフセット）
                const padding = (startDayOfWeek - firstDow + 7) % 7;
                for (let i = 0; i < padding; i++) {
                  days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
                }

                // 日付セル
                for (let day = 1; day <= daysInMonth; day++) {
                  const date = new Date(year, month, day);
                  const isSelected = date.toDateString() === selectedDate.toDateString();
                  const isTodayDate = date.toDateString() === today.toDateString();
                  const isFutureDate = date > today;
                  const dateKey = date.toISOString().split('T')[0];
                  const dayData = monthlyData[dateKey];

                  days.push(
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.calendarModalDayCell,
                        isSelected && { backgroundColor: theme.primary },
                        isTodayDate && !isSelected && { borderWidth: 2, borderColor: theme.primary }
                      ]}
                      onPress={() => {
                        if (!isFutureDate) {
                          setSelectedDate(date);
                          // 選択した日付が現在の週に含まれていない場合、週を移動
                          const dayDiff = date.getDay() === 0 ? -6 : 1 - date.getDay();
                          const newMonday = new Date(date);
                          newMonday.setDate(date.getDate() + dayDiff);
                          newMonday.setHours(0, 0, 0, 0);
                          setWeekStartDate(newMonday);
                          setShowCalendarModal(false);
                        }
                      }}
                      disabled={isFutureDate}
                    >
                      <Text style={[
                        styles.calendarModalDayText,
                        isSelected && { color: '#FFF', fontWeight: '700' },
                        isFutureDate && { color: theme.textTertiary },
                        !isSelected && !isFutureDate && { color: theme.text }
                      ]}>
                        {day}
                      </Text>
                      {!isFutureDate && dayData && (
                        <>
                          <Text style={[
                            styles.calendarModalSteps,
                            { color: isSelected ? '#FFF' : theme.accent }
                          ]}>
                            {dayData.steps >= 1000 ? `${(dayData.steps / 1000).toFixed(1)}k` : dayData.steps}
                          </Text>
                          <Text style={[
                            styles.calendarModalCalories,
                            { color: isSelected ? 'rgba(255,255,255,0.8)' : theme.textSecondary }
                          ]}>
                            {dayData.calories.toFixed(0)}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                }

                // グリッドを週単位で分割
                const weeks = [];
                for (let i = 0; i < days.length; i += 7) {
                  weeks.push(
                    <View key={`week-${i}`} style={styles.calendarWeek}>
                      {days.slice(i, i + 7)}
                    </View>
                  );
                }

                return weeks;
              })()}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  infoBanner: {
    marginTop: 8,
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabActive: {
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  calendarIconButton: {
    position: 'absolute',
    right: 20,
    padding: 8,
    zIndex: 10,
    backgroundColor: '#FFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarIcon: {
    fontSize: 24,
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  navButton: {
    padding: 10,
  },
  navButtonText: {
    fontSize: 24,
    color: '#212121',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginHorizontal: 10,
    minWidth: 160,
    textAlign: 'center',
  },
  calendarScroll: {
    marginBottom: 20,
  },
  calendarContent: {
    paddingHorizontal: 10,
  },
  calendarItem: {
    width: 70,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 5,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarItemSelected: {
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  calendarItemToday: {
    borderWidth: 2,
    borderColor: '#FF7043',
  },
  calendarDay: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 2,
  },
  calendarRingDay: {
    fontSize: 14,
    fontWeight: '800',
  },
  calendarWeekday: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 6,
  },
  calendarSteps: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  calendarCalories: {
    fontSize: 10,
    color: '#9E9E9E',
  },
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    position: 'relative',
  },
  circleBackground: {
    backgroundColor: '#FFFFFF',
    borderRadius: 120,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  circleCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
    top: 10,
    left: 10,
  },
  percentText: {
    fontSize: 56,
    fontWeight: '700',
    color: '#212121',
    letterSpacing: -2,
    textAlign: 'center',
  },
  goalLabel: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  progressSubtext: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statLabel: {
    fontSize: 13,
    color: '#9E9E9E',
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 32,
    color: '#212121',
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statSubtext: {
    fontSize: 12,
    color: '#BDBDBD',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  foodSection: {
    marginTop: 20,
    marginBottom: 30,
  },
  titleRow: {
    // use sectionTitle's own left margin to align; only control layout here
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 22,  // 🔍 視認性改善: 大きく
    fontWeight: '800',  // 🔍 視認性改善: より太く
    color: '#212121',
    marginLeft: 20,
    marginBottom: 5,
    letterSpacing: 0.3,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginRight: 20,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#757575',
    marginLeft: 20,
    marginBottom: 10,
  },
  foodList: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  foodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginRight: 16,
    alignItems: 'center',
    width: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F5F5F5',
  },
  foodEmoji: {
    fontSize: 44,  // 🔍 視認性改善: 大きく
    marginBottom: 10,
  },
  foodAmount: {
    fontSize: 28,  // 🔍 視認性改善: 大きく
    fontWeight: '800',  // 🔍 視認性改善: より太く
    color: '#FF7043',  // 🔍 視認性改善: オレンジで強調
    letterSpacing: -0.5,
  },
  foodUnit: {
    fontSize: 17,  // 🔍 視認性改善: 少し大きく
    color: '#757575',  // 🔍 視認性改善: 少し明るく
    marginTop: 5,
    fontWeight: '600',  // 🔍 視認性改善: より太く
  },
  debugContainer: {
    margin: 20,
    padding: 15,
    backgroundColor: '#FFF3CD',
    borderRadius: 10,
  },
  debugText: {
    fontSize: 14,
    color: '#856404',
    marginVertical: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#212121',
  },
  modalClose: {
    fontSize: 28,
    color: '#757575',
    fontWeight: '300',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 30,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#FF7043',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  calendarGrid: {
    marginTop: 10,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  weekdayText: {
    width: 40,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
  },
  calendarWeek: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  calendarDayCell: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  calendarDayText: {
    fontSize: 16,
    color: '#212121',
  },
  calendarModalDayCell: {
    width: 40,
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 4,
  },
  calendarModalDayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  calendarModalSteps: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 1,
  },
  calendarModalCalories: {
    fontSize: 8,
  },
  chartSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  chartWithAxis: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  yAxis: {
    width: 40,
    justifyContent: 'space-between',
    paddingRight: 8,
    paddingTop: 10,
    paddingBottom: 25,
  },
  yAxisLabel: {
    fontSize: 11,
    color: '#9E9E9E',
    textAlign: 'right',
  },
  chartArea: {
    flex: 1,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingTop: 10,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    paddingBottom: 20,
    position: 'relative',
  },
  barTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  barWrapper: {
    width: '80%',
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    backgroundColor: '#FF7043',
    borderRadius: 3,
    minHeight: 2,
  },
  hourLabel: {
    fontSize: 10,
    color: '#9E9E9E',
    marginTop: 5,
    position: 'absolute',
    bottom: 0,
  },
  tooltipBubble: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(17,24,39,0.9)',
  },
  tooltipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  tooltipContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'center',
  },
  eventsContainer: {
    marginTop: 15,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  eventsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  eventItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  eventTitle: {
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  eventTime: {
    fontSize: 12,
  },
  moreEvents: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  hourlyDetailTooltipWrapper: {
    marginBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  hourlyDetailTooltip: {
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  hourlyDetailTooltipTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  hourlyDetailTooltipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  hourlyDetailTooltipLabel: {
    fontSize: 12,
  },
  hourlyDetailTooltipValue: {
    fontSize: 13,
    fontWeight: '600',
  },
});
  // チャート上のタッチ位置から時間帯を推定してツールチップ表示
  const handleChartTouch = (evt) => {
    try {
      const x = evt.nativeEvent?.locationX ?? 0;
      const w = chartWidth || 1;
      let idx = Math.floor((x / w) * 24);
      if (!Number.isFinite(idx)) idx = 0;
      idx = Math.max(0, Math.min(23, idx));
      const val = hourlySteps[idx] || 0;
      setHourlyTooltip({ index: idx, value: val });
    } catch (_) {}
  };
