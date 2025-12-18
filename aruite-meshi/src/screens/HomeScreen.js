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
  Image,
  Platform,
  ImageBackground,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Pedometer } from "expo-sensors";
import { getTheme } from "../utils/theme";
import { useI18n } from "../i18n/I18nProvider";
import { useSubscription, isDateWithinLimit } from "../contexts/SubscriptionContext";
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
  getTop3Days,
  saveSettings,
} from "../utils/storage";
import {
  getCachedTodayData,
  cacheTodayData,
  getLatestCachedData,
} from "../utils/cache";
import { getFoodById, calculateFoodAmount } from "../data/foodDatabase";
import { getCurrentGoal, isGoalAchieved } from "../data/dailyGoals";
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
  sendTop3RankingNotification,
} from "../utils/notifications";
import { saveReminderEnabled } from "../utils/storage";
import { logEvent } from "../utils/analytics";
import { getStepsInRange, syncPastDaysToStorage, importExtendedHistoricalData, isExtendedImportCompleted } from "../utils/healthKit";
import { registerBackgroundStepsTask } from "../tasks/backgroundStepsTask";

// Swiftモジュール（時間帯別歩数の高速取得）
let HealthKitSwift = null;
try {
  HealthKitSwift = require("healthkit-swift");
} catch (e) {
  console.log("[HomeScreen] Swift module not available");
}
import { CalendarIcon } from "../components/SettingsIcons";
import { getEventsForDate, getEventsSummary } from "../utils/calendar";
import TodayNote from "../components/TodayNote";
import CalendarModal from "../components/CalendarModal";
import RecentNotes from "../components/RecentNotes";
import { hasNote } from "../utils/dayNotes";
import HeaderStats from "../components/HeaderStats";
import ProgressRing from "../components/ProgressRing";
import AchievementStamp from "../components/AchievementStamp";
import PaperTexture from "../components/PaperTexture";
import ShareCTA from "../components/ShareCTA";
import WeekCalendar from "../components/WeekCalendar";
import HourlyChart from "../components/HourlyChart";
// MetricTabs removed - カロリー・距離はリング下に統合表示
import StatsCards from "../components/StatsCards";
import EventsCard from "../components/EventsCard";
import DiaryCard from "../components/DiaryCard";
import FlipCard from "../components/FlipCard";
import * as ImagePicker from "expo-image-picker";
import DataPage from "../components/DataPage";
import DataFlipCard from "../components/DataFlipCard";
import { computeTrophiesStreak } from "../utils/stats";
import { AppIcon } from "../components/AppIcon";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { seedPastDaysPedometer } from "../utils/pedometerSeed";
import styles from "./home/styles";
import ScreenContainer from "../components/ScreenContainer";
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

const formatSteps = (value) => {
  const num = Math.round(Number(value) || 0);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const buildFeedbackLines = (plan) => {
  if (!plan) return ["データが足りませんでした。しばらく歩いてからもう一度お試しください。"];

  const lines = [];
  const goalStr = formatSteps(plan.recommendedGoal);
  if (plan.restDay) {
    lines.push(`今日はリズム調整日。目標は${goalStr}歩に抑えて回復を優先しましょう。`);
  } else {
    lines.push(`今日のおすすめ目標は${goalStr}歩です。`);
  }

  if (plan.goalDeltaPercent > 0) {
    lines.push(`最近好調なので目標を+${plan.goalDeltaPercent}%アップしています。`);
  } else if (plan.goalDeltaPercent < 0) {
    lines.push(`無理なく続けるために目標を${Math.abs(plan.goalDeltaPercent)}%ほど軽くしています。`);
  } else {
    lines.push("ペースはそのままでOKです。");
  }

  if (plan.restDay) {
    lines.push("短い散歩かストレッチだけでリズムを維持しましょう。");
  } else if (plan.debug?.lowMood) {
    lines.push("気分が落ち気味なので短時間の散歩から始めてみてください。");
  }

  return lines;
};

// Dev flag: Pedometer の取り込みを一時停止（HealthKit取り込みの切り分け用）
const DISABLE_PEDOMETER_DEV = false;

// 歩数取得はHealthKit優先（フォールバックでPedometer/ストレージ）
const USE_PEDOMETER_ONLY = false;

// 永続化用キー: 最後に選択した日付（YYYY-MM-DD）
const LAST_SELECTED_DATE_KEY = "ui_last_selected_date";
// 初回起動時にPedometerで過去データを取り込んだかのフラグ
const PEDOMETER_INITIAL_IMPORT_KEY = "pedometer_initial_import_v1";
// ジェスチャーヒントの表示回数（3回表示後に非表示）
const GESTURE_HINT_COUNT_KEY = "gesture_hint_view_count";
const FEEDBACK_CACHE_KEY = "ai_feedback_daily_cache_v1";

import {
  fetchWeatherForLocation,
  getWeatherIcon,
  fetchWeatherHistory,
  fetchHourlyWeather,
  getWeatherSummary,
} from "../utils/weather";
import { generateAdaptivePlanFromStorage } from "../utils/aiAdaptiveGoal";
import { generateDailyAIFeedback } from "../utils/aiFeedback";
import { getTrialState } from "../utils/trial";
import { requestCalendarPermissions } from "../utils/calendar";

export default function HomeScreen({ navigation, route }) {
  // RecentNotesコンポーネントへの参照
  const recentNotesRef = useRef(null);

  // 課金状態
  const { isPremium, limits, presentPaywall } = useSubscription();

  // 日付関連（週単位のスライドウィンドウ）
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weather, setWeather] = useState(null); // New Weather State
  const [hourlyWeather, setHourlyWeather] = useState(Array(24).fill(null)); // Hourly weather codes
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackPlan, setFeedbackPlan] = useState(null);
  const [feedbackUnread, setFeedbackUnread] = useState(true);
  const [lastFeedbackDate, setLastFeedbackDate] = useState(null);
  const [settingsCache, setSettingsCache] = useState(null);
  const [feedbackLineAnims, setFeedbackLineAnims] = useState([]);
  const [trialState, setTrialState] = useState(null);
  const [bestDay, setBestDay] = useState(null);
  const [suggestedWalk, setSuggestedWalk] = useState(null);
  const [calendarGranted, setCalendarGranted] = useState(null);

  // Weather History Sync (One-time on mount)
  useEffect(() => {
    const syncWeather = async () => {
      const history = await fetchWeatherHistory(92);
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
  const isSelectedToday = isTodayHelper(selectedDate);

  useEffect(() => {
    if (!isSelectedToday) return;
    const dateKey = toDateKeyLocal(selectedDate);
    if (lastFeedbackDate !== dateKey) {
      refreshDailyFeedback();
    }
  }, [isSelectedToday, selectedDate, lastFeedbackDate, refreshDailyFeedback]);

  useEffect(() => {
    // トライアル状態の取得
    const loadTrial = async () => {
      try {
        const state = await getTrialState();
        setTrialState(state);
      } catch (_) {
        setTrialState(null);
      }
    };
    loadTrial();

    // ベストデイ取得（トップ1）
    const loadBestDay = async () => {
      try {
        const top = await getTop3Days();
        if (Array.isArray(top) && top.length > 0) {
          setBestDay(top[0]);
        }
      } catch (_) {}
    };
    loadBestDay();

    // 簡易ウォーキング予約提案（時間帯のみでサジェスト）
    const computeSuggestion = () => {
      const now = new Date();
      const morning = now.getHours() < 12;
      setSuggestedWalk({
        time: morning ? "08:00" : "18:00",
        duration: 15,
        label: morning ? t("home.trial.walkLabelMorning") : t("home.trial.walkLabelEvening"),
      });
    };
    computeSuggestion();

    // カレンダー権限確認（プロンプトはボタンで実行するためここはスキップ）
    setCalendarGranted(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadTrial = async () => {
        try {
          const state = await getTrialState();
          setTrialState(state);
        } catch (_) {
          setTrialState(null);
        }
      };
      loadTrial();
    }, [])
  );

  useEffect(() => {
    const lines = feedbackPlan?.lines || [];
    const anims = lines.map(() => new Animated.Value(0));
    setFeedbackLineAnims(anims);
    if (anims.length) {
      Animated.stagger(
        120,
        anims.map((v) =>
          Animated.timing(v, {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
          })
        )
      ).start();
    }
  }, [feedbackPlan?.lines]);

  const loadCachedFeedback = async (dateKey) => {
    try {
      const raw = await AsyncStorage.getItem(FEEDBACK_CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj?.date === dateKey && Array.isArray(obj.lines)) {
        return obj.lines;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const saveCachedFeedback = async (dateKey, lines) => {
    try {
      await AsyncStorage.setItem(
        FEEDBACK_CACHE_KEY,
        JSON.stringify({ date: dateKey, lines })
      );
    } catch (_) {}
  };

  const refreshDailyFeedback = useCallback(async (force = false) => {
    setFeedbackLoading(true);
    try {
      const dateKey = toDateKeyLocal(selectedDate);
      const plan = await generateAdaptivePlanFromStorage({ today: selectedDate });
      // その日の確定値をストレージから取得して、ステートの取り違えを防ぐ
      const stored = await getDailyData(dateKey);
      const stepsForFeedback = typeof stored?.steps === "number" ? stored.steps : steps;
      const goalForFeedback = typeof stored?.goal === "number" ? stored.goal : goal;
      let aiLines = null;
      if (!force) {
        aiLines = await loadCachedFeedback(dateKey);
      }

      try {
        if (!aiLines) {
          aiLines = await generateDailyAIFeedback({
            date: dateKey,
            locale,
            plan,
            currentGoal: goalForFeedback,
            steps: stepsForFeedback,
            detail: isPremium ? 'long' : 'short',
          });
        }
      } catch (e) {
        console.warn('[Home] AI feedback skipped', e?.message || e);
      }

      const linesToUse = aiLines && aiLines.length ? aiLines : buildFeedbackLines(plan);
      setFeedbackPlan({
        ...plan,
        lines: linesToUse,
      });

      // Pro限定: 歩数トレンドに合わせてカロリー目標を自動調整
      if (isPremium && plan?.recommendedCalories) {
        const nextCalGoal = plan.recommendedCalories;
        setGoalCalories(nextCalGoal);
        try {
          const currentSettings = settingsCache || await getSettings();
          await saveSettings({ ...currentSettings, goalCalories: nextCalGoal });
        } catch (err) {
          console.warn("[Home] failed to save adaptive calorie goal:", err);
        }
      }

      if (aiLines && aiLines.length) {
        await saveCachedFeedback(dateKey, aiLines);
      }
      setLastFeedbackDate(dateKey);
      setFeedbackUnread(force);
    } catch (e) {
      console.error("[Home] refreshDailyFeedback error", e);
    } finally {
      setFeedbackLoading(false);
    }
  }, [selectedDate, locale, goal, steps, isPremium, settingsCache]);
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
  // ページ切り替え（0: データページ, 1: ストーリーページ）
  const [currentPage, setCurrentPage] = useState(0);
  const pageAnim = useRef(new Animated.Value(0)).current;
  const [weeklyData, setWeeklyData] = useState({}); // 週間データ { 'YYYY-MM-DD': { steps, calories } }
  const [monthlyData, setMonthlyData] = useState({}); // 月間データ { 'YYYY-MM-DD': { steps, calories } }
  const [allTimeData, setAllTimeData] = useState({}); // 全期間データ（トロフィー・ストリーク計算用）
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // activeTab removed - 常に歩数表示に固定
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

  // ジェスチャーヒント表示（初回〜3回のみ表示）
  const [showGestureHint, setShowGestureHint] = useState(false);
  const [notesMap, setNotesMap] = useState({}); // { 'YYYY-MM-DD': boolean } コメント有無のマップ
  const [hourlyTooltip, setHourlyTooltip] = useState({ index: -1, value: 0 });
  // タイマーは使わず、押下中のみ表示
  const hourlyTooltipTimerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [hourlyDetailTooltip, setHourlyDetailTooltip] = useState({
    visible: false,
    hour: -1,
  });
  const hourlyDetailTimerRef = useRef(null);
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

  // ジェスチャーヒント表示ロジック（フリップ3回で非表示）
  const gestureHintCountRef = useRef(0);
  const showGestureHintRef = useRef(false);

  useEffect(() => {
    const loadGestureHintCount = async () => {
      try {
        const countStr = await AsyncStorage.getItem(GESTURE_HINT_COUNT_KEY);
        const count = countStr ? parseInt(countStr, 10) : 0;
        gestureHintCountRef.current = count;
        const shouldShow = count < 3;
        showGestureHintRef.current = shouldShow;
        setShowGestureHint(shouldShow);
      } catch (e) {
        showGestureHintRef.current = true;
        setShowGestureHint(true);
      }
    };
    loadGestureHintCount();
  }, []);

  // フリップ時にカウントを増やす（refを使ってクロージャ問題を回避）
  const handleFlipChange = useCallback(async (flipped) => {
    setCurrentPage(flipped ? 1 : 0);

    // ヒント表示中ならカウントを増やす
    if (showGestureHintRef.current) {
      const newCount = gestureHintCountRef.current + 1;
      gestureHintCountRef.current = newCount;
      try {
        await AsyncStorage.setItem(GESTURE_HINT_COUNT_KEY, String(newCount));
      } catch (e) {
        // ignore
      }
      if (newCount >= 3) {
        showGestureHintRef.current = false;
        setShowGestureHint(false);
      }
    }
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

  // 週バー表示モードは常に歩数
  useEffect(() => {
    setWeeklyDisplayMode("steps");
  }, []);

  // 日付変更用のスワイプジェスチャー
  // ページ切り替えアニメーション
  const animateToPage = (targetPage) => {
    setCurrentPage(targetPage);
    Animated.spring(pageAnim, {
      toValue: targetPage,
      tension: 50,
      friction: 10,
      useNativeDriver: true,
    }).start();
    if (Haptics?.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  // 現在のページを参照用に保持
  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          // 画面端30px以内ではPanResponderを無効化（戻るジェスチャー優先）
          const touchX = evt.nativeEvent.pageX;
          const edgeThreshold = 30;
          if (touchX < edgeThreshold || touchX > width - edgeThreshold) {
            return false;
          }

          // 横方向のスワイプを検出
          const horizontalBias =
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
          return Math.abs(gestureState.dx) > 10 && horizontalBias;
        },
        onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
          const touchX = evt.nativeEvent.pageX;
          const edgeThreshold = 30;
          if (touchX < edgeThreshold || touchX > width - edgeThreshold) {
            return false;
          }
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2 && Math.abs(gestureState.dx) > 15;
        },
        onPanResponderGrant: () => {
          slideAnim.stopAnimation();
          slideAnim.setValue(0);
          setMainSwipeIndicator({ left: false, right: false });
        },
        onPanResponderMove: (evt, gestureState) => {
          // 1:1で指に追従（未来日への制限は抵抗感で表現）
          const base = selectedDateRef.current;
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          const isAtToday = base.toDateString() === today.toDateString();

          let dx = gestureState.dx;
          // 今日の場合、左スワイプ（未来へ）に抵抗感
          if (isAtToday && dx < 0) {
            dx = dx * 0.15;
          }
          slideAnim.setValue(dx);
        },
        onPanResponderRelease: (evt, gestureState) => {
          setMainSwipeIndicator({ left: false, right: false });
          const distThreshold = 50;
          const velocityThreshold = 0.4;
          const dx = gestureState.dx;
          const vx = gestureState.vx;

          // スワイプ方向: -1=右へ（前へ）, 1=左へ（次へ）
          let direction = 0;
          if (Math.abs(dx) > distThreshold) {
            direction = dx > 0 ? -1 : 1;
          } else if (Math.abs(vx) > velocityThreshold && Math.abs(dx) > 20) {
            direction = vx > 0 ? -1 : 1;
          }

          if (direction === 0) {
            // スワイプが不十分→元に戻す（バウンス効果）
            Animated.spring(slideAnim, {
              toValue: 0,
              tension: 120,
              friction: 8,
              useNativeDriver: true,
            }).start();
            return;
          }

          // スワイプで日付変更
          if (direction === -1) {
            tryChangeDate(-1);
          } else if (direction === 1) {
            tryChangeDate(1);
          }
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }).start();
        },
      }),
    [slideAnim, width, selectedDateRef, weekStartDateRef, Haptics, isPremium, navigation]
  );

  // 日付変更関数（スワイプ用）- スムーズアニメーション
  const tryChangeDate = async (direction) => {
    const base = selectedDateRef.current;
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + direction);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 未来日チェック
    if (candidate > todayEnd) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }).start();
      return;
    }

    // 歩数データの閲覧は無期限（履歴制限なし）

    // 現在位置からスライドアウト（スムーズ）
    const outTo = direction < 0 ? width : -width;
    Animated.timing(slideAnim, {
      toValue: outTo,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      // 週範囲チェック
      const oldWeekStart = weekStartDateRef.current;
      const weekEnd = new Date(oldWeekStart);
      weekEnd.setDate(oldWeekStart.getDate() + 6);
      if (candidate < oldWeekStart || candidate > weekEnd) {
        const day = candidate.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const newWeekStart = new Date(candidate);
        newWeekStart.setDate(candidate.getDate() + diff);
        newWeekStart.setHours(0, 0, 0, 0);
        setWeekStartDate(newWeekStart);
      }
      setSelectedDate(candidate);
      if (Haptics?.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      // 反対側からスライドイン
      slideAnim.setValue(direction < 0 ? -width : width);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start();
    });
  };

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

    // 歩数データの閲覧は無期限（履歴制限なし）

    // スライドアニメーション付きで日付変更（スムーズ）
    const outTo = direction < 0 ? width : -width;

    // スライドアウト
    Animated.timing(slideAnim, {
      toValue: outTo,
      duration: 180,
      easing: Easing.out(Easing.cubic),
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      // スライドイン（バウンス効果）
      slideAnim.setValue(direction < 0 ? -width : width);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 10,
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

  // カレンダー用の日付配列を生成（1ヶ月分: 過去21日 + 今日 + 未来7日）
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = [];
    // 過去21日
    for (let i = 21; i >= 1; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(date);
    }
    // 今日
    dates.push(new Date(today));
    // 未来7日
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    setCalendarDates(dates);

    // データを取得
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
  }, []);

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
    // カレンダーは無料で全期間アクセス可能

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
      const userProfile = await getUserProfile();
      if (cached) {
        const cachedSteps = cached.steps || 0;
        setSteps(cachedSteps);
        setCalories(cached.calories || calculateCalories(cachedSteps, userProfile.weight));
        // 距離がない場合は歩数から計算
        setDistance(cached.distance > 0 ? cached.distance : calculateDistance(cachedSteps, userProfile.stride));
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

      // 3. 時間別データの取得（キャッシュ → Swift → Pedometer）
      try {
        let hourlyData = await getHourlyStepsForDate(dateKey);
        const hasValidCache = hourlyData && hourlyData.some((v) => v > 0);
        console.log("[updateData] Cache check for", dateKey, "- hasData:", hasValidCache);

        if (!hasValidCache) {
          // キャッシュにデータがない場合、Swift/Pedometerで取得
          hourlyData = null;

          // Swift HealthKit（高速）
          if (HealthKitSwift && typeof HealthKitSwift.getHourlyStepsForDate === "function") {
            try {
              console.log("[updateData] Trying Swift HealthKit for", dateKey);
              const swiftHourly = await HealthKitSwift.getHourlyStepsForDate(dateKey);
              if (Array.isArray(swiftHourly) && swiftHourly.length === 24) {
                hourlyData = swiftHourly.map((v) => Number(v) || 0);
                const swiftTotal = hourlyData.reduce((a, b) => a + b, 0);
                console.log("[updateData] Swift hourly total:", swiftTotal);
              }
            } catch (swiftErr) {
              console.warn("[updateData] Swift failed:", swiftErr);
            }
          }

          // Pedometerフォールバック
          if (!hourlyData || !hourlyData.some((v) => v > 0)) {
            console.log("[updateData] Pedometer fallback for", dateKey);
            hourlyData = Array(24).fill(0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const targetDate = new Date(selectedDate);
            targetDate.setHours(0, 0, 0, 0);
            const isSelectedToday = targetDate.getTime() === today.getTime();
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
                const hourResult = await Pedometer.getStepCountAsync(hourStart, hourEnd);
                hourlyData[hour] = hourResult.steps;
              } catch (err) {
                // 個別エラーは無視
              }
            }
            const pedometerTotal = hourlyData.reduce((a, b) => a + b, 0);
            console.log("[updateData] Pedometer hourly total:", pedometerTotal);
          }

          // キャッシュに保存
          if (hourlyData && hourlyData.some((v) => v > 0)) {
            try {
              await saveHourlyStepsForDate(dateKey, hourlyData);
            } catch (_) {}
          }
        }

        setHourlySteps(hourlyData || Array(24).fill(0));

        // 天気情報の取得（キャッシュまたはAPI）
        // まずストレージから確認
        if (cached && cached.weather) {
          setWeather(cached.weather);
          // hourlyWeatherはストレージに保存していない場合が多いので、
          // 必要なら別途保存するか、APIから再取得する
          // ここでは簡易的にAPI取得を試みる（キャッシュが効くはず）
          const hourlyW = await fetchHourlyWeather(selectedDate);
          setHourlyWeather(hourlyW);
        } else {
          // データがない場合はAPIから取得
          const w = await fetchWeatherForLocation();
          setWeather(w);
          const hourlyW = await fetchHourlyWeather(selectedDate);
          setHourlyWeather(hourlyW);
        }
      } catch (e) {
        console.error("Error loading hourly data:", e);
      }

      // 歩数合計と時間帯データの整合を合わせる（差分は現在時刻に寄せる）
      try {
        const currentHour = new Date().getHours();
        if (!Array.isArray(hourlyData) || hourlyData.length !== 24) {
          const fresh = Array(24).fill(0);
          fresh[currentHour] = Math.max(0, steps);
          hourlyData = fresh;
          await saveHourlyStepsForDate(dateKey, fresh);
        } else {
          const hourlySum = hourlyData.reduce((a, b) => a + (b || 0), 0);
          const diff = steps - hourlySum;
          if (Math.abs(diff) > 1) {
            const adjusted = [...hourlyData];
            adjusted[currentHour] = Math.max(0, (adjusted[currentHour] || 0) + diff);
            hourlyData = adjusted;
            try {
              await saveHourlyStepsForDate(dateKey, adjusted);
            } catch (_) {}
          }
        }
      } catch (_) {}

      // カレンダーイベントを取得
      try {
        const events = await getEventsForDate(selectedDate);
        setTodayEvents(events);
      } catch (calendarError) {
        console.log("Calendar not available:", calendarError);
        setTodayEvents([]);
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
        const cacheTotal = cachedHourly ? cachedHourly.reduce((a, b) => a + b, 0) : 0;
        console.log("[HomeScreen] Cache check for", dateKey, "- total:", cacheTotal, "hasData:", cachedHourly && cachedHourly.some((val) => val > 0));

        if (cachedHourly && cachedHourly.some((val) => val > 0)) {
          // キャッシュがあり、データが入っている場合はそれを使う
          console.log("[HomeScreen] Using cached hourly data");
          setHourlySteps(cachedHourly);
        } else {
          // キャッシュがない場合、Swiftモジュールで高速取得を試みる
          let hourlyData = null;

          // 1. Swift HealthKit（一括取得・高速）
          if (HealthKitSwift && typeof HealthKitSwift.getHourlyStepsForDate === "function") {
            try {
              console.log("[HomeScreen] Trying Swift HealthKit for", dateKey);
              const swiftHourly = await HealthKitSwift.getHourlyStepsForDate(dateKey);
              if (Array.isArray(swiftHourly) && swiftHourly.length === 24) {
                hourlyData = swiftHourly.map((v) => Number(v) || 0);
                console.log("[HomeScreen] Hourly data from Swift:", hourlyData.reduce((a, b) => a + b, 0), "steps");
              } else {
                console.log("[HomeScreen] Swift returned invalid data:", swiftHourly?.length || "null");
              }
            } catch (swiftErr) {
              console.warn("[HomeScreen] Swift hourly fetch failed:", swiftErr);
            }
          } else {
            console.log("[HomeScreen] Swift HealthKit not available");
          }

          // 2. フォールバック: Pedometer（24回ループ・遅い）
          if (!hourlyData || !hourlyData.some((v) => v > 0)) {
            console.log("[HomeScreen] Pedometer fallback for hourly data, date:", dateKey);
            hourlyData = Array(24).fill(0);
            const isSelectedToday =
              currentSelected.toDateString() === today.toDateString();
            const maxHour = isSelectedToday ? new Date().getHours() : 23;
            for (let hour = 0; hour <= maxHour; hour++) {
              const hourStart = new Date(currentSelected);
              hourStart.setHours(hour, 0, 0, 0);
              const hourEnd = new Date(currentSelected);
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
            const totalFromPedometer = hourlyData.reduce((a, b) => a + b, 0);
            console.log("[HomeScreen] Pedometer hourly total:", totalFromPedometer, "steps");
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

    // 3秒後に強制的にローディング解除（フォールバック）
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
      console.log('[HomeScreen] Fallback: forced loading off');
    }, 3000);

    // バックグラウンドで最新データを取得
    loadData();
    if (!DISABLE_PEDOMETER_DEV) {
      setupPedometer();
    }
    initializeApp();

    // バックグラウンド通知タスクを登録（通知が有効な場合）
    (async () => {
      try {
        const settings = await getSettings();
        if (settings?.notifications) {
          const registered = await registerBackgroundStepsTask();
          console.log("[HomeScreen] Background task registered:", registered);
        }
      } catch (e) {
        console.warn("[HomeScreen] Failed to register background task:", e);
      }
    })();

    // 拡張インポート（31日〜365日）をバックグラウンドで実行
    // 初回ロード完了後に開始（5秒遅延でUIをブロックしない）
    const extendedImportTimer = setTimeout(async () => {
      try {
        const alreadyDone = await isExtendedImportCompleted();
        if (!alreadyDone) {
          console.log("[HomeScreen] Starting extended import (31-365 days)...");
          const result = await importExtendedHistoricalData((imported, total) => {
            console.log(`[HomeScreen] Extended import progress: ${imported}/${total}`);
          });
          console.log("[HomeScreen] Extended import result:", result);
        }
      } catch (e) {
        console.warn("[HomeScreen] Extended import failed:", e);
      }
    }, 5000);

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
      clearTimeout(extendedImportTimer);
      clearTimeout(fallbackTimer);
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
        setSettingsCache(s);
        // 注意: progressの再計算は useEffect([steps, goal]) に任せる
        // ここで計算すると steps のクロージャが古い値を参照してしまう
      };
      const reloadTrial = async () => {
        try {
          const state = await getTrialState();
          setTrialState(state);
        } catch (_) {
          setTrialState(null);
        }
      };
      reloadFavorites();
      reloadSettings();
      reloadTrial();
      loadFeedbackMessage(selectedDateRef.current || selectedDate);
    }, [loadFeedbackMessage, selectedDate])
  );

  const handleToggleFeedback = async () => {
    const next = !feedbackOpen;
    setFeedbackOpen(next);
    if (next) {
      setFeedbackUnread(false);
      if (!feedbackPlan || lastFeedbackDate !== toDateKeyLocal(selectedDate)) {
        await refreshDailyFeedback();
      }
    }
  };

  const applyRecommendedGoal = useCallback(async () => {
    if (!feedbackPlan?.recommendedGoal) return;
    const newGoal = feedbackPlan.recommendedGoal;
    const currentGoal = goal;
    if (newGoal === currentGoal) return;

    Alert.alert(
      "目標を更新しますか？",
      `今日の目標を ${formatSteps(currentGoal)} → ${formatSteps(newGoal)} に変更します。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "更新する",
          style: "default",
          onPress: async () => {
            setGoal(newGoal);
            try {
              const s = settingsCache || (await getSettings());
              const payload = {
                ...s,
                dailyGoal: newGoal,
              };
              await saveSettings(payload);
            } catch (e) {
              console.error("[Home] failed to save goal", e);
            }
          },
        },
      ]
    );
  }, [feedbackPlan?.recommendedGoal, goal, settingsCache]);

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

    setProfile(userProfile);
    setGoal(settings.dailyGoal);
    // カロリー目標を設定から反映（未設定時は500kcal）
    setGoalCalories(settings.goalCalories || 500);
    setFavorites(userFavorites.slice(0, 3));
    setCurrentGoalLevel(goalLevel);

    if (todayData) {
      setSteps(todayData.steps);
      setTodayStepsSnapshot(todayData.steps || 0);
      setCalories(todayData.calories);
      // 距離がない場合は歩数から再計算
      const dist = todayData.distance || calculateDistance(todayData.steps || 0, userProfile.stride || 72);
      setDistance(dist);
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

    // 🕒 時間別グラフもPedometer更新に合わせて当日分を補正
    try {
      const todayKey = getTodayDateString();
      const currentHour = new Date().getHours();
      let hourlyData = await getHourlyStepsForDate(todayKey);
      if (!Array.isArray(hourlyData) || hourlyData.length !== 24) {
        hourlyData = Array(24).fill(0);
      }
      const prevTotal = hourlyData.reduce((a, b) => a + (Number(b) || 0), 0);
      const diff = newSteps - prevTotal;
      if (diff !== 0) {
        const next = [...hourlyData];
        if (diff > 0) {
          next[currentHour] = Math.max(0, (Number(next[currentHour]) || 0) + diff);
          hourlyData = next;
        } else {
          // 減少（リセット等）が起きた場合は当時間帯に上書き
          const fresh = Array(24).fill(0);
          fresh[currentHour] = Math.max(0, newSteps);
          hourlyData = fresh;
        }
        await saveHourlyStepsForDate(todayKey, hourlyData);
        // 今日を表示中ならグラフも即時反映
        const currentSelected = selectedDateRef.current || selectedDate;
        const isViewingToday =
          currentSelected.toDateString() === new Date().toDateString();
        if (isViewingToday) {
          setHourlySteps(hourlyData);
        }
      }
    } catch (err) {
      console.warn("[HomeScreen] Failed to update hourly steps from pedometer:", err);
    }

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

      // Pro限定: 年間トップ3更新時の通知
      try {
        const topDays = await getTop3Days();
        await sendTop3RankingNotification(newSteps, topDays, isPremium);
      } catch (rankingErr) {
        console.log('Ranking notification check error:', rankingErr);
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

  const isStepGoalAchieved = progress >= 1.0;
  const progressColor = isStepGoalAchieved ? theme.success : theme.accent;

  // トロフィー・ストリーク計算（HealthKitから直接取得）
  useEffect(() => {
    const calculateStats = async () => {
      // キャッシュから読み込み
      const cached = await getStatsCache();
      if (cached) {
        setTotalTrophies(cached.totalTrophies);
        setCurrentStreak(cached.currentStreak);
        setMaxStreak(cached.maxStreak);
      }

      // HealthKitからデータを取得して計算
      setIsCalculatingStats(true);
      try {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const start = new Date(today);
        start.setDate(today.getDate() - 364); // 1年分
        start.setHours(0, 0, 0, 0);

        const list = await getStepsInRange(start, today);
        if (!Array.isArray(list) || list.length === 0) {
          setIsCalculatingStats(false);
          return;
        }

        // 今日の日付
        const todayStr = getTodayDateString();

        // 今日のデータはPedometer（todayStepsSnapshot）を使用
        const mergedList = list.map(it => {
          if (it?.date === todayStr) {
            return { ...it, steps: todayStepsSnapshot };
          }
          return it;
        });
        // 今日のデータがなければ追加
        if (!mergedList.find(it => it?.date === todayStr)) {
          mergedList.push({ date: todayStr, steps: todayStepsSnapshot });
        }

        // トロフィー数（達成日数）
        const trophies = mergedList.reduce(
          (acc, it) => acc + (Number(it?.steps || 0) >= goal ? 1 : 0),
          0
        );

        // 日付順にソート
        const sorted = [...mergedList].sort((a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // 最大ストリーク
        let maxS = 0;
        let run = 0;
        for (const it of sorted) {
          if (Number(it?.steps || 0) >= goal) {
            run += 1;
            if (run > maxS) maxS = run;
          } else {
            run = 0;
          }
        }

        // 現在ストリーク（今日から遡る）
        const todayAchieved = todayStepsSnapshot >= goal;

        // 降順ソート（最新から過去へ）
        const descSorted = [...mergedList].sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        let currentS = 0;
        let startIdx = 0;
        // 今日未達成なら昨日から開始
        if (!todayAchieved && descSorted.length > 0 && descSorted[0]?.date === todayStr) {
          startIdx = 1;
        }
        for (let i = startIdx; i < descSorted.length; i++) {
          if (Number(descSorted[i]?.steps || 0) >= goal) {
            currentS += 1;
          } else {
            break;
          }
        }

        setTotalTrophies(trophies);
        setCurrentStreak(currentS);
        setMaxStreak(maxS);
        saveStatsCache(trophies, currentS, maxS);
      } catch (error) {
        console.error('Error calculating stats from HealthKit:', error);
      }
      setIsCalculatingStats(false);
    };

    calculateStats();
  }, [todayStepsSnapshot, goal]);

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
    const near = isSelectedToday && progress >= 0.8 && progress < 1.0;

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
  }, [progress, selectedDate]);

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
    <ScreenContainer scroll={false} style={{ backgroundColor: theme.background }}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        scrollEventThrottle={16}
      >
        {/* センサー未対応バナーは表示しない（UI簡素化） */}
        {/* 週のナビゲーション */}
        <View style={[styles.dateNavigation, { paddingTop: insets.top + 20 }]}>
          {/* トロフィー数とストリーク（縦2行） */}
          <View
            style={{ position: "absolute", left: 20, top: insets.top + 12 }}
          >
            {/* Free/Pro Badge - Subtle & Clickable */}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isPremium ? 'rgba(255,215,0,0.15)' : 'rgba(0,0,0,0.05)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                alignSelf: 'flex-start',
                marginBottom: 4
              }}
              onPress={() => {
                if (!isPremium) {
                  presentPaywall();
                }
              }}
              activeOpacity={isPremium ? 1 : 0.7}
            >
              <Text style={{
                fontSize: 10,
                fontWeight: '700',
                color: isPremium ? '#DAA520' : theme.text,
                opacity: isPremium ? 1 : 0.7,
                letterSpacing: 0.5
              }}>
                {isPremium ? 'PRO' : 'FREE'}
              </Text>
              {!isPremium && (
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.text, opacity: 0.4, marginLeft: 2 }}>
                  {'>'}
                </Text>
              )}
            </TouchableOpacity>

            <HeaderStats
              totalTrophies={totalTrophies}
              currentStreak={currentStreak}
              isCalculating={isCalculatingStats}
              theme={theme}
            />
            {/* Weather Summary Badge Removed */}
          </View>

      </View>

        {/* 日付テキスト（タップでカレンダーを開く）- 週カレンダーの上に配置 */}
        <TouchableOpacity
          onPress={() => {
            setShowCalendarModal(true);
            loadMonthlyData(calendarMonth);
          }}
          style={styles.dateLabelContainer}
          hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
        >
          <Text style={[styles.dateText, { color: theme.text }]}>
            {formatMonthDayHelper(selectedDate, locale)}
          </Text>
        </TouchableOpacity>

        <View style={[styles.topIconRow, { top: insets.top + 30 }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("home.a11y.openFeedback")}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            style={[styles.mailIconButton, { backgroundColor: theme.card }]}
            onPress={handleToggleFeedback}
          >
            <MaterialCommunityIcons name="email-outline" size={22} color={theme.text} />
            {feedbackUnread && (
              <View style={[styles.badgeDot, { backgroundColor: theme.primary }]} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("home.a11y.openCalendar")}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            style={[
              styles.calendarIconButton,
              { backgroundColor: theme.card, position: "relative", right: 0, top: 0 },
            ]}
            onPress={() => {
              setShowCalendarModal(true);
              loadMonthlyData(calendarMonth); // モーダルを開く時に当月データを取得
            }}
          >
            <CalendarIcon color={theme.text} size={24} />
          </TouchableOpacity>
        </View>

        {/* インライン通知は非表示 */}

        {feedbackOpen && (
          <View
            style={[
              styles.feedbackDrawer,
              {
                top: insets.top + 72,
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
              <View style={styles.feedbackDrawerHeader}>
                <Text style={[styles.feedbackTitle, { color: theme.text }]}>
                  {t("home.feedback.title")}
                </Text>
              <View style={[styles.aiBadge, { borderColor: theme.border }]}>
                <MaterialCommunityIcons name="star-four-points" size={14} color={theme.accent} />
                <Text style={[styles.aiBadgeText, { color: theme.textSecondary }]}>AI</Text>
              </View>
                <TouchableOpacity
                  style={styles.feedbackRefreshButton}
                  onPress={() => refreshDailyFeedback(true)}
                disabled={feedbackLoading}
              >
                {feedbackLoading ? (
                  <ActivityIndicator size="small" color={theme.text} />
                ) : (
                  <Text style={[styles.feedbackRefreshText, { color: theme.textSecondary }]}>
                    {t("home.feedback.refresh")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {feedbackPlan?.restDay && (
              <View style={[styles.restBadge, { backgroundColor: `${theme.accent}20` }]}>
                <Text style={[styles.restBadgeText, { color: theme.accent }]}>
                  今日は調整日
                </Text>
              </View>
            )}

                {feedbackPlan?.lines?.length ? (
                  feedbackPlan.lines.map((line, idx) => {
                    const anim = feedbackLineAnims[idx] || new Animated.Value(1);
                    return (
                      <Animated.Text
                        key={`fline-${idx}`}
                        style={[
                          styles.feedbackLine,
                          {
                            color: theme.text,
                            opacity: anim,
                            transform: [
                              {
                                translateY: anim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [6, 0],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        {line}
                      </Animated.Text>
                    );
                  })
                ) : (
              <Text style={[styles.feedbackLine, { color: theme.textSecondary }]}>
                生成中です…
              </Text>
            )}

            {feedbackPlan?.recommendedGoal && isSelectedToday && (
              <TouchableOpacity
                style={[styles.feedbackApplyButton, { backgroundColor: theme.primary }]}
                onPress={applyRecommendedGoal}
              >
                <Text style={styles.feedbackApplyText}>この目標に更新する</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 週の操作ボタン群は削除（上部に重複する今日へをなくす） */}

        {/* 横スクロールカレンダー */}
        <WeekCalendar
          theme={theme}
          t={t}
          styles={styles}
          calendarDates={calendarDates}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onUpgrade={presentPaywall}
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

        {/* 今日へ戻るチップ + ページインジケーター */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 6,
          paddingHorizontal: 20,
          zIndex: 10,
        }}>
          {/* ページインジケーター（左） */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setCurrentPage(0)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 14,
                backgroundColor: currentPage === 0 ? theme.primary : 'transparent',
              }}
            >
              <MaterialCommunityIcons
                name="shoe-print"
                size={14}
                color={currentPage === 0 ? '#FFF' : theme.textSecondary}
              />
              {currentPage === 0 && (
                <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                  {t('home.tabs.steps')}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCurrentPage(1)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 14,
                backgroundColor: currentPage === 1 ? theme.primary : 'transparent',
              }}
            >
              <MaterialCommunityIcons
                name="notebook-outline"
                size={14}
                color={currentPage === 1 ? '#FFF' : theme.textSecondary}
              />
              {currentPage === 1 && (
                <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                  {t('home.tabs.diary')}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* 記録ボタン + 今日へ戻るボタン（右） */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ShareCTA
              selectedDate={selectedDate}
              steps={steps}
              goal={goal}
              navigation={navigation}
              theme={theme}
              t={t}
            />
            {!isToday(selectedDate) && (
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
                }}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: "700" }}>
                  {t("home.backToToday")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* スワイプ可能なメインコンテンツエリア */}
            <Animated.View
              {...panResponder.panHandlers}
              style={{
                transform: [{ translateX: slideAnim }],
                position: "relative",
                zIndex: 5,
              }}
            >
              {/* フリップ可能なデータカード（タブとフリップ連動） */}
              <ScrollView
                style={{ flex: 1, width: width }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
              >
                {/* トライアル関連UIは非表示 */}

                <DataFlipCard
                  theme={theme}
              t={t}
              selectedDate={selectedDate}
              steps={steps}
              calories={calories}
              distance={distance}
              goalCalories={goalCalories}
              progress={progress}
              caloriesProgress={caloriesProgress}
              hourlySteps={hourlySteps}
              hourlyWeather={hourlyWeather}
              profile={profile}
              bumpAnim={bumpAnim}
              pulseAnim={pulseAnim}
              isToday={isToday}
              formatMonthDay={formatMonthDay}
              formatNumber={formatNumber}
              clamp01={clamp01}
              setChartWidth={setChartWidth}
              todayEvents={todayEvents}
              isFlipped={currentPage === 1}
              onFlipChange={handleFlipChange}
              showGestureHint={showGestureHint}
            />
          </ScrollView>
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
            // 選択した日付の週の月曜日を計算
            const day = date.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            const monday = new Date(date);
            monday.setDate(date.getDate() + diff);
            monday.setHours(0, 0, 0, 0);
            setWeekStartDate(monday);

            // calendarDatesを選択日を中心に再生成（±14日）
            const newDates = [];
            for (let i = 14; i >= 1; i--) {
              const d = new Date(date);
              d.setDate(date.getDate() - i);
              newDates.push(d);
            }
            newDates.push(new Date(date)); // 選択日
            for (let i = 1; i <= 14; i++) {
              const d = new Date(date);
              d.setDate(date.getDate() + i);
              newDates.push(d);
            }
            setCalendarDates(newDates);
            loadWeeklyData(newDates);

            setSelectedDate(date);
            setShowCalendarModal(false);
          }}
          onUpgrade={() => {
            setShowCalendarModal(false);
            presentPaywall();
          }}
        />
      </ScrollView>
    </ScreenContainer>
  );
}
