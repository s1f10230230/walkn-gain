import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  AppState,
  useColorScheme,
  Modal,
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  RefreshControl,
  Image,
  Platform,
  ImageBackground,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Pedometer } from "expo-sensors";
import { getTheme } from "../utils/theme";
import { useI18n } from "../i18n/I18nProvider";
import {
  calculateCalories,
  calculateDistance,
  calculateGoalProgress,
  getTodayDateString,
  toDateKeyLocal,
} from "../utils/calculations";
import {
  getTodayData,
  saveTodayData,
  getUserProfile,
  getSettings,
  getFavorites,
  getHealthSyncEnabled,
  getHourlyStepsForDate,
  saveHourlyStepsForDate,
  getAllDailyData,
  getStatsCache,
  saveStatsCache,
  getDailyData,
  saveDailyData,
} from "../utils/storage";
import {
  getCachedTodayData,
  cacheTodayData,
  getLatestCachedData,
} from "../utils/cache";
import { getFoodById, calculateFoodAmount } from "../data/foodDatabase";
import { getCurrentGoal, isGoalAchieved } from "../data/dailyGoals";
import {
  getOrCreateTodayGoals,
  getOrCreateGoalsForDate,
} from "../utils/dynamicGoals";
import {
  getCurrentGoalLevel,
  saveCurrentGoalLevel,
  getCurrentGoalLevelDate,
  saveCurrentGoalLevelDate,
} from "../utils/storage";
import { initializePedometer } from "../utils/pedometer";
import {
  requestNotificationPermissions,
  sendGoalAchievedNotification,
  sendImmediateNotification,
  getEncouragementMessage,
  setupNotificationListeners,
  canSendProgressNotification,
  markProgressNotificationSent,
  updatePersistentWidget,
  scheduleReminderNotification,
} from "../utils/notifications";
import { saveReminderEnabled } from "../utils/storage";
import { logEvent } from "../utils/analytics";
import { getStepsInRange, syncPastDaysToStorage } from "../utils/healthKit";
import { registerBackgroundStepsTask } from "../tasks/backgroundStepsTask";
import { CalendarIcon } from "../components/SettingsIcons";
import { getEventsForDate, getEventsSummary } from "../utils/calendar";
import TodayNote from "../components/TodayNote";
import CalendarModal from "../components/CalendarModal";
import RecentNotes from "../components/RecentNotes";
import { hasNote } from "../utils/dayNotes";
import HeaderStats from "../components/HeaderStats";
import ProgressRing from "../components/ProgressRing";
import ShareCTA from "../components/ShareCTA";
import WeekCalendar from "../components/WeekCalendar";
import HourlyChart from "../components/HourlyChart";
import MetricTabs from "../components/MetricTabs";
import StatsCards from "../components/StatsCards";
import EventsCard from "../components/EventsCard";
import { computeTrophiesStreak } from "../utils/stats";
import { AppIcon } from "../components/AppIcon";
import { seedPastDaysPedometer } from "../utils/pedometerSeed";
import styles from "./home/styles";
import {
  isToday as isTodayHelper,
  isFuture as isFutureHelper,
  formatMonthDay as formatMonthDayHelper,
  formatMonthYear as formatMonthYearHelper,
} from "./home/utils";
import {
  getDailyFeedbackMessage,
  getFeedbackMessageForDate,
  maybeSaveFeedbackSnapshot,
  backfillFeedbackHistory,
} from "../utils/feedback";

const { width } = Dimensions.get("window");

// 0〜1に正規化（NaN/Infinityも0として扱う）
const clamp01 = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
};

// Dev flag: Pedometer の取り込みを一時停止（HealthKit取り込みの切り分け用）
const DISABLE_PEDOMETER_DEV = false;

// 歩数取得はHealthKit優先（フォールバックでPedometer/ストレージ）
const USE_PEDOMETER_ONLY = false;

// 永続化用キー: 最後に選択した日付（YYYY-MM-DD）
const LAST_SELECTED_DATE_KEY = "ui_last_selected_date";
// 初回起動時にPedometerで過去データを取り込んだかのフラグ
const PEDOMETER_INITIAL_IMPORT_KEY = "pedometer_initial_import_v1";

import {
  fetchWeatherForLocation,
  getWeatherIcon,
  fetchWeatherHistory,
  fetchHourlyWeather,
  getWeatherSummary,
} from "../utils/weather";

export default function HomeScreen({ navigation, route }) {
  // RecentNotesコンポーネントへの参照
  const recentNotesRef = useRef(null);

  // 日付関連（週単位のスライドウィンドウ）
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weather, setWeather] = useState(null); // New Weather State
  const [hourlyWeather, setHourlyWeather] = useState(Array(24).fill(null)); // Hourly weather codes

  // Weather History Sync (One-time on mount)
  useEffect(() => {
    const syncWeather = async () => {
      const history = await fetchWeatherHistory(30);
      if (history.length > 0) {
        // Save each day to storage
        for (const item of history) {
          const stored = await getDailyData(item.date);
          // Only update if weather is missing or we want to overwrite
          if (stored) {
             await saveDailyData(item.date, { ...stored, weather: item.weather });
          } else {
             // If no step data exists for that day, we might not want to create a partial record,
             // OR we can create it with 0 steps just to hold weather.
             // For now, let's only attach to existing records or create if missing (safe).
             await saveDailyData(item.date, { date: item.date, steps: 0, calories: 0, ...item.weather, weather: item.weather });
          }
        }
        console.log('Weather history synced:', history.length, 'days');
      }
    };
    syncWeather();
  }, []);
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
  const [allTimeData, setAllTimeData] = useState({}); // 全期間データ（トロフィー・ストリーク計算用）
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [activeTab, setActiveTab] = useState("steps"); // 'steps' or 'calories'
  const [steps, setSteps] = useState(0);
  const [todayStepsSnapshot, setTodayStepsSnapshot] = useState(0);
  const [calories, setCalories] = useState(0);
  const [distance, setDistance] = useState(0);
  const [goal, setGoal] = useState(10000);
  const [goalCalories, setGoalCalories] = useState(500); // 目標カロリー
  const [progress, setProgress] = useState(0);
  const [caloriesProgress, setCaloriesProgress] = useState(0);
  const [favorites, setFavorites] = useState(["ramen", "onigiri", "beer"]);
  const [profile, setProfile] = useState({
    height: 170,
    weight: 65,
    stride: 72,
  });
  const [currentGoalLevel, setCurrentGoalLevel] = useState(1);
  const [todayGoals, setTodayGoals] = useState([]);
  const [isPedometerAvailable, setIsPedometerAvailable] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSteps, setIsLoadingSteps] = useState(false); // 歩数データ読み込み中
  const [hourlySteps, setHourlySteps] = useState(Array(24).fill(0));
  const lastProgressDateRef = useRef(toDateKeyLocal(new Date()));
  const selectedLoadTokenRef = useRef(0);
  const selectedDebounceTimerRef = useRef(null);
  const lastRefreshRef = useRef(0);
  const [todayEvents, setTodayEvents] = useState([]); // 今日のカレンダーイベント

  // トロフィー・ストリーク用のstate（キャッシュから初期化）
  const [totalTrophies, setTotalTrophies] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [isCalculatingStats, setIsCalculatingStats] = useState(false);
  // インライン通知は使用しない
  const [inlineNotice, setInlineNotice] = useState("");
  const [weeklyDisplayMode, setWeeklyDisplayMode] = useState("calories"); // 'calories' | 'steps'
  const [notesMap, setNotesMap] = useState({}); // { 'YYYY-MM-DD': boolean } コメント有無のマップ
  const [hourlyTooltip, setHourlyTooltip] = useState({ index: -1, value: 0 });
  // タイマーは使わず、押下中のみ表示
  const hourlyTooltipTimerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [selectedGoalsLevel, setSelectedGoalsLevel] = useState(1);
  const [hourlyDetailTooltip, setHourlyDetailTooltip] = useState({
    visible: false,
    hour: -1,
  });
  const hourlyDetailTimerRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pullToRefreshIndicator, setPullToRefreshIndicator] = useState(false); // リフレッシュ引っ張りインジケーター
  const [calendarPullIndicator, setCalendarPullIndicator] = useState({
    left: false,
    right: false,
  }); // カレンダー引っ張りインジケーター
  const [mainSwipeIndicator, setMainSwipeIndicator] = useState({
    left: false,
    right: false,
  }); // メイン画面スワイプインジケーター
  const appState = useRef(AppState.currentState);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bumpAnim = useRef(new Animated.Value(1)).current; // 値更新時のワンショット弾む演出
  const arrowBounceAnim = useRef(new Animated.Value(0)).current; // 矢印のバウンスアニメーション
  // 週カレンダー/リングの即時反映用に日付キー単位でアップサート
  const upsertWeeklyEntry = useCallback(
    (dateKey, stepsVal, caloriesVal, goalVal, goalCaloriesVal) => {
      const safeKey = toDateKeyLocal(dateKey);
      if (!safeKey) return;
      const g = Number(goalVal ?? goal ?? 10000);
      const cg = Number(goalCaloriesVal ?? goalCalories ?? 500);
      setWeeklyData((prev) => {
        const next = { ...prev };
        next[safeKey] = {
          ...(next[safeKey] || {}),
          steps: Number(stepsVal) || 0,
          calories: Number(caloriesVal) || 0,
          goal: g,
          goalCalories: cg,
        };
        return next;
      });
    },
    [goal, goalCalories]
  );

  // 初回起動時に矢印を一度だけバウンスさせる
  useEffect(() => {
    const bounce = Animated.sequence([
      Animated.delay(1000),
      Animated.timing(arrowBounceAnim, { toValue: 10, duration: 300, useNativeDriver: true }),
      Animated.timing(arrowBounceAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(arrowBounceAnim, { toValue: 5, duration: 200, useNativeDriver: true }),
      Animated.timing(arrowBounceAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]);
    bounce.start();
  }, []);

  // 円アニメ用（近接パルス/値更新バンプ）のみ維持
  const pulseLoopRef = useRef(null);
  const [dailyFeedback, setDailyFeedback] = useState("");
  const [feedbackTargetDate, setFeedbackTargetDate] = useState(null);
  const selectedDateRef = useRef(selectedDate); // PanResponder内で最新日付を参照

  // 起動時に直近7日をHealthKit優先でストレージに同期
  // 起動時に直近7日をHealthKit優先でストレージに同期（一度だけ実行）
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (calendarDates.length > 0 && !hasSyncedRef.current) {
      const runSync = async () => {
        hasSyncedRef.current = true;
        try {
          console.log('[HomeScreen] Starting initial sync...');
          const result = await syncPastDaysToStorage(7);
          console.log('[HomeScreen] Initial sync result:', result);
          // 同期完了後にカレンダーデータを再取得（現在の表示週で）
          loadWeeklyData(calendarDates);
        } catch (e) {
          console.error('[HomeScreen] Initial sync failed:', e);
        }
      };
      runSync();
    }
  }, [calendarDates]);

  const loadFeedbackMessage = useCallback(
    async (targetDate) => {
      try {
        const baseDate = targetDate || selectedDateRef.current || selectedDate;
        if (!baseDate) return;
        const previousDate = new Date(baseDate);
        previousDate.setDate(previousDate.getDate() - 1);
        const requestKey = toDateKeyLocal(previousDate);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = toDateKeyLocal(yesterday);
        let message = "";
        if (requestKey === yesterdayKey) {
          message = await getDailyFeedbackMessage();
        } else {
          message = await getFeedbackMessageForDate(requestKey);
        }
        if (message) {
          setDailyFeedback(message);
          setFeedbackTargetDate(requestKey);
        } else {
          setDailyFeedback("");
          setFeedbackTargetDate(null);
        }
      } catch (error) {
        console.error("Failed to load feedback message:", error);
      }
    },
    [selectedDate]
  );

  const getTodayStepsViaPedometer = async () => {
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) return null;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      const res = await Pedometer.getStepCountAsync(start, end);
      if (typeof res?.steps === "number" && res.steps >= 0) {
        return res.steps;
      }
    } catch (error) {
      console.warn("Pedometer step fetch failed, fallback to HK:", error);
    }
    return null;
  };
  const goalReachedRef = useRef({ steps: false, calories: false });
  const levelUpLockRef = useRef(false); // レベルアップの同時実行防止
  const slideAnim = useRef(new Animated.Value(0)).current; // 日付切替のスライド
  const weekStartDateRef = useRef(weekStartDate); // PanResponder内で最新週開始日を参照
  const calendarScrollRef = useRef(null); // カレンダースクロールのref
  const isChangingWeekRef = useRef(false); // 週切り替え中フラグ
  const calendarAnimValues = useRef(
    Array(7)
      .fill(0)
      .map(() => new Animated.Value(1))
  ).current; // カレンダーアイテムのアニメーション
  // 初回保存ガード（復元完了までは保存しない）
  const hasRestoredDateRef = useRef(false);
  let Haptics = null;
  try {
    // 存在する環境のみ使用（依存未追加でも壊れないように）
    // eslint-disable-next-line global-require
    Haptics = require("expo-haptics");
  } catch (e) {
    Haptics = null;
  }

  // 🌙 ダークモード対応
  const systemColorScheme = useColorScheme();
  const theme = getTheme(systemColorScheme);
  const glowSizesLight = [290, 320, 360, 430, 510, 590, 700];
  const glowSizesDark = [290, 320, 380]; // ダークはやや少なめで控えめ

  const glowColorsLight = [
    "rgba(255, 255, 255, 0.57)",
    "rgba(250, 192, 106, 0.12)",
    "rgba(255, 225, 180, 0.26)",
    "rgba(255, 200, 150, 0.08)",
    "rgba(255, 180, 130, 0.06)",
    "rgba(255, 160, 115, 0.035)",
    "rgba(255, 140, 100, 0.02)",
  ];

  const glowColorsDark = [
    "rgba(255, 210, 255, 0.06)",
    "rgba(255, 210, 255, 0.035)",
    "rgba(255, 210, 255, 0.02)",
  ];

  const selectedGlowSizes = theme.isDark ? glowSizesDark : glowSizesLight;
  const selectedGlowColors = theme.isDark ? glowColorsDark : glowColorsLight;

  // セーフエリア対応
  const insets = useSafeAreaInsets();
  const {
    t,
    formatNumber,
    getWeekdayShort,
    formatWeekRange: i18nFormatWeekRange,
    locale,
  } = useI18n();

  // 履歴画面から渡された日付パラメータを処理
  useEffect(() => {
    if (route?.params?.selectedDate) {
      const dateString = route.params.selectedDate;
      const targetDate = new Date(dateString + "T00:00:00");
      setSelectedDate(targetDate);

      // その日付が含まれる週の月曜日を計算
      const day = targetDate.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(targetDate);
      monday.setDate(targetDate.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      setWeekStartDate(monday);

      // パラメータをクリア（再度同じ日付に遷移できるように）
      navigation.setParams({ selectedDate: undefined });
      // 復元済みとしてマーク
      hasRestoredDateRef.current = true;
    }
  }, [route?.params?.selectedDate, navigation]);

  // 週バー表示モードはタブに追従（歩数タブ=歩、カロリータブ=kcal）
  useEffect(() => {
    setWeeklyDisplayMode(activeTab === "calories" ? "calories" : "steps");
  }, [activeTab]);

  // 日付変更用のスワイプジェスチャー
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          // 画面端60px以内ではPanResponderを無効化（戻るジェスチャー優先）
          const touchX = evt.nativeEvent.pageX;
          const edgeThreshold = 30;
          if (touchX < edgeThreshold || touchX > width - edgeThreshold) {
            return false;
          }

          // 横方向のスワイプを軽く検出 + フリックも許容
          const horizontalBias =
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.1 ||
            Math.abs(gestureState.vx) > Math.abs(gestureState.vy);
          return (
            (Math.abs(gestureState.dx) > 1 || // 超軽量設定
              Math.abs(gestureState.vx) > 0.01) && // 超軽量設定
            horizontalBias
          );
        },
        onPanResponderGrant: () => {
          slideAnim.setValue(0);
          setMainSwipeIndicator({ left: false, right: false });
        },
        onPanResponderMove: (evt, gestureState) => {
          // 指に追従して滑らかにスライド（抵抗感を減らす）
          const damping = 0.8; // 抵抗係数を下げて滑らかに
          slideAnim.setValue(gestureState.dx * damping);

          // インジケーター表示は削除（インスタ風）
        },
        onPanResponderRelease: (evt, gestureState) => {
          // インジケーターを非表示
          setMainSwipeIndicator({ left: false, right: false });
          const distThreshold = 3; // 距離の閾値（超軽量設定）
          const velocityThreshold = 0.01; // 速度閾値（超軽量設定）
          const dx = gestureState.dx;
          const vx = gestureState.vx;
          const absVx = Math.abs(vx);
          const absDx = Math.abs(dx);

          const tryChange = async (direction) => {
            // 未来日は不可判定
            const base = selectedDateRef.current;
            const candidate = new Date(base);
            candidate.setDate(base.getDate() + direction);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            if (candidate > todayEnd) {
              Animated.timing(slideAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
              }).start();
              return;
            }

            const outTo = direction < 0 ? width : -width;
            // スライドアウト：超高速化
            Animated.timing(slideAnim, {
              toValue: outTo,
              duration: 120, // 超高速化（インスタ並み）
              useNativeDriver: true,
            }).start(() => {
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
              // 振動フィードバック（Medium：はっきり感じる振動）
              if (Haptics?.impactAsync) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                  () => {}
                );
              }

              // 反対側から戻す：超高速化
              slideAnim.setValue(direction < 0 ? -width : width);
              Animated.timing(slideAnim, {
                toValue: 0,
                duration: 140, // 超高速化
                useNativeDriver: true,
              }).start();
            });
          };

          // 速度優先判定：超一瞬の速いスワイプで即反応
          // 1. まず速度でチェック（速ければ距離は問わない）
          if (absVx > velocityThreshold) {
            if (vx > 0) {
              tryChange(-1); // 右スワイプ: 前の日
            } else {
              tryChange(1); // 左スワイプ: 次の日
            }
          }
          // 2. 速度が遅い場合は距離でチェック
          else if (absDx > distThreshold) {
            if (dx > 0) {
              tryChange(-1); // 右スワイプ: 前の日
            } else {
              tryChange(1); // 左スワイプ: 次の日
            }
          }
          // 3. どちらも閾値未満の場合は元の位置に戻す
          else {
            Animated.spring(slideAnim, {
              toValue: 0,
              tension: 100,
              friction: 10,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderTerminate: () => {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [slideAnim, width, selectedDateRef, weekStartDateRef, Haptics]
  );

  // 月モーダル内の左右スワイプで月移動
  // 月モーダルのスワイプ操作は削除（◀/▶ボタンのみで切替）

  // 日付を変更する関数（画面端タップ用）
  const changeDate = (direction) => {
    const candidate = new Date(selectedDate);
    candidate.setDate(selectedDate.getDate() + direction);

    // 未来の日付には進めない
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (candidate > today) {
      return;
    }

    // スライドアニメーション付きで日付変更
    const outTo = direction < 0 ? width : -width;

    // スライドアウト
    Animated.timing(slideAnim, {
      toValue: outTo,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      // 週の範囲チェック
      const weekEnd = new Date(weekStartDate);
      weekEnd.setDate(weekStartDate.getDate() + 6);
      if (candidate < weekStartDate || candidate > weekEnd) {
        const day = candidate.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const newWeekStart = new Date(candidate);
        newWeekStart.setDate(candidate.getDate() + diff);
        newWeekStart.setHours(0, 0, 0, 0);
        setWeekStartDate(newWeekStart);
      }

      setSelectedDate(candidate);

      // 振動フィードバック
      if (Haptics?.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      // スライドイン
      slideAnim.setValue(direction < 0 ? -width : width);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }).start();
    });
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

    // 各日付のコメント有無をチェック
    const checkNotes = async () => {
      const map = {};
      for (const date of dates) {
        const dateKey = toDateKeyLocal(date);
        map[dateKey] = await hasNote(dateKey);
      }
      setNotesMap(map);
    };
    checkNotes();
  }, [weekStartDate]);

  // 月データを取得
  const loadMonthlyData = async (baseDate = new Date()) => {
    try {
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const start = new Date(year, month, 1, 0, 0, 0, 0);
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      const userProfile = await getUserProfile();
      const list = await getStepsInRange(start, end);
      const data = {};
      for (const item of list || []) {
        const dateKey = item?.date;
        if (!dateKey) continue;
        const stepsVal = Number(item.steps || 0);
        data[dateKey] = {
          steps: stepsVal,
          calories: calculateCalories(stepsVal, userProfile.weight),
        };
      }
      setMonthlyData(data);
    } catch (error) {
      console.error("Error loading monthly data:", error);
    }
  };

  // 過去1週間分のデータを取得（並列取得 + キャンセルセーフ）
  const weekLoadTokenRef = useRef(0);
  const loadWeeklyData = async (dates) => {
    try {
      const token = ++weekLoadTokenRef.current;
      const userProfile = await getUserProfile();
      const settings = await getSettings();
      const start = new Date(dates[0]);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dates[dates.length - 1]);
      end.setHours(23, 59, 59, 999);
      const list = await getStepsInRange(start, end);
      if (weekLoadTokenRef.current !== token) return;
      // 一度マップ化してから、渡された日付順にデータを埋める（オフセットずれ防止）
      const dateMap = new Map();
      for (const item of list || []) {
        const key = item?.date ? toDateKeyLocal(item.date) : null;
        if (!key) continue;
        dateMap.set(key, Number(item.steps || 0));
      }
      const data = {};
      for (const d of dates) {
        const key = toDateKeyLocal(d);
        const stepsVal = dateMap.get(key) || 0;
        data[key] = {
          steps: stepsVal,
          calories: calculateCalories(stepsVal, userProfile.weight),
          goal: settings.dailyGoal,
          goalCalories: settings.goalCalories || 500,
        };
      }
      console.log('[HomeScreen] loadWeeklyData loaded:', Object.keys(data).length, 'days');
      setWeeklyData(data);
    } catch (error) {
      console.error("Error loading weekly data:", error);
    }
  };

  // 週の期間をローカライズして表示
  // 使用: i18nFormatWeekRange(weekStartDate)

  // カレンダーカードのアニメーション
  const animateCalendarCards = (direction) => {
    // アニメーション無効化（パフォーマンス優先）
    calendarAnimValues.forEach((anim) => {
      anim.setValue(1);
    });

    // 元のアニメーション（重い場合はコメントアウト）
    // const animations = calendarAnimValues.map((anim, index) => {
    //   anim.setValue(0);
    //   return Animated.timing(anim, {
    //     toValue: 1,
    //     duration: 250,
    //     delay: index * 30,
    //     useNativeDriver: true,
    //   });
    // });
    // Animated.parallel(animations).start();
  };

  // 週を前後に移動
  const changeWeek = (direction) => {
    isChangingWeekRef.current = true;
    const newWeekStart = new Date(weekStartDate);
    newWeekStart.setDate(weekStartDate.getDate() + direction * 7);
    setWeekStartDate(newWeekStart);

    // 選択中の日付も同じ週内に維持
    const newSelected = new Date(selectedDate);
    newSelected.setDate(selectedDate.getDate() + direction * 7);
    setSelectedDate(newSelected);

    // アニメーション実行
    animateCalendarCards(direction);
    setTimeout(() => {
      isChangingWeekRef.current = false;
    }, 200);
  };

  // カレンダースクロール中のインジケーター表示
  const handleCalendarScroll = (event) => {
    if (isChangingWeekRef.current) return;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollX = contentOffset.x;
    const contentWidth = contentSize.width;
    const viewWidth = layoutMeasurement.width;

    const threshold = 10;
    const leftPulling = scrollX < -10; // 左に引っ張り始めた
    const rightPulling = scrollX + viewWidth > contentWidth + 10; // 右に引っ張り始めた

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
    const edgeThreshold = -10; // 左端から50px以上オーバースクロール
    const rightEdgeThreshold = 10; // 右端から50px以上オーバースクロール

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
        calendarScrollRef.current?.scrollTo({
          x: contentWidth - viewWidth - 100,
          animated: false,
        });
        isChangingWeekRef.current = false;
      }, 100);
    }
  };

  // 今日かどうか判定
  const isToday = (date) => isTodayHelper(date);

  // 未来の日付かどうか判定
  const isFuture = (date) => isFutureHelper(date);

  // 進捗スイープの手動制御は撤廃（ライブラリの標準animatedに戻す）

  // 選択された日付が変更されたときの更新（デバウンス）
  useEffect(() => {
    const updateData = async () => {
      setIsLoadingSteps(true);
      // 選択された日付のデータを取得
      const dateKey = toDateKeyLocal(selectedDate);

      // 1. まずキャッシュ/ストレージから即時表示
      const cached = await getDailyData(dateKey);
      if (cached) {
        setSteps(cached.steps || 0);
        setCalories(cached.calories || 0);
        setDistance(cached.distance || 0);
        setGoal(cached.goal || 10000);
      } else {
        // データがない場合は0で初期化
        setSteps(0);
        setCalories(0);
        setDistance(0);
      }

      // 2. 今日の場合はリアルタイム更新（Pedometer/HealthKit）
      if (isToday(selectedDate)) {
        // Pedometerの更新はリスナーが行うのでここでは何もしない
        // ただし、HealthKit同期は行う
        try {
          const { steps: todaySteps } = await getTodayData();
          setSteps(todaySteps);
          // カロリー等は計算
          const userProfile = await getUserProfile();
          setCalories(calculateCalories(todaySteps, userProfile.weight));
          setDistance(calculateDistance(todaySteps, userProfile.stride));
        } catch (e) {
          console.error("Error syncing today data:", e);
        }
      }

      // 3. 時間別データの取得
      try {
        const hourly = await getHourlyStepsForDate(dateKey);
        setHourlySteps(hourly);

        // 天気情報の取得（キャッシュまたはAPI）
        // まずストレージから確認
        if (cached && cached.weather) {
          setWeather(cached.weather);
          // hourlyWeatherはストレージに保存していない場合が多いので、
          // 必要なら別途保存するか、APIから再取得する
          // ここでは簡易的にAPI取得を試みる（キャッシュが効くはず）
          const hourlyW = await fetchHourlyWeather();
          setHourlyWeather(hourlyW);
        } else {
          // データがない場合はAPIから取得
          const w = await fetchWeatherForLocation();
          setWeather(w);
          const hourlyW = await fetchHourlyWeather();
          setHourlyWeather(hourlyW);
        }
      } catch (e) {
        console.error("Error loading hourly data:", e);
      }

      setIsLoadingSteps(false);
    };

    if (selectedDebounceTimerRef.current) {
      clearTimeout(selectedDebounceTimerRef.current);
    }
    selectedDebounceTimerRef.current = setTimeout(updateData, 100);
  }, [selectedDate]);

  useEffect(() => {
    loadFeedbackMessage(selectedDate);
  }, [selectedDate, loadFeedbackMessage]);

  // steps/goalが変わったら進捗を強制的に同期（前日の値が残るのを防ぐ）
  useEffect(() => {
    const todayKey = toDateKeyLocal(new Date());
    if (todayKey !== lastProgressDateRef.current) {
      lastProgressDateRef.current = todayKey;
    }
    setProgress(
      clamp01(calculateGoalProgress(steps, goal || 10000) / 100)
    );
  }, [steps, goal]);

  // calories/goalCaloriesも同期
  useEffect(() => {
    const todayKey = toDateKeyLocal(new Date());
    if (todayKey !== lastProgressDateRef.current) {
      lastProgressDateRef.current = todayKey;
    }
    const calGoal = Number(goalCalories || 500);
    setCaloriesProgress(
      clamp01(calGoal > 0 ? calories / calGoal : 0)
    );
  }, [calories, goalCalories]);

  // 選択された日付のデータを取得
  const loadSelectedDateData = async () => {
    setIsLoadingSteps(true);
    try {
      const isAvailable = await Pedometer.isAvailableAsync();
      if (!isAvailable) {
        console.log("Pedometer is not available");
        setIsLoadingSteps(false);
        return;
      }

      const currentSelected = selectedDateRef.current || selectedDate;
      const dateKey = toDateKeyLocal(currentSelected);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedStart = new Date(currentSelected);
      selectedStart.setHours(0, 0, 0, 0);

      // 未来の日付（翌日以降）の場合は何もしない
      if (selectedStart > today) {
        setSteps(0);
        setCalories(0);
        setDistance(0);
        setProgress(0);
        setCaloriesProgress(0);
        setHourlySteps(Array(24).fill(0));
        return;
      }

      // その日の開始と終了時刻（HKに合わせて一日区切り）
      const start = new Date(currentSelected);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentSelected);
      end.setHours(23, 59, 59, 999);

      const userProfile = await getUserProfile();
      const settings = await getSettings();

      const range = await getStepsInRange(start, end);
      const dayEntry = (range || []).find((item) => item?.date === dateKey);
      const daySteps = Number(dayEntry?.steps || 0);
      const dayCalories = calculateCalories(daySteps, userProfile.weight);
      const dayDistance = calculateDistance(daySteps, userProfile.stride);
      const goalSteps = Number(settings.dailyGoal || goal || 10000);
      const goalKcal = Number(settings.goalCalories || goalCalories || 500);
      const dayProgress = clamp01(
        calculateGoalProgress(daySteps, goalSteps) / 100
      );
      const dayCaloriesProgress = clamp01(
        goalKcal > 0 ? dayCalories / goalKcal : 0
      );

      setSteps(daySteps);
      setCalories(dayCalories);
      setDistance(dayDistance);
      setProgress(dayProgress);
      setCaloriesProgress(dayCaloriesProgress);
      upsertWeeklyEntry(dateKey, daySteps, dayCalories, goalSteps, goalKcal);

      // スイープの手動制御はしない（標準animatedに任せる）

      // 値が大きく変わったときは、過去日でも軽い“弾む”演出を適用
      try {
        const prev = progress; // 現在のstate（0-1）
        const next = dayProgress; // 新しい進捗（0-1）
        if (Math.abs(next - prev) > 0.005) {
          bumpAnim.stopAnimation(() => {
            bumpAnim.setValue(1);
            Animated.sequence([
              Animated.timing(bumpAnim, {
                toValue: 1.06,
                duration: 180,
                useNativeDriver: true,
              }),
              Animated.timing(bumpAnim, {
                toValue: 1.0,
                duration: 250,
                useNativeDriver: true,
              }),
            ]).start();
          });
        }
      } catch (_) {}

      // 過去日100%の特別演出は無効化

      // 時間帯別のデータを取得（キャッシュ優先、なければPedometerで取得）
      try {
        // Weather Logic
        const storedData = await getDailyData(dateKey);
        if (storedData && storedData.weather) {
          setWeather(storedData.weather);
        } else if (isToday(currentSelected)) {
          // Fetch fresh weather for today
          const freshWeather = await fetchWeatherForLocation();
          if (freshWeather) {
            setWeather(freshWeather);
            // Save to storage (merge with existing)
            const currentData = storedData || {
              date: dateKey,
              steps: daySteps,
              calories: dayCalories,
            };
            await saveDailyData(dateKey, {
              ...currentData,
              weather: freshWeather,
            });
          } else {
            setWeather(null);
          }
        } else {
          setWeather(null);
        }

        // まずキャッシュを確認
        const cachedHourly = await getHourlyStepsForDate(dateKey);
        if (cachedHourly && cachedHourly.some((val) => val > 0)) {
          // キャッシュがあり、データが入っている場合はそれを使う
          setHourlySteps(cachedHourly);
        } else {
          // キャッシュがないか空の場合、Pedometerで取得
          const hourlyData = Array(24).fill(0);
          const isSelectedToday =
            currentSelected.toDateString() === today.toDateString();
          const maxHour = isSelectedToday ? new Date().getHours() : 23;
          for (let hour = 0; hour <= maxHour; hour++) {
            const hourStart = new Date(selectedDate);
            hourStart.setHours(hour, 0, 0, 0);
            const hourEnd = new Date(selectedDate);
            hourEnd.setHours(hour, 59, 59, 999);
            if (isSelectedToday && hour === maxHour) {
              hourEnd.setTime(Date.now());
            }
            try {
              const hourResult = await Pedometer.getStepCountAsync(
                hourStart,
                hourEnd
              );
              hourlyData[hour] = hourResult.steps;
            } catch (error) {
              console.warn(`Failed to get steps for hour ${hour}:`, error);
            }
          }
          setHourlySteps(hourlyData);
          // キャッシュに保存
          try {
            await saveHourlyStepsForDate(dateKey, hourlyData);
          } catch (_) {}
        }

        // Fetch hourly weather for the selected date
        try {
          const hourlyWeatherData = await fetchHourlyWeather(currentSelected);
          setHourlyWeather(hourlyWeatherData);
        } catch (error) {
          console.warn("Failed to load hourly weather:", error);
          setHourlyWeather(Array(24).fill(null));
        }
      } catch (error) {
        console.warn("Failed to load hourly steps:", error);
        setHourlySteps(Array(24).fill(0));
      }

      // 選択日のゴールを取得（今日/過去共通）
      try {
        const goalsForDate = await getOrCreateGoalsForDate(selectedStart);
        setSelectedGoals(goalsForDate);
        // 過去日の表示用に「次に目指す段階」を計算（cal < goal の最初）
        const idx = goalsForDate.findIndex(
          (g) => dayCalories < g.food.calories
        );
        setSelectedGoalsLevel(idx === -1 ? goalsForDate.length : idx + 1);
      } catch (_) {}

      // カレンダーイベントを取得
      try {
        const events = await getEventsForDate(selectedDate);
        setTodayEvents(events);
      } catch (calendarError) {
        console.log("Calendar not available:", calendarError);
        setTodayEvents([]);
      }
    } catch (error) {
      console.error("Error loading selected date data:", error);
    } finally {
      setIsLoadingSteps(false);
    }
  };

  useEffect(() => {
    // 🚀 起動1秒表示: キャッシュから即座に読み込み
    loadCachedData();

    // バックグラウンドで最新データを取得
    loadData();
    if (!DISABLE_PEDOMETER_DEV) {
      setupPedometer();
    }
    initializeApp();

    // 前回選択していた日付を復元（存在すれば）
    (async () => {
      // 履歴などから指定されている場合は復元しない
      if (route?.params?.selectedDate) return;
      try {
        const saved = await AsyncStorage.getItem(LAST_SELECTED_DATE_KEY);
        if (saved) {
          const [y, m, d] = saved.split("-").map(Number);
          if (y && m && d) {
            const restored = new Date(y, m - 1, d);
            // 未来日は無視
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const r0 = new Date(restored);
            r0.setHours(0, 0, 0, 0);
            if (r0 <= today) {
              // 週開始（同週の月曜）も整合
              const day = r0.getDay();
              const diff = day === 0 ? -6 : 1 - day;
              const monday = new Date(r0);
              monday.setDate(r0.getDate() + diff);
              monday.setHours(0, 0, 0, 0);
              setWeekStartDate(monday);
              setSelectedDate(r0);
              hasRestoredDateRef.current = true;
            }
          }
        }
      } catch (_) {}
      if (!hasRestoredDateRef.current) {
        hasRestoredDateRef.current = true;
      }
    })();

    // ⚡ リアルタイム自動更新: アプリがフォアグラウンドに戻った時に更新
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  // 日付変更を永続化
  useEffect(() => {
    (async () => {
      if (!hasRestoredDateRef.current) return;
      try {
        const y = selectedDate.getFullYear();
        const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const d = String(selectedDate.getDate()).padStart(2, "0");
        await AsyncStorage.setItem(LAST_SELECTED_DATE_KEY, `${y}-${m}-${d}`);
      } catch (_) {}
    })();
  }, [selectedDate]);

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
        // 現在の値を新しい目標で再計算
        const stepGoal = Number(s.dailyGoal || goal || 10000);
        const calGoal = Number(s.goalCalories || 500);
        setProgress(
          clamp01(calculateGoalProgress(steps, stepGoal) / 100)
        );
        setCaloriesProgress(
          clamp01(calGoal > 0 ? calories / calGoal : 0)
        );
      };
      reloadFavorites();
      reloadSettings();
      loadFeedbackMessage(selectedDateRef.current || selectedDate);
    }, [loadFeedbackMessage, selectedDate])
  );

  // アプリの状態が変わった時の処理
  const handleAppStateChange = async (nextAppState) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === "active"
    ) {
      // 日付が変わっていたら表示をリセット
      const todayKey = toDateKeyLocal(new Date());
      if (todayKey !== lastProgressDateRef.current) {
        lastProgressDateRef.current = todayKey;
        setSteps(0);
        setCalories(0);
        setDistance(0);
        setProgress(0);
        setCaloriesProgress(0);
        setHourlySteps(Array(24).fill(0));
      }
      try {
        await syncPastDaysToStorage(3);
      } catch (_) {}
      console.log("⚡ アプリがフォアグラウンドに復帰 - データを自動更新");
      await ensureTodayGoalLevelStart();
      try {
        setTodayGoals(await getOrCreateTodayGoals());
      } catch (_) {}
      await refreshData();
      await loadFeedbackMessage(selectedDateRef.current || selectedDate);
    }
    appState.current = nextAppState;
  };

  // データを強制的に更新（フォアグラウンド復帰時）
  const refreshData = async () => {
    // 選択されている日付のデータを再取得（最新のselectedDateをrefから参照）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentSelected = selectedDateRef.current || selectedDate;
    const isSelectedToday =
      currentSelected.toDateString() === today.toDateString();

    if (isSelectedToday) {
      const nowTs = Date.now();
      if (nowTs - (lastRefreshRef.current || 0) < 2000) return;
      lastRefreshRef.current = nowTs;
      // 今日の場合はPedometerを優先し、HealthKitはフォールバックにする（時差ズレ防止）
      try {
        const pedoSteps = await getTodayStepsViaPedometer();
        if (pedoSteps !== null) {
          console.log(`🔄 更新: ${pedoSteps}歩 (ソース: Pedometer)`);
          updateSteps(pedoSteps);
          return;
        }
      } catch (_) {}
      try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const list = await getStepsInRange(start, end);
        const todayKey = toDateKeyLocal(start);
        const record = (list || []).find((it) => it?.date === todayKey);
        const stepsVal = Number(record?.steps || 0);
        console.log(`🔄 更新: ${stepsVal}歩 (ソース: HealthKitフォールバック)`);
        if (stepsVal >= 0) {
          updateSteps(stepsVal);
        } else {
          setProgress(0);
          setCaloriesProgress(0);
        }
      } catch (error) {
        console.error("歩数データ更新に失敗:", error);
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
        setSteps(cached.steps || 0);
        setCalories(cached.calories || 0);
        setDistance(cached.distance || 0);
        const cachedGoal = Number(cached.goal || goal || 10000);
        const cachedCalGoal = Number(goalCalories || 500);
        setProgress(
          clamp01(
            calculateGoalProgress(cached.steps || 0, cachedGoal) / 100
          )
        );
        setCaloriesProgress(
          clamp01(
            cachedCalGoal > 0 ? (cached.calories || 0) / cachedCalGoal : 0
          )
        );
        console.log("✅ キャッシュからデータを表示しました");
        setIsLoadingSteps(false);
      } else {
        console.log("⏳ キャッシュなし - ローディング表示");
        setIsLoadingSteps(true);
      }
    } catch (error) {
      console.error("キャッシュの読み込みに失敗:", error);
      setIsLoadingSteps(true);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeApp = async () => {
    // 通知はオンボーディングでリクエストする（ここではリスナーのみ設定）
    const subscription = setupNotificationListeners((data) => {
      console.log("通知がタップされました:", data);
      try {
        logEvent("notification_opened", { type: data?.type || "unknown" });
      } catch (_) {}
      // 必要に応じて画面遷移などの処理を追加
    });

    // 歩数計の初期化（権限リクエストはオンボーディングで行うため、ここではスキップ）
    // オフライン時はキャッシュをそのまま利用

    // HealthKit背景更新（通知用） + BackgroundFetch（フォールバック）
    // HealthKitの背景更新は使用しない（歩数取得はPedometerのみ）

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
      setTodayStepsSnapshot(todayData.steps || 0);
      setCalories(todayData.calories);
      setDistance(todayData.distance);
      // プログレスは0-1で保持
      const stepGoal = Number(settings.dailyGoal || goal || 10000);
      const calGoal = Number(settings.goalCalories || 500);
      setProgress(
        clamp01(calculateGoalProgress(todayData.steps, stepGoal) / 100)
      );
      setCaloriesProgress(
        clamp01(calGoal > 0 ? todayData.calories / calGoal : 0)
      );
      upsertWeeklyEntry(
        getTodayDateString(),
        todayData.steps,
        todayData.calories,
        stepGoal,
        calGoal
      );

      // 毎日リセット方針のため、前日達成による持ち越しは行わない
    }

    // 起動直後にPedometerで当日分を再取得（時差・前日データ残りをリセット）
    try {
      const pedoSteps = await getTodayStepsViaPedometer();
      if (pedoSteps !== null) {
        updateSteps(pedoSteps);
      }
    } catch (_) {}

    // 初回のみ：Pedometerで過去（最大7日）を取り込み → 保存
    try {
      const didSeed = await seedPastDaysPedometer(7);
      if (didSeed) setIsCalculatingStats(false);
    } catch (_) {
      setIsCalculatingStats(false);
    }

    // 全期間データを取得（トロフィー・ストリーク計算用）
    // AsyncStorageから取得（Pedometerは今日のみ、過去は保存済みデータを使用）
    try {
      const allData = await getAllDailyData();
      console.log(
        "📊 [AllTimeData] データ件数:",
        Object.keys(allData).length,
        "日分"
      );

      // 初回のみ: HealthKitから過去データをインポート（オンボーディングで実行済み）
      // 日々の歩数はPedometerで取得してsaveTodayDataで保存される
      // HistoryScreenはHealthKitから表示するが、トロフィー計算はStorageのみ使用

      setAllTimeData(allData);
      try {
        await backfillFeedbackHistory(7);
      } catch (error) {
        console.error("Feedback backfill failed:", error);
      }
    } catch (error) {
      console.error("Error loading all-time data:", error);
    }

    // 以下は旧コード（HealthKitから取得・遅い）をコメントアウト
    /*
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 364); // 365日分
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);

      const rangeData = await getStepsInRange(startDate, endDate);
      const allData = {};

      if (Array.isArray(rangeData)) {
        for (const item of rangeData) {
          if (item?.date) {
            allData[item.date] = {
              steps: item.steps || 0,
              calories: item.calories || 0,
              goal: settings.dailyGoal, // 過去データは現在の目標を使用
            };
          }
        }
      }

      setAllTimeData(allData);
      console.log(
        "📊 All-time data loaded:",
        Object.keys(allData).length,
        "days"
      );
    } catch (error) {
      console.error("Error loading all-time data:", error);
    }
    */
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
      console.error("Error refreshing data:", error);
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
        console.log("🔁 目標レベルをリセット（新しい日）");
      }
    } catch (error) {
      console.error("Error ensuring daily goal level reset:", error);
    }
  };

  // 食べ物目標達成チェック - その日中にレベルアップ
  const checkFoodGoalAchievement = async (currentCalories) => {
    try {
      if (levelUpLockRef.current) return; // 多重実行を防止
      const currentDynamic =
        todayGoals[currentGoalLevel - 1] || getCurrentGoal(currentGoalLevel);

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

          console.log("🎉 食べ物レベルアップ！", {
            oldLevel: currentGoalLevel,
            newLevel: newLevel,
            oldFood: currentDynamic.food.name,
            newFood: nextGoal.food.name,
            currentCalories: currentCalories,
          });
          // 段階通知は送らない（全体ポリシー: 80%/100% のみ）
        } else {
          console.log("✨ 最高レベル達成！", currentDynamic.food.name);
        }
      }
    } catch (error) {
      console.error("Error checking food goal achievement:", error);
    } finally {
      levelUpLockRef.current = false;
    }
  };

  const setupPedometer = async () => {
    if (DISABLE_PEDOMETER_DEV) return;
    try {
      const isAvailable = await Pedometer.isAvailableAsync();
      setIsPedometerAvailable(isAvailable);

      if (isAvailable) {
        // HealthKit優先なので初回の直接上書きは行わず、watchでrefreshDataを呼ぶ
        setIsLoadingSteps(false);

        // Subscribe to real-time updates
        // 注意: watchStepCountは増分を返すため、再度getStepCountAsyncで合計を取得
        const subscription = Pedometer.watchStepCount((result) => {
          // 歩数が更新されたら、今日の合計を再取得（ハイブリッド）
          refreshData();
        });

        return () => subscription && subscription.remove();
      }
    } catch (error) {
      console.error("歩数計のセットアップに失敗:", error);
      // 🌍 オフライン対応: エラー時はキャッシュデータを使用（既に表示済み）
      setIsPedometerAvailable(false);
    }
  };

  // Pedometerからのデータを更新（アプリ内で計算）
  const updateSteps = async (newSteps) => {
    const oldSteps = steps;
    // 体重を考慮した歩行カロリー計算
    const cal = calculateCalories(newSteps, profile.weight);
    const dist = calculateDistance(newSteps, profile.stride);
    const safeGoal = Number(goal || 10000);
    const prog = clamp01(
      calculateGoalProgress(newSteps, safeGoal) / 100
    );
    const calGoal = Number(goalCalories || 500);
    const calProg = clamp01(calGoal > 0 ? cal / calGoal : 0);

    // 表示の更新は「今日」を見ている時だけ行う（過去日表示中に飛ばないように）
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentSelected = selectedDateRef.current || selectedDate;
      const isViewingToday =
        currentSelected.toDateString() === today.toDateString();
      if (isViewingToday) {
        setSteps(newSteps);
        setCalories(cal);
        setDistance(dist);
        setProgress(prog);
        setCaloriesProgress(calProg);
      }
    } catch (_) {}

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

    setTodayStepsSnapshot(newSteps);

    // 🚀 キャッシュにも保存（起動高速化）
    await cacheTodayData(data);
    await maybeSaveFeedbackSnapshot(newSteps);

    // 食べ物目標達成チェック - その日中にレベルアップ
    await checkFoodGoalAchievement(cal);

    // 週カレンダー表示も即時更新
    upsertWeeklyEntry(data.date, newSteps, cal, safeGoal, calGoal);

    // 分析: 同期イベント（Pedometerアプリ内計測）
    try {
      await logEvent("steps_synced", {
        date: data.date,
        steps: newSteps,
        provider: "pedometer",
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

      // 常駐型ウィジェットは無効化（ユーザー体験を簡素化）
    }

    // スイープの手動制御はしない（標準animatedに任せる）

    // 小気味よい弾む演出（大きく変化したとき）: 今日表示時のみ
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentSelected = selectedDateRef.current || selectedDate;
      const isViewingToday =
        currentSelected.toDateString() === today.toDateString();
      if (isViewingToday) {
        const nextNorm = prog / 100;
        const prev = oldSteps / Math.max(1, goal);
        if (nextNorm - prev > 0.005) {
          bumpAnim.stopAnimation(() => {
            bumpAnim.setValue(1);
            Animated.sequence([
              Animated.timing(bumpAnim, {
                toValue: 1.06,
                duration: 180,
                useNativeDriver: true,
              }),
              Animated.timing(bumpAnim, {
                toValue: 1.0,
                duration: 250,
                useNativeDriver: true,
              }),
            ]).start();
          });
        }
      }
    } catch (_) {}
  };

  // (obsolete) food card renderer was replaced by DailyFoodGoal

  const isStepGoalAchieved = progress >= 1.0;
  const progressColor = isStepGoalAchieved ? theme.success : theme.accent;

  // トロフィー・ストリーク計算（バックグラウンドで実行）
  useEffect(() => {
    const calculateStats = async () => {
      // キャッシュから読み込み
      const cached = await getStatsCache();
      if (cached) {
        setTotalTrophies(cached.totalTrophies);
        setCurrentStreak(cached.currentStreak);
        setMaxStreak(cached.maxStreak);
      }

      // allTimeDataがあればバックグラウンドで再計算
      if (Object.keys(allTimeData).length > 0) {
        setIsCalculatingStats(true);

        // 少し待ってから計算開始（UI優先）
        setTimeout(() => {
          // 今日の最新歩数・目標を allTimeData に反映してから計算（リアルタイム追従）
          const todayKey = getTodayDateString();
          const mergedAllData = {
            ...allTimeData,
            [todayKey]: {
              ...(allTimeData[todayKey] || {}),
              steps: todayStepsSnapshot,
              goal: goal,
            },
          };
          const { totalTrophies, currentStreak, maxStreak } =
            computeTrophiesStreak(mergedAllData, 10000, new Date());
          setTotalTrophies(totalTrophies);
          setCurrentStreak(currentStreak);
          setMaxStreak(maxStreak);
          setIsCalculatingStats(false);

          // キャッシュに保存
          saveStatsCache(totalTrophies, currentStreak, maxStreak);
        }, 100);
      }
    };

    calculateStats();
  }, [allTimeData, todayStepsSnapshot, goal]);

  // シェア画面用の集計データ（選択日基準）
  const shareStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);

    // WEEK: 選択日の前日までの7日分
    let weekTotal = 0;
    for (let i = 1; i <= 7; i++) {
      const d = new Date(selected);
      d.setDate(selected.getDate() - i);
      const key = d.toISOString().split("T")[0];
      weekTotal += allTimeData[key]?.steps || 0;
    }

    // MONTH: 選択日から過去30日分（選択日を含む）
    let monthTotal = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(selected);
      d.setDate(selected.getDate() - i);
      const key = d.toISOString().split("T")[0];
      monthTotal += allTimeData[key]?.steps || 0;
    }

    // ALL TIME: 全データの合計
    const allTotal = Object.values(allTimeData).reduce(
      (sum, data) => sum + (data?.steps || 0),
      0
    );

    return { weekTotal, monthTotal, allTotal };
  }, [allTimeData, selectedDate]);

  // ロケールに応じた日付表示（M/DまたはM月D日）
  const formatMonthDay = (date) => formatMonthDayHelper(date, locale);

  const formatMonthYear = (date) => formatMonthYearHelper(date, locale);

  const feedbackTitle = useMemo(() => {
    if (!feedbackTargetDate) {
      return t("home.feedback.title");
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayKey = toDateKeyLocal(yesterday);
    if (feedbackTargetDate === yesterdayKey && isToday(selectedDate)) {
      return t("home.feedback.title");
    }
    const parsed = new Date(`${feedbackTargetDate}T00:00:00`);
    return t("home.feedback.forDate", {
      date: formatMonthDay(parsed),
    });
  }, [feedbackTargetDate, selectedDate, t, formatMonthDay]);

  // 80%でやさしいパルス、100%でハプティクス（対応端末）: 今日のみ
  useEffect(() => {
    const isSelectedToday =
      selectedDate.toDateString() === new Date().toDateString();
    const nearSteps = isSelectedToday && progress >= 0.8 && progress < 1.0;
    const nearCalories =
      isSelectedToday && caloriesProgress >= 0.8 && caloriesProgress < 1.0;
    const near = activeTab === "steps" ? nearSteps : nearCalories;

    if (near) {
      if (!pulseLoopRef.current) {
        const seq = Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]);
        const loop = Animated.loop(seq);
        loop.start();
        pulseLoopRef.current = loop;
      }
    } else {
      if (pulseLoopRef.current) {
        try {
          pulseLoopRef.current.stop();
        } catch (_) {}
        pulseLoopRef.current = null;
      }
      pulseAnim.setValue(1);
    }
  }, [activeTab, progress, caloriesProgress, selectedDate]);

  useEffect(() => {
    const isSelectedToday =
      selectedDate.toDateString() === new Date().toDateString();
    const stepsReached = progress >= 1.0;
    const caloriesReached = caloriesProgress >= 1.0;
    if (isSelectedToday) {
      if (
        !goalReachedRef.current.steps &&
        stepsReached &&
        Haptics?.notificationAsync
      ) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
      }
      if (
        !goalReachedRef.current.calories &&
        caloriesReached &&
        Haptics?.notificationAsync
      ) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
      }
    }
    goalReachedRef.current = { steps: stepsReached, calories: caloriesReached };
  }, [progress, caloriesProgress, selectedDate]);

  if (isLoading) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, position: "relative" }}>
      {/* プルトゥリフレッシュインジケーター */}
      {pullToRefreshIndicator && !refreshing && (
        <View
          style={{
            position: "absolute",
            top: 50,
            left: 0,
            right: 0,
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <View
            style={{
              backgroundColor: theme.primary,
              borderRadius: 25,
              padding: 12,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 1,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Text style={{ color: "#FFF", fontSize: 18, fontWeight: "bold" }}>
              ↓
            </Text>
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
        {/* センサー未対応バナーは表示しない（UI簡素化） */}
        {/* 週のナビゲーション */}
        <View style={[styles.dateNavigation, { paddingTop: insets.top + 20 }]}>
          {/* トロフィー数とストリーク（縦2行） */}
          <View
            style={{ position: "absolute", left: 20, top: insets.top + 10 }}
          >
            {/* Free/Pro Badge - Subtle & Clickable */}
            <TouchableOpacity 
              style={{ 
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.05)', 
                paddingHorizontal: 8, 
                paddingVertical: 4, 
                borderRadius: 12, 
                alignSelf: 'flex-start',
                marginBottom: 4
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.text, opacity: 0.7, letterSpacing: 0.5 }}>
                FREE
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.text, opacity: 0.4, marginLeft: 2 }}>
                {'>'}
              </Text>
            </TouchableOpacity>

            <HeaderStats
              totalTrophies={totalTrophies}
              currentStreak={currentStreak}
              isCalculating={isCalculatingStats}
              theme={theme}
            />
            {/* Weather Summary Badge Removed */}
          </View>

        {/* 日付ナビゲーション */}
        <View style={[styles.dateNav, { marginTop: 10 }]}>
          <TouchableOpacity
            onPress={() => changeDate(-1)}
            style={[styles.dateNavButton, styles.navButtonLeft]}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Animated.Text style={[styles.dateNavArrow, { color: theme.text, transform: [{ translateX: arrowBounceAnim.interpolate({ inputRange: [0, 10], outputRange: [0, -5] }) }] }]}>◀</Animated.Text>
          </TouchableOpacity>
          <View style={styles.dateDisplay}>
            <TouchableOpacity onPress={() => setCalendarVisible(true)}>
              <Text style={[styles.dateText, { color: theme.text }]}>
                {formatMonthDayHelper(selectedDate, locale)}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => changeDate(1)}
            style={[
              styles.dateNavButton,
              styles.navButtonRight,
              isFuture(selectedDate) && styles.disabledButton,
            ]}
            disabled={isFuture(selectedDate)}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Animated.Text style={[styles.dateNavArrow, { color: theme.text, opacity: isFuture(selectedDate) ? 0.3 : 1, transform: [{ translateX: arrowBounceAnim.interpolate({ inputRange: [0, 10], outputRange: [0, 5] }) }] }]}>▶</Animated.Text>
          </TouchableOpacity>
        </View>
      </View>

        {/* 今日へ戻るチップ（右利き向けに右寄せ） */}
        {/* 配置: 横スクロールの週カレンダーの直下に表示 */}
        {/* カレンダーアイコン（画面右上固定） */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("home.a11y.openCalendar")}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          style={[
            styles.calendarIconButton,
            { top: insets.top + 10, backgroundColor: theme.card },
          ]}
          onPress={() => {
            setShowCalendarModal(true);
            loadMonthlyData(calendarMonth); // モーダルを開く時に当月データを取得
          }}
        >
          <CalendarIcon color={theme.text} size={24} />
        </TouchableOpacity>

        {/* インライン通知は非表示 */}

        {/* 歩数/カロリー タブ */}
        <MetricTabs
          theme={theme}
          styles={styles}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          t={t}
        />

        {/* 週の操作ボタン群は削除（上部に重複する今日へをなくす） */}

        {/* 横スクロールカレンダー */}
        <WeekCalendar
          theme={theme}
          t={t}
          styles={styles}
          calendarDates={calendarDates}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          weeklyData={weeklyData}
          weeklyDisplayMode={weeklyDisplayMode}
          goal={goal}
          goalCalories={goalCalories}
          notesMap={notesMap}
          getWeekdayShort={getWeekdayShort}
          isToday={isToday}
          isFuture={isFuture}
          calendarAnimValues={calendarAnimValues}
          calendarScrollRef={calendarScrollRef}
          handleCalendarScroll={handleCalendarScroll}
          handleCalendarScrollEnd={handleCalendarScrollEnd}
        />

        {/* 今日へ戻るチップ（横スクロール週の直下・右寄せ） */}
        {!isToday(selectedDate) && (
          <View
            style={{
              alignItems: "flex-end",
              marginTop: 6,
              paddingRight: 20,
              paddingLeft: 20,
              zIndex: 10,
              position: "relative",
            }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("home.a11y.backToToday")}
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
                zIndex: 10,
              }}
            >
              <Text style={{ color: theme.textSecondary, fontWeight: "700" }}>
                {t("home.backToToday")}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* スワイプ可能なメインコンテンツエリア */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            transform: [{ translateX: slideAnim }],
            position: "relative",
            zIndex: 5,
          }}
        >
          {/* 円形プログレス（タブ切替） */}
          <View style={styles.circleContainer}>
            {/* 背面グロー（段階グラデーション） */}
            <View style={styles.glowWrapper} pointerEvents="none">
              {selectedGlowSizes
                .map((size, index) => ({
                  size,
                  color: selectedGlowColors[index],
                }))
                .sort((a, b) => b.size - a.size) // 大きいものを背面、小さいものを前面
                .map(({ size, color }, idx) => (
                  <View
                    key={`glow-${size}-${idx}`}
                    style={[
                      styles.glow,
                      {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor:
                          color || selectedGlowColors[selectedGlowColors.length - 1],
                      },
                    ]}
                  />
                ))}
            </View>
            <TouchableOpacity
              activeOpacity={1}
              onLongPress={() => {
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
              }}
            >
              <View
                style={[
                  styles.circleBackground,
                  { backgroundColor: theme.card, shadowColor: theme.shadow },
                ]}
              >
                {(() => {
                  const ringP = clamp01(
                    activeTab === "steps" ? progress : caloriesProgress
                  );
                  const isFull = ringP >= 0.999;
                  const ringColor =
                    activeTab === "steps"
                      ? ringP >= 1.0
                        ? theme.success
                        : theme.accent
                      : ringP >= 1.0
                      ? theme.success
                      : theme.accent;
                  return (
                    <ProgressRing
                      size={200}
                      progress={ringP}
                      color={ringColor}
                      unfilledColor={
                        isFull ? "transparent" : theme.circleUnfilled
                      }
                      thickness={12}
                      bumpAnim={bumpAnim}
                      pulseAnim={pulseAnim}
                    />
                  );
                })()}
                <View style={styles.circleCenter}>
                  {activeTab === "steps" ? (
                    <>
                      <Text style={[styles.percentText, { color: theme.text }]}>
                        {formatNumber(steps)}
                      </Text>
                      <Text
                        style={[
                          styles.goalLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {t("units.steps")}
                      </Text>
                      <Text
                        style={[
                          styles.progressSubtext,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {t("home.progress.rate")}: {Math.round(clamp01(progress) * 100)}%
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.percentText, { color: theme.text }]}>
                        {calories.toFixed(0)}
                      </Text>
                      <Text
                        style={[
                          styles.goalLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {t("units.kcal")}
                      </Text>
                      <Text
                        style={[
                          styles.progressSubtext,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {t("home.progress.rate")}:{" "}
                        {Math.round(clamp01(caloriesProgress) * 100)}%
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Action Row: Finger & ShareCTA */}
          {/* Action Row: Finger & ShareCTA */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', paddingHorizontal: 20, marginTop: 10, marginBottom: 12, zIndex: 10 }}>
            {/* Finger Icon */}
            {/* Finger Icon Removed */}

            {/* Share CTA */}
            <ShareCTA
              selectedDate={selectedDate}
              steps={steps}
              goal={goal}
              navigation={navigation}
              theme={theme}
              t={t}
            />
          </View>



          {/* 時間帯別グラフ */}
          <HourlyChart
            styles={styles}
            theme={theme}
            t={t}
            isToday={isToday}
            selectedDate={selectedDate}
            formatMonthDay={formatMonthDay}
            hourlyDetailTooltip={hourlyDetailTooltip}
            setHourlyDetailTooltip={setHourlyDetailTooltip}
            hourlyDetailTimerRef={hourlyDetailTimerRef}
            hourlySteps={hourlySteps}
            hourlyWeather={hourlyWeather}
            profile={profile}
            setChartWidth={setChartWidth}
          />

          {/* 今日のひとこと */}
          <TodayNote
            theme={theme}
            date={toDateKeyLocal(selectedDate)}
            onNoteChange={async (text) => {
              // 最近のひとこと一覧を更新
              if (recentNotesRef.current) {
                recentNotesRef.current.reload();
              }
              // コメントマップを更新
              const dateKey = toDateKeyLocal(selectedDate);
              setNotesMap((prev) => ({ ...prev, [dateKey]: !!text }));
            }}
          />

          {/* Daily Feedback Message */}


          {/* Stats カード（タブ切替） */}


          {/* 今日の予定（常に表示） */}
          <EventsCard
            styles={styles}
            theme={theme}
            t={t}
            todayEvents={todayEvents}
          />

          {/* Daily Feedback Message */}
          {dailyFeedback && (
            <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
              <View style={{
                backgroundColor: theme.card,
                borderRadius: 16,
                padding: 16,
                shadowColor: theme.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
                borderWidth: 1,
                borderColor: theme.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <AppIcon name="lightbulb" size={18} color={theme.primary} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '600' }}>
                    昨日のフィードバック
                  </Text>
                </View>
                <Text style={{ fontSize: 14, lineHeight: 22, color: theme.text, fontWeight: '500' }}>
                  {dailyFeedback}
                </Text>
              </View>
            </View>
          )}

          {/* 今日のひとこと */}


          {/* 時間帯別グラフ */}



          {/* 最近のひとこと */}
          <RecentNotes
            ref={recentNotesRef}
            theme={theme}
            onNotePress={(date) => {
              // その日の詳細へジャンプ
              const targetDate = new Date(date);
              setSelectedDate(targetDate);
            }}
          />
        </Animated.View>

        {/* 画面端タップで日付切り替え */}
        {/* 左端：全体タップ可能（ボタンなし） */}
        <TouchableOpacity
          activeOpacity={1}
          style={{
            position: "absolute",
            left: 0,
            top: 100,
            bottom: 100,
            width: 60,
            zIndex: 1,
          }}
          onPress={() => changeDate(-1)}
        />
        {/* 右端：「今日へ」とShare buttonを避けて3分割 */}
        {/* 右端上部：反応エリア（「今日へ」の上） */}
        <TouchableOpacity
          activeOpacity={1}
          style={{
            position: "absolute",
            right: 0,
            top: 100,
            height: 80,
            width: 60,
            zIndex: 1,
          }}
          onPress={() => changeDate(1)}
        />
        {/* 右端中部：反応エリア（「今日へ」とShare buttonの間） */}
        <TouchableOpacity
          activeOpacity={1}
          style={{
            position: "absolute",
            right: 0,
            top: 220,
            height: 30,
            width: 60,
            zIndex: 1,
          }}
          onPress={() => changeDate(1)}
        />
        {/* 右端下部：反応エリア（Share buttonの下） */}
        <TouchableOpacity
          activeOpacity={1}
          style={{
            position: "absolute",
            right: 0,
            top: 300,
            bottom: 100,
            width: 60,
            zIndex: 1,
          }}
          onPress={() => changeDate(1)}
        />

        {/* デバッグ情報 */}
        {isPedometerAvailable === false && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>
              {t("home.debug.pedometerUnavailable")}
            </Text>
            <Text style={styles.debugText}>{t("home.debug.tipManual")}</Text>
          </View>
        )}
        {isPedometerAvailable === null && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>
              {t("home.debug.pedometerChecking")}
            </Text>
          </View>
        )}

        {/* Calendar Modal */}
        <CalendarModal
          visible={showCalendarModal}
          initialDate={selectedDate}
          onClose={() => setShowCalendarModal(false)}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setShowCalendarModal(false);
          }}
        />
      </ScrollView>
    </View>
  );
}
