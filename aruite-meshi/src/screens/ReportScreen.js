import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  FlatList,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getTheme } from '../utils/theme';
import { getStepsInRange } from '../utils/healthKit';
import { calculateCalories, toDateKeyLocal, formatDateSlash } from '../utils/calculations';
import { getUserProfile, getMultipleDaysData, getSettings } from '../utils/storage';
import { LinearGradient } from 'expo-linear-gradient';
import PaperTexture from '../components/PaperTexture';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useI18n } from '../i18n/I18nProvider';
import { generateWeeklyAIInsight, generateMonthlyAIStyle } from '../utils/aiFeedback';
import { fetchHourlyWeather } from '../utils/weather';
import RadarChart from '../components/RadarChart';
// AI機能追加時に有効化
// import RadarChart from '../components/RadarChart';
// import { calculateWalkingDna, DNA_PARAMS } from '../utils/walkingDna';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

// 日本の主要距離の換算
const DISTANCE_LANDMARKS = [
  // ラスボス枠（年単位）
  { km: 40000, key: 'aroundEarth' },
  { km: 20000, key: 'halfEarth' },
  { km: 18000, key: 'eurasianCrossing' },
  // 超中期（5000-10000km）
  { km: 9200, key: 'transSiberian' },
  { km: 8850, key: 'greatWall' },
  { km: 6600, key: 'nileRiver' },
  { km: 6400, key: 'amazonRiver' },
  // 達成したら気持ちいい（3000-5000km）
  { km: 5000, key: 'newZealandX2' },
  { km: 4200, key: 'mediterraneanCoast' },
  { km: 3944, key: 'route66' },
  // 初年度達成ゾーン（2000-3000km）
  { km: 2900, key: 'tokyoHongKong' },
  { km: 2500, key: 'europeJourney' },
  { km: 2050, key: 'nyMiami' },
  { km: 2000, key: 'route66Half' },
  // 2-3ヶ月（1200-2000km）
  { km: 1700, key: 'taiwanX2' },
  { km: 1150, key: 'tokyoSapporo' },
  // 1-2ヶ月（600-1000km）
  { km: 1000, key: 'hawaiiIslands' },
  { km: 950, key: 'tokyoFukuoka' },
  { km: 800, key: 'caminoDeSantiago' },
  { km: 685, key: 'romeParis' },
  // 1ヶ月達成圏（300-500km）
  { km: 500, key: 'tokyoOsaka' },
  { km: 480, key: 'greatOceanRoad' },
  { km: 400, key: 'grandCanyon' },
  { km: 340, key: 'parisLondon' },
  { km: 300, key: 'nazcaLines' },
];

const COLORS = {
  teal: '#00A896',
  orange: '#FF6B35',
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  textDark: '#2D3142',
  textGray: '#9CA5B5',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ReportScreen() {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isPremium, presentPaywall } = useSubscription();
  const { t, locale } = useI18n();
  const personalBestListRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSteps: 0,
    totalDistance: 0,
    totalCalories: 0,
    topDays: [], // [{date, steps}, ...]
    weeklyPattern: [0, 0, 0, 0, 0, 0, 0], // Mon-Sun
  });
  const [currentBestIndex, setCurrentBestIndex] = useState(0);

  // Environment Analysis State
  const [envAnalysis, setEnvAnalysis] = useState({
    bestTemp: null,           // 最適気温
    bestTempRange: null,      // 最適気温範囲 (e.g., "15°C - 20°C")
    tempTitle: null,          // 称号 (e.g., "季節の狩人")
    tempZones: [0, 0, 0, 0, 0], // 極寒, 寒い, 快適, 暑い, 猛暑
    sunnyAvg: 0,              // 晴れの日平均歩数
    rainyAvg: 0,              // 雨の日平均歩数
    rainyHero: null,          // 雨の日達成 { date, steps }
    hasEnoughData: false,     // 分析に十分なデータがあるか
    dataCount: 0,             // 分析に使用したデータ数
  });

  // タップで表示する選択状態
  const [selectedWeekday, setSelectedWeekday] = useState(null);
  const [selectedTempZone, setSelectedTempZone] = useState(null);
  const [dataDaysCount, setDataDaysCount] = useState(0); // 総データ日数
  const [showJourneyModal, setShowJourneyModal] = useState(false); // Journey詳細モーダル

  // Walking DNA State
  const [walkingDna, setWalkingDna] = useState({
    params: null,
    title: null,
    description: null,
    firstParam: null,
    secondParam: null,
    hasEnoughData: false,
    dataCount: 0,
  });
  const [weeklySummary, setWeeklySummary] = useState({
    ready: false,
    total: 0,
    average: 0,
    achievedRate: 0,
    achievedDays: 0,
    bestDay: null,
    trendPct: null,
    insights: [],
    aiInsights: [],
  });
  const [weeklyInsightAnims, setWeeklyInsightAnims] = useState([]);
  const weeklyInsightLines =
    (weeklySummary.aiInsights && weeklySummary.aiInsights.length > 0)
      ? weeklySummary.aiInsights
      : weeklySummary.insights;
  const [monthlySummary, setMonthlySummary] = useState({
    ready: false,
    type: 'Loading...',
    insights: [],
    aiInsights: [],
    radarParams: null,
  });
  const [monthlyInsightAnims, setMonthlyInsightAnims] = useState([]);

  useEffect(() => {
    const anims = weeklyInsightLines.map(() => new Animated.Value(0));
    setWeeklyInsightAnims(anims);
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
  }, [weeklyInsightLines]);

  useEffect(() => {
    const anims = (monthlySummary.aiInsights && monthlySummary.aiInsights.length > 0
      ? monthlySummary.aiInsights
      : monthlySummary.insights || []
    ).map(() => new Animated.Value(0));
    setMonthlyInsightAnims(anims);
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
  }, [monthlySummary]);

  useEffect(() => {
    loadAllTimeStats();
    loadEnvironmentAnalysis();
    loadWeeklySummary();
    loadMonthlyStyle();
    // loadWalkingDna(); // AI機能追加時に有効化
  }, []);

  // Walking DNA データをロード - AI機能追加時に有効化
  // const loadWalkingDna = async () => {
  //   try {
  //     const result = await calculateWalkingDna();
  //     setWalkingDna(result);
  //   } catch (error) {
  //     console.error('Error loading Walking DNA:', error);
  //   }
  // };

  // 環境分析データをロード
  const loadEnvironmentAnalysis = async () => {
    try {
      const todayKey = toDateKeyLocal(new Date());
      const cached = await AsyncStorage.getItem(`envAnalysis:${todayKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.dateKey === todayKey && parsed.data) {
          setEnvAnalysis(parsed.data);
          return;
        }
      }

      // 過去92日分の日付キーを生成
      const dateKeys = [];
      const today = new Date();
      for (let i = 0; i < 92; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        dateKeys.push(toDateKeyLocal(date));
      }

      // ストレージからデータを取得
      const dailyDataArray = await getMultipleDaysData(dateKeys);
      const settings = await getSettings();
      const dailyGoal = settings?.dailyGoal || 10000;

      // 天気・気温データを持つ日だけフィルタ
      const daysWithWeather = dailyDataArray.filter(
        d => d && d.weather && d.weather.maxTemp !== undefined && d.steps > 0
      );

      if (daysWithWeather.length < 7) {
        // データ不足
        setEnvAnalysis(prev => ({ ...prev, hasEnoughData: false }));
        return;
      }

      // 気温ゾーン別集計 (平均気温を使用)
      const tempZoneTotals = [0, 0, 0, 0, 0]; // 極寒, 寒い, 快適, 暑い, 猛暑
      const tempZoneCounts = [0, 0, 0, 0, 0];
      const tempStepsMap = {}; // 気温 -> [歩数配列]

      // 天気別集計
      let sunnyTotalSteps = 0, sunnyCount = 0;
      let rainyTotalSteps = 0, rainyCount = 0;
      let rainyHeroData = null;

      for (const day of daysWithWeather) {
        const avgTemp = (day.weather.maxTemp + day.weather.minTemp) / 2;
        const steps = day.steps || 0;
        const weatherCode = day.weather.code;
        const dateKey = day.date;

        // 気温ゾーン分類
        let zoneIndex = 2; // デフォルト: 快適
        if (avgTemp < 5) zoneIndex = 0;        // 極寒
        else if (avgTemp < 15) zoneIndex = 1;  // 寒い
        else if (avgTemp < 25) zoneIndex = 2;  // 快適
        else if (avgTemp < 30) zoneIndex = 3;  // 暑い
        else zoneIndex = 4;                     // 猛暑

        tempZoneTotals[zoneIndex] += steps;
        tempZoneCounts[zoneIndex] += 1;

        // 気温ごとの歩数記録 (5度刻み)
        const tempKey = Math.round(avgTemp / 5) * 5;
        if (!tempStepsMap[tempKey]) tempStepsMap[tempKey] = [];
        tempStepsMap[tempKey].push(steps);

        // 天気別集計 (Homeの時間別天気と整合: 時間別に雨コードがあれば雨扱い)
        let hourlyHasRain = false;
        let isRainy = weatherCode >= 61; // drizzle(51-57)は除外し、雨・雷雨中心に
        if (dateKey) {
          try {
            const hourlyCodes = await fetchHourlyWeather(dateKey);
            if (Array.isArray(hourlyCodes)) {
              if (dateKey === '2025-10-31') {
                console.log('[RainyHero][debug] hourly weather codes for', dateKey, hourlyCodes);
              }
              const rainyHours = hourlyCodes.filter((code) => Number(code) >= 61).length;
              // しっかり雨だったとみなす基準（3時間以上）
              hourlyHasRain = rainyHours >= 3;
              // RainyHeroは「日次コードが雨 or 時間別に雨がある」かつ「雨時間が閾値以上」のときのみ
              isRainy = (weatherCode >= 61 || hourlyHasRain) && hourlyHasRain;
            }
          } catch (err) {
            console.warn('[RainyHero] hourly weather fetch failed:', err?.message || err);
          }
        }
        if (isRainy) {
          rainyTotalSteps += steps;
          rainyCount += 1;
          // 雨の日にゴール達成したらヒーロー
          if (steps >= dailyGoal && (!rainyHeroData || steps > rainyHeroData.steps)) {
            rainyHeroData = { date: day.date, steps, weatherCode };
            console.log('[RainyHero] Found:', day.date, 'code:', weatherCode, 'steps:', steps);
          }
        } else {
          sunnyTotalSteps += steps;
          sunnyCount += 1;
        }
      }

      // ゾーン別平均
      const tempZoneAvgs = tempZoneTotals.map((total, i) =>
        tempZoneCounts[i] > 0 ? Math.round(total / tempZoneCounts[i]) : 0
      );

      // 最適気温ゾーンを決定（サンプルがあるゾーンのうち最大平均を採用）
      const zoneMidTemps = [2, 10, 20, 27, 33]; // 各ゾーンの中心目安
      let bestTempKey = null;
      let bestTempAvg = 0;
      tempZoneAvgs.forEach((avg, idx) => {
        if (tempZoneCounts[idx] > 0 && avg > bestTempAvg) {
          bestTempAvg = avg;
          bestTempKey = zoneMidTemps[idx];
        }
      });

      // 称号を決定
      let tempTitle = '🌿 All-Season';
      if (bestTempKey !== null) {
        if (bestTempKey <= 10) tempTitle = '❄️ Winter Pro';
        else if (bestTempKey >= 25) tempTitle = '🔥 Summer Pro';
      }

      const newAnalysis = {
        bestTemp: bestTempKey,
        bestTempRange: bestTempKey !== null ? `${bestTempKey - 2}°C - ${bestTempKey + 3}°C` : null,
        tempTitle,
        tempZones: tempZoneAvgs,
        sunnyAvg: sunnyCount > 0 ? Math.round(sunnyTotalSteps / sunnyCount) : 0,
        rainyAvg: rainyCount > 0 ? Math.round(rainyTotalSteps / rainyCount) : 0,
        rainyHero: rainyHeroData,
        hasEnoughData: true,
        dataCount: daysWithWeather.length,
        dateKey: todayKey,
      };
      setEnvAnalysis(newAnalysis);
      await AsyncStorage.setItem(`envAnalysis:${todayKey}`, JSON.stringify({ dateKey: todayKey, data: newAnalysis }));

    } catch (error) {
      console.error('Error loading environment analysis:', error);
    }
  };

  // 先月のスタイル診断
  const loadMonthlyStyle = async () => {
    try {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);

      const dateKeys = [];
      const cursor = new Date(start);
      while (cursor <= end) {
        dateKeys.push(toDateKeyLocal(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      const dataArr = await getMultipleDaysData(dateKeys);
      const settings = await getSettings();
      const dailyGoal = settings?.dailyGoal || 10000;
      const goalThreshold = dailyGoal * 0.95;

      let total = 0;
      let achieved = 0;
      let morning = 0, evening = 0, midday = 0;
      let weekdayTotal = 0, weekdayCount = 0, weekendTotal = 0, weekendCount = 0;
      let sunnyTotal = 0, sunnyCount = 0, rainyTotal = 0, rainyCount = 0;

      dataArr.forEach((d, idx) => {
        const steps = d?.steps || 0;
        total += steps;
        if (steps >= goalThreshold) achieved += 1;
        const dateStr = dateKeys[idx];
        const day = new Date(dateStr).getDay();
        if (day === 0 || day === 6) {
          weekendTotal += steps; weekendCount += 1;
        } else {
          weekdayTotal += steps; weekdayCount += 1;
        }
        const hourly = d?.hourlySteps || [];
        for (let h = 0; h < hourly.length; h++) {
          const val = hourly[h] || 0;
          if (h >= 5 && h < 10) morning += val;
          if (h >= 10 && h < 17) midday += val;
          if (h >= 17 && h < 23) evening += val;
        }
        if (d?.weather?.code !== undefined) {
          const code = d.weather.code;
          const isRainy = code >= 51;
          if (isRainy) {
            rainyTotal += steps; rainyCount += 1;
          } else {
            sunnyTotal += steps; sunnyCount += 1;
          }
        }
      });

      const daysCount = dataArr.length || 1;
      const average = Math.round(total / daysCount);
      const achievedRate = daysCount ? Math.round((achieved / daysCount) * 100) : 0;
      const bestMonthly = dataArr.reduce(
        (acc, cur, idx) => {
          const steps = cur?.steps || 0;
          if (steps > acc.steps) return { steps, date: dateKeys[idx] };
          return acc;
        },
        { steps: 0, date: null }
      );

      // 型判定
      let type = t('report.monthly.types.balance');
      if (morning > evening * 1.2 && morning > midday * 1.1) type = t('report.monthly.types.morning');
      else if (evening > morning * 1.2 && evening > midday * 1.1) type = t('report.monthly.types.night');
      else if (weekendTotal > weekdayTotal * 1.2) type = t('report.monthly.types.weekend');
      else if (weekdayTotal > weekendTotal * 1.2) type = t('report.monthly.types.weekday');
      else if (sunnyTotal > rainyTotal * 1.5 && sunnyCount > 3) type = t('report.monthly.types.sunny');

      const insights = [];
      insights.push(`先月は合計${formatNumber(total)}歩、平均${formatNumber(average)}歩/日。`);
      insights.push(`達成率は${achievedRate}%でした。`);
      if (type === t('report.monthly.types.morning')) {
        insights.push(t('report.monthly.insights.morning1'));
        insights.push(t('report.monthly.insights.morning2'));
      } else if (type === t('report.monthly.types.night')) {
        insights.push(t('report.monthly.insights.night1'));
        insights.push(t('report.monthly.insights.night2'));
      } else if (type === t('report.monthly.types.weekend')) {
        insights.push(t('report.monthly.insights.weekend1'));
        insights.push(t('report.monthly.insights.weekend2'));
      } else if (type === t('report.monthly.types.weekday')) {
        insights.push(t('report.monthly.insights.weekday1'));
        insights.push(t('report.monthly.insights.weekday2'));
      } else if (type === t('report.monthly.types.sunny')) {
        insights.push(t('report.monthly.insights.sunny1'));
        insights.push(t('report.monthly.insights.sunny2'));
      } else {
        insights.push(t('report.monthly.insights.balance1'));
        insights.push(t('report.monthly.insights.balance2'));
      }

      const totalStepsAll = total || 1;
      const morningScore = Math.min(100, Math.round((morning / totalStepsAll) * 200));
      const nightScore = Math.min(100, Math.round((evening / totalStepsAll) * 200));
      const burstScore = Math.min(
        100,
        Math.round((bestMonthly?.steps ? bestMonthly.steps / Math.max(average, 1) : 1) * 50)
      );
      const keepScore = Math.min(100, achievedRate);
      const weekendShare = Math.min(1, weekendTotal / Math.max(totalStepsAll, 1));
      const weekendScore = Math.round(weekendShare * 200);
      const powerScore = Math.min(100, Math.round((average / Math.max(dailyGoal, 1)) * 100));

      const radarParams = {
        morning: morningScore || 0,
        night: nightScore || 0,
        burst: burstScore || 0,
        keep: keepScore || 0,
        weekend: weekendScore || 0,
        power: powerScore || 0,
      };

      let aiInsights = null;
      try {
        aiInsights = await generateMonthlyAIStyle({
          locale: locale || 'ja',
          summary: {
            type,
            total,
            average,
            achievedRate,
            bestWindow: morning > evening ? 'morning' : 'evening',
            weekdayVsWeekend: { weekdayTotal, weekendTotal },
            weatherBias: { sunnyTotal, rainyTotal },
          },
        });
      } catch (e) {
        console.warn('[Report] monthly AI insight skipped', e?.message || e);
      }

      setMonthlySummary({
        ready: true,
        type,
        insights,
        aiInsights: aiInsights || [],
        radarParams,
      });
    } catch (e) {
      console.error('Error loading monthly style', e);
      setMonthlySummary({ ready: false, type: 'Error', insights: [], aiInsights: [] });
    }
  };
  // 直近7日のサマリーと簡易インサイト
  const loadWeeklySummary = async () => {
    try {
      const settings = await getSettings();
      const dailyGoal = settings?.dailyGoal || 10000;
      const goalThreshold = dailyGoal * 0.95;

      const today = new Date();
      const dateKeys = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dateKeys.push(toDateKeyLocal(d));
      }

      const dataArr = await getMultipleDaysData(dateKeys);
      const last7 = dataArr.slice(0, 7);
      const prev7 = dataArr.slice(7, 14);

      const summarize = (arr) => {
        const stepsList = arr.map((d) => d?.steps || 0);
      const total = stepsList.reduce((a, b) => a + b, 0);
      const achieved = stepsList.filter((s) => s >= goalThreshold).length;
      const bestIdx = stepsList.length > 0 ? stepsList.indexOf(Math.max(...stepsList)) : -1;
      const best = bestIdx >= 0 ? { date: dateKeys[bestIdx], steps: stepsList[bestIdx] } : null;
        const weekdayVsWeekend = stepsList.reduce(
          (acc, steps, idx) => {
            const date = new Date(dateKeys[idx]);
            const day = date.getDay(); // 0 Sunday
            if (day === 0 || day === 6) {
              acc.weekend.total += steps;
              acc.weekend.count += 1;
            } else {
              acc.weekday.total += steps;
              acc.weekday.count += 1;
            }
            return acc;
          },
          { weekend: { total: 0, count: 0 }, weekday: { total: 0, count: 0 } }
        );
        return { total, achieved, best, weekdayVsWeekend };
      };

      const last = summarize(last7);
      const prev = summarize(prev7);

      const avg = Math.round(last.total / Math.max(last7.length, 1));
      const achievedRate = last7.length ? Math.round((last.achieved / last7.length) * 100) : 0;
      const trendPct = prev.total > 0 ? Math.round(((last.total - prev.total) / prev.total) * 100) : null;

      const insights = [];
      if (achievedRate >= 60) {
        insights.push('達成率は良好です。このペースを維持しましょう。');
      } else {
        insights.push('達成率がやや低め。今日は短い散歩からリズムを戻しましょう。');
      }
      if (last.best?.steps) {
        insights.push(`ベストデイは ${formatDate(last.best.date, locale)} に ${formatNumber(last.best.steps)} ${t('report.common.steps')}でした。`);
      }
      const wk = last.weekdayVsWeekend;
      const weekdayAvg = wk.weekday.count ? Math.round(wk.weekday.total / wk.weekday.count) : 0;
      const weekendAvg = wk.weekend.count ? Math.round(wk.weekend.total / wk.weekend.count) : 0;
      if (weekdayAvg && weekendAvg) {
        if (weekendAvg > weekdayAvg * 1.1) {
          insights.push('週末の方が歩きやすい傾向です。週末に多めに歩いてカバーしましょう。');
        } else if (weekdayAvg > weekendAvg * 1.1) {
          insights.push('平日の方が歩けています。週末は短時間でも歩くスロットを決めておきましょう。');
        }
      }
      if (trendPct !== null) {
        insights.push(`先週比で${trendPct >= 0 ? '+' : ''}${trendPct}%の変化です。`);
      }

      let aiInsights = null;
      try {
        aiInsights = await generateWeeklyAIInsight({
          locale: locale || 'ja',
          summary: {
            total: last.total,
            average: avg,
            achievedRate,
            achievedDays: last.achieved,
            trendPct,
            bestDay: last.best,
          },
        });
      } catch (e) {
        console.warn('[Report] weekly AI insight skipped', e?.message || e);
      }

      setWeeklySummary({
        ready: true,
        total: last.total,
        average: avg,
        achievedRate,
        achievedDays: last.achieved,
        bestDay: last.best,
        trendPct,
        insights,
        aiInsights: aiInsights || [],
      });
    } catch (e) {
      console.error('Error loading weekly summary', e);
      setWeeklySummary((prev) => ({ ...prev, ready: false }));
    }
  };

  const loadAllTimeStats = async () => {
    try {
      setIsLoading(true);

      // ユーザープロフィールからカロリー計算用の体重を取得
      const userProfile = await getUserProfile();
      const weight = Number(userProfile?.weight) || 65;

      // 過去1年分のデータを取得（全期間データは重すぎる可能性があるため）
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);

      const dailyData = await getStepsInRange(startDate, endDate);

      if (!dailyData || dailyData.length === 0) {
        setIsLoading(false);
        return;
      }

      // 統計計算
      let totalSteps = 0;
      let totalCalories = 0;
      const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
      const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
      const daysWithSteps = [];

      dailyData.forEach(day => {
        const steps = day.steps || 0;
        totalSteps += steps;
        // 歩数からカロリーを計算（day.caloriesは存在しないため）
        totalCalories += calculateCalories(steps, weight);

        if (steps > 0) {
          const date = new Date(day.date);
          let dayOfWeek = date.getDay() - 1; // 0=Sun, 1=Mon...
          if (dayOfWeek < 0) dayOfWeek = 6; // Sunday -> 6

          weekdayTotals[dayOfWeek] += steps;
          weekdayCounts[dayOfWeek] += 1;

          daysWithSteps.push({
            date: day.date,
            steps: steps,
          });
        }
      });

      // 曜日別平均
      const weeklyPattern = weekdayTotals.map((total, i) =>
        weekdayCounts[i] > 0 ? Math.round(total / weekdayCounts[i]) : 0
      );

      // トップ3の日を取得
      daysWithSteps.sort((a, b) => b.steps - a.steps);
      const topDays = daysWithSteps.slice(0, 3);

      // 距離計算（歩幅0.7m想定）
      const totalDistance = (totalSteps * 0.7) / 1000;

      setStats({
        totalSteps,
        totalDistance,
        totalCalories,
        topDays,
        weeklyPattern,
      });
      setDataDaysCount(daysWithSteps.length);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return num.toLocaleString();
    }
    return num.toString();
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  };

  const getDistanceLandmark = (km) => {
    for (const landmark of DISTANCE_LANDMARKS) {
      if (km >= landmark.km * 0.8) {
        const label = t(`report.landmarks.${landmark.key}`);
        return t('report.distanceLandmark', { label });
      }
    }
    return t('report.distanceMessage');
  };

  const getMostActiveDay = () => {
    const maxSteps = Math.max(...stats.weeklyPattern);
    const maxIndex = stats.weeklyPattern.indexOf(maxSteps);

    // 週末か平日か判定
    if (maxIndex >= 5) {
      return 'Most active on weekends!';
    }
    return `Most active on ${WEEKDAYS[maxIndex]}!`;
  };

  const handlePersonalBestTap = (dayData) => {
    if (!dayData?.date) return;

    // ホーム画面にその日付で遷移
    navigation.navigate('Home', {
      screen: 'HomeMain',
      params: { selectedDate: dayData.date }
    });
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentBestIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50
  };

  const renderPersonalBestCard = ({ item, index }) => {
    const rankColors = [COLORS.gold, COLORS.silver, COLORS.bronze];
    const rankLabels = ['1st', '2nd', '3rd'];
    const rankIcons = ['crown', 'medal', 'medal-outline'];

    return (
      <TouchableOpacity
        style={[styles.personalBestCard, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF' }]}
        onPress={() => handlePersonalBestTap(item)}
        activeOpacity={0.8}
      >
        <PaperTexture isDark={theme.isDark} />
        <View style={styles.rankBadge}>
          <MaterialCommunityIcons
            name={rankIcons[index]}
            size={20}
            color={rankColors[index]}
          />
          <Text style={[styles.rankText, { color: rankColors[index] }]}>
            {rankLabels[index]}
          </Text>
        </View>

        <Text style={[styles.personalBestSteps, { color: COLORS.orange }]}>
          {formatNumber(item.steps)}
        </Text>
        <Text style={[styles.personalBestLabel, { color: theme.textSecondary }]}>
          STEPS
        </Text>
        <Text style={[styles.personalBestDate, { color: theme.text }]}>
          {formatDate(item.date, locale)}
        </Text>

        {index === 0 && (
          <View style={styles.achievedBadge}>
            <Text style={styles.achievedText}>GOAL{'\n'}ACHIEVED!</Text>
          </View>
        )}

        <View style={styles.tapHint}>
          <MaterialCommunityIcons name="gesture-tap" size={14} color={theme.textSecondary} />
          <Text style={[styles.tapHintText, { color: theme.textSecondary }]}>
            {locale === 'ja' ? 'タップして詳細へ' : 'Tap for details'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={COLORS.teal} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          統計を計算中...
        </Text>
      </View>
    );
  }

  const maxWeeklySteps = Math.max(...stats.weeklyPattern, 1);

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Report</Text>
      </View>

      {/* TOTAL JOURNEY Card（無料・先頭表示） */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="map-marker-path" size={20} color={COLORS.teal} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>TOTAL JOURNEY</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowJourneyModal(true)}
          style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF', marginHorizontal: 0 }]}
        >
          <PaperTexture isDark={theme.isDark} />
          <View style={styles.cardTitleRow}>
            <Text style={[styles.dataSourceLabel, { color: theme.textSecondary }]}>
              {t('report.pastDaysData', { count: dataDaysCount })}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textSecondary} />
          </View>

          <View style={styles.journeyContent}>
            <View style={styles.journeyLeft}>
              <Text style={[styles.totalSteps, { color: theme.text }]}>
                {formatNumber(stats.totalSteps)}
              </Text>
                  <Text style={[styles.totalStepsLabel, { color: theme.textSecondary }]}>
                STEPS
              </Text>

              <View style={styles.subStats}>
                <Text style={[styles.subStatText, { color: theme.textSecondary }]}>
                  Total distance: <Text style={{ color: theme.text, fontWeight: '700' }}>{Math.round(stats.totalDistance)} km</Text>
                </Text>
                <Text style={[styles.subStatText, { color: theme.textSecondary }]}>
                  Total calories: <Text style={{ color: theme.text, fontWeight: '700' }}>{formatNumber(Math.round(stats.totalCalories))} kcal</Text>
                </Text>
              </View>
            </View>

            <View style={styles.journeyRight}>
              <View style={styles.mapIllustration}>
                <MaterialCommunityIcons name="map-marker-path" size={48} color={COLORS.teal} />
              </View>
              <Text style={[styles.landmarkText, { color: theme.textSecondary }]}>
                {getDistanceLandmark(stats.totalDistance)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* WEEKLY RECAP */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="calendar-week" size={20} color={COLORS.teal} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>WEEKLY RECAP</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF', marginHorizontal: 0 }]}>
          <PaperTexture isDark={theme.isDark} />
          {!isPremium ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={presentPaywall}
              style={{ alignItems: 'center', paddingVertical: 24 }}
            >
              <View style={styles.envTeaserLockBadge}>
                <MaterialCommunityIcons name="crown" size={18} color="#5D4E37" />
                <Text style={styles.envTeaserProLabel}>PRO</Text>
              </View>
              <Text style={[styles.envTeaserTitle, { color: theme.text }]}>{t('report.locks.weeklyTitle')}</Text>
              <Text style={[styles.envTeaserDescription, { color: theme.textSecondary }]}>
                {t('report.locks.weeklyDesc')}
              </Text>
              <TouchableOpacity
                style={[styles.envTeaserButton, { marginTop: 4 }]}
                onPress={presentPaywall}
              >
                <Text style={styles.envTeaserButtonText}>{t('report.locks.button')}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ) : weeklySummary.ready ? (
            <>
              <View style={styles.weeklyStatsRow}>
                <View style={styles.weeklyStat}>
                  <Text style={[styles.weeklyStatLabel, { color: theme.textSecondary }]}>{t('report.weekly.total')}</Text>
                  <Text style={[styles.weeklyStatValue, { color: theme.text }]}>{formatNumber(weeklySummary.total)}</Text>
                  <Text style={[styles.weeklyStatSub, { color: theme.textSecondary }]}>steps / 7</Text>
                </View>
                <View style={styles.weeklyStat}>
                  <Text style={[styles.weeklyStatLabel, { color: theme.textSecondary }]}>{t('report.weekly.avg')}</Text>
                  <Text style={[styles.weeklyStatValue, { color: theme.text }]}>{formatNumber(weeklySummary.average)}</Text>
                  <Text style={[styles.weeklyStatSub, { color: theme.textSecondary }]}>steps / day</Text>
                </View>
                <View style={styles.weeklyStat}>
                  <Text style={[styles.weeklyStatLabel, { color: theme.textSecondary }]}>{t('report.weekly.rate')}</Text>
                  <Text style={[styles.weeklyStatValue, { color: theme.text }]}>{weeklySummary.achievedRate}%</Text>
                  <Text style={[styles.weeklyStatSub, { color: theme.textSecondary }]}>
                    {weeklySummary.achievedDays} / 7日
                  </Text>
                </View>
              </View>

                <View style={styles.weeklyTrendRow}>
                  <View style={styles.trendBadge}>
                    <MaterialCommunityIcons
                      name={weeklySummary.trendPct >= 0 ? 'trending-up' : 'trending-down'}
                      size={16}
                      color={weeklySummary.trendPct >= 0 ? COLORS.teal : COLORS.orange}
                    />
                    <Text
                      style={[
                        styles.trendText,
                        { color: weeklySummary.trendPct >= 0 ? COLORS.teal : COLORS.orange },
                      ]}
                    >
                      {weeklySummary.trendPct === null
                      ? t('report.weekly.trendNoData')
                      : `${t('report.weekly.trendPrefix')} ${weeklySummary.trendPct >= 0 ? '+' : ''}${weeklySummary.trendPct}%`}
                    </Text>
                  </View>
                  {weeklySummary.bestDay?.date && (
                    <Text style={[styles.bestDayText, { color: theme.text }]}>
                    {t('report.weekly.best')}: {formatDate(weeklySummary.bestDay.date, locale)}
                    {' '}({formatNumber(weeklySummary.bestDay.steps)} {t('report.common.steps')})
                  </Text>
                  )}
                </View>

              <View style={styles.insightsContainer}>
                <View style={styles.weeklyInsightHeader}>
                  <View style={[styles.aiBadge, { borderColor: theme.border, backgroundColor: 'rgba(0,0,0,0.02)' }]}>
                    <MaterialCommunityIcons name="star-four-points" size={14} color={COLORS.teal} />
                    <Text style={[styles.aiBadgeText, { color: theme.textSecondary }]}>AI</Text>
                  </View>
                </View>
                {weeklyInsightLines.map((line, idx) => {
                  const anim = weeklyInsightAnims[idx] || new Animated.Value(1);
                  return (
                    <Animated.Text
                      key={`ins-${idx}`}
                      style={[
                        styles.insightLine,
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
                })}
              </View>
            </>
          ) : (
            <View style={styles.emptyCard}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>データを集計中です</Text>
            </View>
          )}
        </View>
      </View>

      {/* MONTHLY STYLE */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="palette-swatch" size={20} color={COLORS.teal} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>MONTHLY STYLE</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF', marginHorizontal: 0 }]}>
          <PaperTexture isDark={theme.isDark} />
          {!isPremium ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={presentPaywall}
              style={{ alignItems: 'center', paddingVertical: 24 }}
            >
              <View style={styles.envTeaserLockBadge}>
                <MaterialCommunityIcons name="crown" size={18} color="#5D4E37" />
                <Text style={styles.envTeaserProLabel}>PRO</Text>
              </View>
              <Text style={[styles.envTeaserTitle, { color: theme.text }]}>{t('report.locks.monthlyTitle')}</Text>
              <Text style={[styles.envTeaserDescription, { color: theme.textSecondary }]}>
                {t('report.locks.monthlyDesc')}
              </Text>
              <TouchableOpacity
                style={[styles.envTeaserButton, { marginTop: 4 }]}
                onPress={presentPaywall}
              >
                <Text style={styles.envTeaserButtonText}>{t('report.locks.button')}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ) : monthlySummary.ready ? (
            <>
                <View style={styles.monthlyHeaderRow}>
                  <View style={styles.typeBadge}>
                    <Text style={[styles.typeBadgeText, { color: theme.text }]}>{monthlySummary.type}</Text>
                  </View>
                  <View style={[styles.aiBadge, { borderColor: theme.border, backgroundColor: 'rgba(0,0,0,0.02)' }]}>
                  <MaterialCommunityIcons name="star-four-points" size={14} color={COLORS.teal} />
                  <Text style={[styles.aiBadgeText, { color: theme.textSecondary }]}>AI</Text>
                </View>
                </View>
              {monthlySummary.radarParams && (
                <View style={styles.radarWrapper}>
                  <RadarChart
                    size={width - 80}
                    params={monthlySummary.radarParams}
                    strokeColor={COLORS.teal}
                    fillColor={`${COLORS.teal}30`}
                    labelColor={theme.text}
                    gridColor={theme.textSecondary}
                    theme={theme}
                    labelMap={{
                      morning: t('report.monthly.types.morning'),
                      burst: t('report.monthly.axes.burst'),
                      power: t('report.monthly.axes.power'),
                      night: t('report.monthly.types.night'),
                      keep: t('report.monthly.axes.keep'),
                      weekend: t('report.monthly.types.weekend'),
                    }}
                  />
                </View>
              )}
              <View style={styles.insightsContainer}>
                {(monthlySummary.aiInsights?.length ? monthlySummary.aiInsights : monthlySummary.insights).map((line, idx) => {
                  const anim = monthlyInsightAnims[idx] || new Animated.Value(1);
                  return (
                    <Animated.Text
                      key={`mins-${idx}`}
                      style={[
                        styles.insightLine,
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
                })}
              </View>
            </>
          ) : (
            <View style={styles.emptyCard}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>データを集計中です</Text>
            </View>
          )}
        </View>
      </View>

      {/* PERSONAL BEST Card (Carousel) */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="crown" size={20} color={COLORS.gold} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>PERSONAL BEST</Text>
        </View>

        {!isPremium ? (
          /* Free用：ロック表示 */
          <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF', marginHorizontal: 0 }]}
            onPress={presentPaywall}
            activeOpacity={0.9}
          >
            <PaperTexture isDark={theme.isDark} />
            <View style={styles.envTeaserContent}>
              <View style={[styles.envTeaserBlurred, { alignItems: 'center' }]}>
                <View style={[styles.rankBadge, { opacity: 0.12 }]}>
                  <MaterialCommunityIcons name="crown" size={20} color={COLORS.gold} />
                  <Text style={[styles.rankText, { color: COLORS.gold }]}>1st</Text>
                </View>
                <Text style={[styles.personalBestSteps, { color: theme.textTertiary, opacity: 0.12 }]}>
                  ??,???
                </Text>
                <Text style={[styles.personalBestLabel, { color: theme.textSecondary, opacity: 0.12 }]}>
                  STEPS
                </Text>
              </View>
              <View style={styles.envTeaserOverlay}>
                <View style={styles.envTeaserLockBadge}>
                  <MaterialCommunityIcons name="crown" size={20} color="#5D4E37" />
                  <Text style={styles.envTeaserProLabel}>PRO</Text>
                </View>
                <Text style={[styles.envTeaserTitle, { color: theme.text }]}>
                  {t('report.locked.feature1')}
                </Text>
                <Text style={[styles.envTeaserDescription, { color: theme.textSecondary }]}>
                  年間の歩数ランキングを確認
                </Text>
                <View style={styles.envTeaserButton}>
                  <Text style={styles.envTeaserButtonText}>{t('report.locked.button')}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#FFF" />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ) : stats.topDays.length > 0 ? (
          <>
            <FlatList
              ref={personalBestListRef}
              data={stats.topDays}
              renderItem={renderPersonalBestCard}
              keyExtractor={(_, index) => `best-${index}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + 16}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 0 }}
              ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
            />
            {/* Pagination dots */}
            <View style={styles.pagination}>
              {stats.topDays.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    currentBestIndex === index && styles.paginationDotActive
                  ]}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF', marginHorizontal: 0 }]}>
            <MaterialCommunityIcons name="walk" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t('report.noRecords')}
            </Text>
          </View>
        )}
      </View>

      {/* WEEKLY PATTERN Card */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="crown" size={20} color={COLORS.gold} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>WEEKLY PATTERN</Text>
        </View>

        {!isPremium ? (
          /* Free用：ロック表示 */
          <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF', marginHorizontal: 0 }]}
            onPress={presentPaywall}
            activeOpacity={0.9}
          >
            <PaperTexture isDark={theme.isDark} />
            <View style={styles.envTeaserContent}>
              <View style={styles.envTeaserBlurred}>
                {/* 棒グラフ非表示 */}
              </View>
              <View style={styles.envTeaserOverlay}>
                <View style={styles.envTeaserLockBadge}>
                  <MaterialCommunityIcons name="crown" size={20} color="#5D4E37" />
                  <Text style={styles.envTeaserProLabel}>PRO</Text>
                </View>
                <Text style={[styles.envTeaserTitle, { color: theme.text }]}>
                  {t('report.locked.feature4')}
                </Text>
                <Text style={[styles.envTeaserDescription, { color: theme.textSecondary }]}>
                  あなたの曜日別活動パターンを分析します
                </Text>
                <View style={styles.envTeaserButton}>
                  <Text style={styles.envTeaserButtonText}>{t('report.locked.button')}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#FFF" />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF', marginHorizontal: 0 }]}>
            <PaperTexture isDark={theme.isDark} />
            <View style={styles.cardTitleRow}>
              <Text style={[styles.dataSourceLabel, { color: theme.textSecondary }]}>
                {t('report.average')}
              </Text>
            </View>

          {/* タップ時のツールチップ */}
          {selectedWeekday !== null && (
            <View style={[styles.tooltip, { backgroundColor: theme.isDark ? '#333' : '#FFF' }]}>
              <Text style={[styles.tooltipText, { color: theme.text }]}>
                {WEEKDAYS[selectedWeekday]}: {t('report.stepsPerDay', { steps: formatNumber(stats.weeklyPattern[selectedWeekday]) })}
              </Text>
            </View>
          )}

          <View style={styles.chartContainer}>
            {stats.weeklyPattern.map((steps, index) => {
              const heightPercent = (steps / maxWeeklySteps) * 100;
              const isWeekend = index >= 5;
              const isMax = steps === maxWeeklySteps && steps > 0;
              const isSelected = selectedWeekday === index;

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.barContainer}
                  onPress={() => setSelectedWeekday(selectedWeekday === index ? null : index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max(heightPercent, 5)}%`,
                          backgroundColor: isMax
                            ? COLORS.orange
                            : isWeekend
                              ? COLORS.teal
                              : '#A8E6CF',
                          opacity: isSelected ? 1 : 0.8,
                          transform: isSelected ? [{ scaleX: 1.1 }] : [],
                        }
                      ]}
                    />
                  </View>
                  <Text style={[
                    styles.weekdayLabel,
                    { color: isSelected ? theme.text : theme.textSecondary, fontWeight: isSelected ? '700' : '600' }
                  ]}>
                    {WEEKDAYS[index]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.patternInsight, { color: theme.textSecondary }]}>
            {getMostActiveDay()}
          </Text>
          </View>
        )}
      </View>

      {/* Walking DNA Section - AI機能追加時に有効化 */}
      {/*
      <View style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF' }]}>
        <PaperTexture isDark={theme.isDark} />
        <View style={styles.dnaHeader}>
          <View style={styles.dnaHeaderLeft}>
            <Text style={styles.dnaHeaderEmoji}>🧬</Text>
            <Text style={[styles.dnaHeaderTitle, { color: theme.text }]}>
              WALKING DNA
            </Text>
            <Text style={[styles.dnaHeaderSubtitle, { color: theme.textSecondary }]}>
              (Last 7 Days)
            </Text>
          </View>
        </View>
        {walkingDna.hasEnoughData ? (
          <>
            <View style={styles.radarChartContainer}>
              <RadarChart
                params={walkingDna.params}
                size={240}
                theme={theme}
              />
            </View>
            <View style={styles.dnaTitleSection}>
              <Text style={[styles.dnaTitleText, { color: theme.text }]}>
                あなたは【{walkingDna.title}】です
              </Text>
              {walkingDna.description && (
                <Text style={[styles.dnaDescriptionText, { color: theme.textSecondary }]}>
                  {walkingDna.description}
                </Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.dnaPlaceholder}>
            <MaterialCommunityIcons name="dna" size={48} color={theme.textSecondary} />
            <Text style={[styles.collectingText, { color: theme.text }]}>
              データ収集中...
            </Text>
            <Text style={[styles.collectingDescription, { color: theme.textSecondary }]}>
              あなたの歩行スタイルを分析するには、少なくとも3日分の時間帯別データが必要です。
            </Text>
          </View>
        )}
      </View>
      */}

      {/* Environment Analysis Section */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="crown" size={20} color={COLORS.gold} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>ENVIRONMENT ANALYSIS</Text>
        </View>

        {!isPremium ? (
          /* Free用：ロック画面 */
          <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF', marginHorizontal: 0 }]}
            onPress={presentPaywall}
            activeOpacity={0.9}
          >
            <PaperTexture isDark={theme.isDark} />

            {/* ぼかしオーバーレイ風の背景 */}
            <View style={styles.envTeaserContent}>
              {/* サンプルデータ（ぼかし表示風） - 棒グラフ非表示 */}
              <View style={styles.envTeaserBlurred}>
                <Text style={[styles.bestTempValue, { color: theme.textTertiary, opacity: 0.15 }]}>
                  ??°C
                </Text>
                {/* 棒グラフ非表示 */}
              </View>

              {/* ロックアイコン＆CTA */}
              <View style={styles.envTeaserOverlay}>
                <View style={styles.envTeaserLockBadge}>
                  <MaterialCommunityIcons name="crown" size={20} color="#5D4E37" />
                  <Text style={styles.envTeaserProLabel}>PRO</Text>
                </View>
                <Text style={[styles.envTeaserTitle, { color: theme.text }]}>
                  {t('report.envTeaser.title')}
                </Text>
                <Text style={[styles.envTeaserDescription, { color: theme.textSecondary }]}>
                  {t('report.envTeaser.description')}
                </Text>
                <View style={styles.envTeaserButton}>
                  <Text style={styles.envTeaserButtonText}>{t('report.envTeaser.button')}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#FFF" />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ) : envAnalysis.hasEnoughData ? (
          /* Pro用：フル表示 */
          <View style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF', marginHorizontal: 0 }]}>
            <PaperTexture isDark={theme.isDark} />

            {/* Data Source Label */}
            <Text style={[styles.dataSourceLabel, { color: theme.textSecondary, textAlign: 'right', marginBottom: 8 }]}>
              {t('report.pastDaysData', { count: envAnalysis.dataCount })}
            </Text>

            {/* YOUR BEST TEMPERATURE */}
            <View style={styles.bestTempSection}>
              <View style={styles.bestTempHeader}>
                <Text style={[styles.envSubTitle, { color: COLORS.teal }]}>
                  YOUR BEST TEMPERATURE
                </Text>
                <View style={styles.tempTitleBadge}>
                  <Text style={styles.tempTitleText}>{envAnalysis.tempTitle}</Text>
                </View>
              </View>
              <Text style={[styles.bestTempValue, { color: theme.text }]}>
                {envAnalysis.bestTemp !== null ? `${envAnalysis.bestTemp}°C` : '--'}
              </Text>
              <Text style={[styles.bestTempRange, { color: theme.textSecondary }]}>
                Optimal Activity Zone: {envAnalysis.bestTempRange || '--'}
              </Text>
            </View>

            {/* TEMPERATURE PERFORMANCE - Gradient Bar Chart */}
            <View style={styles.tempPerformanceSection}>
              <Text style={[styles.envSubTitle, { color: COLORS.teal }]}>
                TEMPERATURE PERFORMANCE
              </Text>

              {/* タップ時のツールチップ */}
              {selectedTempZone !== null && (
                <View style={[styles.tooltip, { backgroundColor: theme.isDark ? '#333' : '#FFF' }]}>
                  <Text style={[styles.tooltipText, { color: theme.text }]}>
                    {[t('report.tempZones.freezing'), t('report.tempZones.cold'), t('report.tempZones.comfortable'), t('report.tempZones.hot'), t('report.tempZones.extreme')][selectedTempZone]}:
                    {t('report.average')} {formatNumber(envAnalysis.tempZones[selectedTempZone])} {t('units.steps')}
                  </Text>
                </View>
              )}

              <View style={styles.tempBarsContainer}>
                {(() => {
                  const maxZoneSteps = Math.max(...envAnalysis.tempZones, 1);
                  const zoneLabels = [t('report.tempZoneLabels.freezing'), t('report.tempZoneLabels.cold'), t('report.tempZoneLabels.comfortable'), t('report.tempZoneLabels.hot'), t('report.tempZoneLabels.extreme')];
                  const gradientColors = [
                    ['#4FC3F7', '#29B6F6'],  // 極寒 - 水色
                    ['#81D4FA', '#4DD0E1'],  // 寒い - 薄青
                    ['#80CBC4', '#4DB6AC'],  // 快適 - ティール
                    ['#FFB74D', '#FFA726'],  // 暑い - オレンジ
                    ['#FF7043', '#F4511E'],  // 猛暑 - 赤
                  ];

                  return envAnalysis.tempZones.map((steps, index) => {
                    const heightPercent = (steps / maxZoneSteps) * 100;
                    const isSelected = selectedTempZone === index;
                    return (
                      <TouchableOpacity
                        key={index}
                        style={styles.tempBarContainer}
                        onPress={() => setSelectedTempZone(selectedTempZone === index ? null : index)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.tempBarWrapper}>
                          <LinearGradient
                            colors={gradientColors[index]}
                            style={[
                              styles.tempBar,
                              {
                                height: `${Math.max(heightPercent, 8)}%`,
                                opacity: isSelected ? 1 : 0.85,
                                transform: isSelected ? [{ scaleX: 1.1 }] : [],
                              }
                            ]}
                          />
                        </View>
                        <Text style={[
                          styles.tempBarLabel,
                          { color: isSelected ? theme.text : theme.textSecondary, fontWeight: isSelected ? '700' : '600' }
                        ]}>
                          {zoneLabels[index]}
                        </Text>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>
            </View>

            {/* WEATHER PERFORMANCE */}
            <View style={styles.weatherPerformanceSection}>
              <Text style={[styles.envSubTitle, { color: COLORS.teal }]}>
                WEATHER PERFORMANCE
              </Text>
              <View style={styles.weatherCompareContainer}>
                {/* Sunny */}
                <View style={styles.weatherCompareItem}>
                  <View style={[styles.weatherIconCircle, { backgroundColor: 'rgba(255, 193, 7, 0.2)' }]}>
                    <MaterialCommunityIcons name="weather-sunny" size={32} color="#FFC107" />
                  </View>
                  <Text style={[styles.weatherLabel, { color: theme.textSecondary }]}>{t('report.weather.sunny')}</Text>
                  <Text style={[styles.weatherSteps, { color: theme.text }]}>
                    {formatNumber(envAnalysis.sunnyAvg)}
                  </Text>
                  <Text style={[styles.weatherStepsLabel, { color: theme.textSecondary }]}>
                    steps (Avg.)
                  </Text>
                </View>

                {/* Rainy */}
                <View style={styles.weatherCompareItem}>
                  <View style={[styles.weatherIconCircle, { backgroundColor: 'rgba(100, 181, 246, 0.2)' }]}>
                    <MaterialCommunityIcons name="weather-rainy" size={32} color="#64B5F6" />
                  </View>
                  <Text style={[styles.weatherLabel, { color: theme.textSecondary }]}>{t('report.weather.rainy')}</Text>
                  <Text style={[styles.weatherSteps, { color: theme.text }]}>
                    {formatNumber(envAnalysis.rainyAvg)}
                  </Text>
                  <Text style={[styles.weatherStepsLabel, { color: theme.textSecondary }]}>
                    steps (Avg.)
                  </Text>
                </View>
              </View>
            </View>

            {/* RAINY DAY HERO */}
            {envAnalysis.rainyHero && (
              <TouchableOpacity
                style={styles.rainyHeroBanner}
                onPress={() => handlePersonalBestTap(envAnalysis.rainyHero)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FFD700', '#FFA000']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.rainyHeroGradient}
                >
                  <Text style={styles.rainyHeroEmoji}>🌧️</Text>
                  <Text style={styles.rainyHeroIcon}>🏆</Text>
                  <Text style={styles.rainyHeroText}>
                    {t('report.envHero.title', {
                      date: formatDateSlash(envAnalysis.rainyHero.date),
                      steps: formatNumber(envAnalysis.rainyHero.steps),
                    })}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* Pro用：データ不足時のプレースホルダー */
          <View style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF', marginHorizontal: 0 }]}>
            <PaperTexture isDark={theme.isDark} />
            <View style={styles.weatherPlaceholder}>
              <View style={styles.weatherIcons}>
                <MaterialCommunityIcons name="weather-partly-cloudy" size={40} color={theme.textSecondary} />
                <MaterialCommunityIcons name="thermometer" size={40} color={theme.textSecondary} />
              </View>
              <Text style={[styles.collectingText, { color: theme.text }]}>
                {t('report.collectingData')}
              </Text>
              <Text style={[styles.collectingDescription, { color: theme.textSecondary }]}>
                {t('report.collectingDescription')}
              </Text>
            </View>
          </View>
        )}
      </View>

    </ScrollView>

    {/* Journey詳細モーダル */}
    <Modal
      visible={showJourneyModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowJourneyModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.journeyModal, { backgroundColor: theme.card }]}>
          {/* ヘッダー */}
          <View style={styles.journeyModalHeader}>
            <Text style={[styles.journeyModalTitle, { color: theme.text }]}>
              Your Journey
            </Text>
            <TouchableOpacity
              onPress={() => setShowJourneyModal(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* 現在の距離 */}
          <View style={styles.journeyModalCurrent}>
            <Text style={[styles.journeyModalDistance, { color: COLORS.teal }]}>
              {formatNumber(Math.round(stats.totalDistance))} km
            </Text>
            <Text style={[styles.journeyModalLabel, { color: theme.textSecondary }]}>
              Total Distance
            </Text>
          </View>

          {/* タイムライン */}
          <ScrollView style={styles.journeyTimeline} showsVerticalScrollIndicator={false}>
            {[...DISTANCE_LANDMARKS].reverse().map((landmark, index) => {
              const isAchieved = stats.totalDistance >= landmark.km * 0.8;
              const isNext = !isAchieved && (index === 0 || stats.totalDistance >= [...DISTANCE_LANDMARKS].reverse()[index - 1]?.km * 0.8);
              const progress = isAchieved ? 100 : Math.min((stats.totalDistance / (landmark.km * 0.8)) * 100, 99);

              return (
                <View key={landmark.key} style={styles.journeyTimelineItem}>
                  {/* 縦線 */}
                  <View style={styles.journeyTimelineLeft}>
                    <View style={[
                      styles.journeyTimelineDot,
                      isAchieved && styles.journeyTimelineDotAchieved,
                      isNext && styles.journeyTimelineDotNext,
                    ]}>
                      {isAchieved && (
                        <MaterialCommunityIcons name="check" size={12} color="#FFF" />
                      )}
                    </View>
                    {index < DISTANCE_LANDMARKS.length - 1 && (
                      <View style={[
                        styles.journeyTimelineLine,
                        isAchieved && styles.journeyTimelineLineAchieved,
                      ]} />
                    )}
                  </View>

                  {/* コンテンツ */}
                  <View style={[
                    styles.journeyTimelineContent,
                    isNext && styles.journeyTimelineContentNext,
                  ]}>
                    <View style={styles.journeyTimelineRow}>
                      <Text style={[
                        styles.journeyTimelineName,
                        { color: isAchieved ? theme.text : theme.textSecondary },
                        isAchieved && { fontWeight: '700' },
                      ]}>
                        {t(`report.landmarks.${landmark.key}`)}
                      </Text>
                      <Text style={[
                        styles.journeyTimelineKm,
                        { color: isAchieved ? COLORS.teal : theme.textTertiary },
                      ]}>
                        {formatNumber(landmark.km)} km
                      </Text>
                    </View>
                    {isNext && (
                      <View style={styles.journeyProgressContainer}>
                        <View style={styles.journeyProgressBar}>
                          <View style={[styles.journeyProgressFill, { width: `${progress}%` }]} />
                        </View>
                        <Text style={[styles.journeyProgressText, { color: theme.textSecondary }]}>
                          {Math.round(progress)}%
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  weeklyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  weeklyStat: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  weeklyStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  weeklyStatValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  weeklyStatSub: {
    fontSize: 11,
    marginTop: 4,
  },
  weeklyTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  trendText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  monthlyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  typeBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  radarWrapper: {
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestDayText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  insightsContainer: {
    marginTop: 18,
    gap: 4,
  },
  insightLine: {
    fontSize: 13,
    lineHeight: 19,
  },
  weeklyInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 4,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aiBadgeText: { marginLeft: 4, fontSize: 11, fontWeight: '700' },
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#8B8178',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E8E4DF',
    borderLeftWidth: 3,
    borderLeftColor: '#E0DCD6',
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dataSourceLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  tooltip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: 'center',
  },
  tooltipText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Total Journey
  journeyContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  journeyLeft: {
    flex: 1,
  },
  totalSteps: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  totalStepsLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  subStats: {
    gap: 4,
  },
  subStatText: {
    fontSize: 12,
  },
  journeyRight: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 16,
  },
  mapIllustration: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 168, 150, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  landmarkText: {
    fontSize: 10,
    textAlign: 'center',
    maxWidth: 100,
  },
  // Personal Best Section
  sectionContainer: {
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginLeft: 8,
  },
  personalBestCard: {
    width: CARD_WIDTH,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#8B8178',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E8E4DF',
    overflow: 'hidden',
    alignItems: 'center',
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 4,
  },
  personalBestSteps: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  personalBestLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  personalBestDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  achievedBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 8,
    padding: 8,
    transform: [{ rotate: '15deg' }],
  },
  achievedText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.orange,
    textAlign: 'center',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E4DF',
  },
  tapHintText: {
    fontSize: 11,
    marginLeft: 4,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: COLORS.teal,
    width: 20,
  },
  emptyCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
  },
  // Weekly Pattern
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
    paddingTop: 20,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    flex: 1,
    width: '60%',
    justifyContent: 'flex-end',
  },
  bar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  weekdayLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  patternInsight: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Environment Analysis Styles
  envSubTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  // Best Temperature
  bestTempSection: {
    marginBottom: 24,
  },
  bestTempHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tempTitleBadge: {
    backgroundColor: 'rgba(0, 168, 150, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tempTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.teal,
  },
  bestTempValue: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -2,
  },
  bestTempRange: {
    fontSize: 12,
    marginTop: 4,
  },
  // Temperature Performance Bars
  tempPerformanceSection: {
    marginBottom: 24,
  },
  tempBarsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 10,
  },
  tempBarContainer: {
    flex: 1,
    alignItems: 'center',
  },
  tempBarWrapper: {
    flex: 1,
    width: '70%',
    justifyContent: 'flex-end',
  },
  tempBar: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 10,
  },
  tempBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  // Weather Performance
  weatherPerformanceSection: {
    marginBottom: 16,
  },
  weatherCompareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weatherCompareItem: {
    alignItems: 'center',
    flex: 1,
  },
  weatherIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  weatherLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  weatherSteps: {
    fontSize: 22,
    fontWeight: '800',
  },
  weatherStepsLabel: {
    fontSize: 10,
  },
  // Rainy Day Hero
  rainyHeroBanner: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rainyHeroGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rainyHeroEmoji: {
    fontSize: 18,
    marginRight: 4,
  },
  rainyHeroIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  rainyHeroText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#3E2723',
  },
  // Placeholder (data collecting)
  weatherPlaceholder: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  weatherIcons: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  collectingText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  collectingDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  // Environment Teaser (Free users)
  envTeaserContent: {
    position: 'relative',
    minHeight: 180,
  },
  envTeaserBlurred: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  envTeaserBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    width: '80%',
    height: 80,
    marginTop: 12,
  },
  envTeaserBar: {
    width: 32,
    borderRadius: 4,
  },
  envTeaserOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    // 40-50%の暗さ、中身がちょい見え
  },
  envTeaserLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  envTeaserProLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#5D4E37',
    marginLeft: 6,
  },
  envTeaserTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  envTeaserDescription: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  envTeaserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00A896',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  envTeaserButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // AI Card
  aiCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 168, 150, 0.3)',
    borderStyle: 'dashed',
  },
  aiContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  aiTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  aiDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  dataInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 168, 150, 0.2)',
  },
  dataInfoText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Walking DNA Styles
  dnaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dnaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dnaHeaderEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  dnaHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  dnaHeaderSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  radarChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  dnaTitleSection: {
    alignItems: 'center',
    paddingTop: 8,
  },
  dnaTitleText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  dnaDescriptionText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  dnaPlaceholder: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  // Journey Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  journeyModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  journeyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  journeyModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  journeyModalCurrent: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  journeyModalDistance: {
    fontSize: 36,
    fontWeight: '900',
  },
  journeyModalLabel: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  journeyTimeline: {
    paddingHorizontal: 20,
  },
  journeyTimelineItem: {
    flexDirection: 'row',
    minHeight: 60,
  },
  journeyTimelineLeft: {
    width: 32,
    alignItems: 'center',
  },
  journeyTimelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  journeyTimelineDotAchieved: {
    backgroundColor: '#00A896',
  },
  journeyTimelineDotNext: {
    backgroundColor: '#FFF',
    borderWidth: 3,
    borderColor: '#00A896',
  },
  journeyTimelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  journeyTimelineLineAchieved: {
    backgroundColor: '#00A896',
  },
  journeyTimelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  journeyTimelineContentNext: {
    backgroundColor: 'rgba(0,168,150,0.08)',
    marginLeft: 8,
    marginRight: -20,
    paddingLeft: 12,
    paddingRight: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  journeyTimelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  journeyTimelineName: {
    fontSize: 15,
    flex: 1,
  },
  journeyTimelineKm: {
    fontSize: 13,
    fontWeight: '600',
  },
  journeyProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  journeyProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(0,168,150,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  journeyProgressFill: {
    height: '100%',
    backgroundColor: '#00A896',
    borderRadius: 3,
  },
  journeyProgressText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    minWidth: 36,
  },
});
