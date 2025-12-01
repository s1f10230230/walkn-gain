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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getTheme } from '../utils/theme';
import { getStepsInRange } from '../utils/healthKit';
import { calculateCalories, toDateKeyLocal } from '../utils/calculations';
import { getUserProfile, getMultipleDaysData, getSettings } from '../utils/storage';
import { LinearGradient } from 'expo-linear-gradient';
import PaperTexture from '../components/PaperTexture';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

// 日本の主要距離の換算
const DISTANCE_LANDMARKS = [
  { km: 950, label: '東京〜福岡' },
  { km: 500, label: '東京〜大阪' },
  { km: 300, label: '東京〜名古屋' },
  { km: 100, label: 'フルマラソン2.4回分' },
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

  useEffect(() => {
    loadAllTimeStats();
    loadEnvironmentAnalysis();
  }, []);

  // 環境分析データをロード
  const loadEnvironmentAnalysis = async () => {
    try {
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

      daysWithWeather.forEach(day => {
        const avgTemp = (day.weather.maxTemp + day.weather.minTemp) / 2;
        const steps = day.steps || 0;
        const weatherCode = day.weather.code;

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

        // 天気別集計 (WMO codes: 0-3=晴れ/曇り, 51-99=雨/雪)
        const isRainy = weatherCode >= 51;
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
      });

      // 最適気温を計算 (平均歩数が最も高い気温帯)
      let bestTempKey = null;
      let bestTempAvg = 0;
      Object.entries(tempStepsMap).forEach(([temp, stepsArr]) => {
        if (stepsArr.length >= 3) { // 最低3日のデータが必要
          const avg = stepsArr.reduce((a, b) => a + b, 0) / stepsArr.length;
          if (avg > bestTempAvg) {
            bestTempAvg = avg;
            bestTempKey = parseInt(temp);
          }
        }
      });

      // 称号を決定
      let tempTitle = '🌿 季節の狩人';
      if (bestTempKey !== null) {
        if (bestTempKey <= 10) tempTitle = '❄️ 冬将軍';
        else if (bestTempKey >= 25) tempTitle = '🔥 夏の王者';
      }

      // ゾーン別平均
      const tempZoneAvgs = tempZoneTotals.map((total, i) =>
        tempZoneCounts[i] > 0 ? Math.round(total / tempZoneCounts[i]) : 0
      );

      setEnvAnalysis({
        bestTemp: bestTempKey,
        bestTempRange: bestTempKey !== null ? `${bestTempKey - 2}°C - ${bestTempKey + 3}°C` : null,
        tempTitle,
        tempZones: tempZoneAvgs,
        sunnyAvg: sunnyCount > 0 ? Math.round(sunnyTotalSteps / sunnyCount) : 0,
        rainyAvg: rainyCount > 0 ? Math.round(rainyTotalSteps / rainyCount) : 0,
        rainyHero: rainyHeroData,
        hasEnoughData: true,
        dataCount: daysWithWeather.length,
      });

    } catch (error) {
      console.error('Error loading environment analysis:', error);
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
        return `${landmark.label}相当の距離を歩きました！`;
      }
    }
    return '素晴らしい！これからもっと歩きましょう';
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

  const handleAITap = () => {
    Alert.alert(
      'Coming Soon',
      'AI専属パートナー機能は現在開発中です。次期アップデートをお楽しみに！',
      [{ text: 'OK' }]
    );
  };

  const handleDataInfoTap = () => {
    Alert.alert(
      'データの使い道',
      'あなたの「歩数」「天気」そして「毎日の気分」。\n\n' +
      'これらを組み合わせることで、AIがあなたの「元気の源」を見つけ出します。\n\n' +
      '例えば...\n' +
      '☀️「晴れた日に歩くと、気分が最高になるタイプです！」\n' +
      '🚶「1万歩以上歩いた日は、90%の確率で最高の気分に」\n' +
      '📅「月曜日はブルーになりがち、でも水曜日に持ち直す傾向」\n\n' +
      '日記ページで毎日の気分を記録すると、より精度の高い分析ができるようになります。',
      [{ text: 'わかった！' }]
    );
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
          {formatDate(item.date)}
        </Text>

        {index === 0 && (
          <View style={styles.achievedBadge}>
            <Text style={styles.achievedText}>GOAL{'\n'}ACHIEVED!</Text>
          </View>
        )}

        <View style={styles.tapHint}>
          <MaterialCommunityIcons name="gesture-tap" size={14} color={theme.textSecondary} />
          <Text style={[styles.tapHintText, { color: theme.textSecondary }]}>
            タップして詳細へ
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
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Report</Text>
      </View>

      {/* TOTAL JOURNEY Card */}
      <View style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF' }]}>
        <PaperTexture isDark={theme.isDark} />
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: COLORS.teal, marginBottom: 0 }]}>TOTAL JOURNEY</Text>
          <Text style={[styles.dataSourceLabel, { color: theme.textSecondary }]}>
            過去{dataDaysCount}日分
          </Text>
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
      </View>

      {/* PERSONAL BEST Card (Carousel) */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="crown" size={20} color={COLORS.gold} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>PERSONAL BEST</Text>
        </View>

        {stats.topDays.length > 0 ? (
          <>
            <FlatList
              ref={personalBestListRef}
              data={stats.topDays}
              renderItem={renderPersonalBestCard}
              keyExtractor={(item, index) => `best-${index}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + 16}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 20 }}
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
          <View style={[styles.emptyCard, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF' }]}>
            <MaterialCommunityIcons name="walk" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              まだ記録がありません
            </Text>
          </View>
        )}
      </View>

      {/* WEEKLY PATTERN Card */}
      <View style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF' }]}>
        <PaperTexture isDark={theme.isDark} />
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: COLORS.teal, marginBottom: 0 }]}>WEEKLY PATTERN</Text>
          <Text style={[styles.dataSourceLabel, { color: theme.textSecondary }]}>
            平均値
          </Text>
        </View>

        {/* タップ時のツールチップ */}
        {selectedWeekday !== null && (
          <View style={[styles.tooltip, { backgroundColor: theme.isDark ? '#333' : '#FFF' }]}>
            <Text style={[styles.tooltipText, { color: theme.text }]}>
              {WEEKDAYS[selectedWeekday]}: {formatNumber(stats.weeklyPattern[selectedWeekday])} 歩/日
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

      {/* Environment Analysis Section */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="crown" size={20} color={COLORS.gold} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>ENVIRONMENT ANALYSIS</Text>
        </View>

        {envAnalysis.hasEnoughData ? (
          <View style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF' }]}>
            <PaperTexture isDark={theme.isDark} />

            {/* Data Source Label */}
            <Text style={[styles.dataSourceLabel, { color: theme.textSecondary, textAlign: 'right', marginBottom: 8 }]}>
              過去{envAnalysis.dataCount}日分のデータ
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
                    {['極寒(〜5°C)', '寒い(5〜15°C)', '快適(15〜25°C)', '暑い(25〜30°C)', '猛暑(30°C〜)'][selectedTempZone]}:
                    平均 {formatNumber(envAnalysis.tempZones[selectedTempZone])} 歩
                  </Text>
                </View>
              )}

              <View style={styles.tempBarsContainer}>
                {(() => {
                  const maxZoneSteps = Math.max(...envAnalysis.tempZones, 1);
                  const zoneLabels = ['🥶 極寒', '🧥 寒い', '🏃 快適', '😅 暑い', '🥵 猛暑'];
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
                  <Text style={[styles.weatherLabel, { color: theme.textSecondary }]}>☀️ 晴れ</Text>
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
                  <Text style={[styles.weatherLabel, { color: theme.textSecondary }]}>🌧 雨</Text>
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
                    RAINY DAY HERO: {formatDate(envAnalysis.rainyHero.date).slice(5)}に{formatNumber(envAnalysis.rainyHero.steps)}歩達成！
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* データ不足時のプレースホルダー */
          <View style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF' }]}>
            <PaperTexture isDark={theme.isDark} />
            <View style={styles.weatherPlaceholder}>
              <View style={styles.weatherIcons}>
                <MaterialCommunityIcons name="weather-partly-cloudy" size={40} color={theme.textSecondary} />
                <MaterialCommunityIcons name="thermometer" size={40} color={theme.textSecondary} />
              </View>
              <Text style={[styles.collectingText, { color: theme.text }]}>
                データ収集中...
              </Text>
              <Text style={[styles.collectingDescription, { color: theme.textSecondary }]}>
                天気や気温が活動に与える影響を分析するには、もう少しデータが必要です。
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* AI Partner Coming Soon */}
      <View style={[styles.aiCard, { backgroundColor: 'rgba(0, 168, 150, 0.1)' }]}>
        <TouchableOpacity
          onPress={handleAITap}
          activeOpacity={0.7}
        >
          <View style={styles.aiContent}>
            <MaterialCommunityIcons name="robot-outline" size={24} color={COLORS.teal} />
            <View style={styles.aiTextContainer}>
              <Text style={[styles.aiTitle, { color: theme.text }]}>
                AI専属パートナー (Coming Soon)
              </Text>
              <Text style={[styles.aiDescription, { color: theme.textSecondary }]}>
                あなたの記録を分析して、毎月あなただけの物語をお届けします。次期アップデートをお楽しみに！
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* データの使い道ボタン */}
        <TouchableOpacity
          style={styles.dataInfoButton}
          onPress={handleDataInfoTap}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="information-outline" size={16} color={COLORS.teal} />
          <Text style={[styles.dataInfoText, { color: COLORS.teal }]}>
            データの使い道を見る
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
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
});
