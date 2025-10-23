import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  AppState,
  useColorScheme,
} from 'react-native';
import { Pedometer } from 'expo-sensors';
import * as Progress from 'react-native-progress';
import { getTheme, getShadowStyle } from '../utils/theme';
import {
  calculateCalories,
  calculateDistance,
  calculateGoalProgress,
  getTodayDateString,
  formatDate,
} from '../utils/calculations';
import {
  getTodayData,
  saveTodayData,
  getUserProfile,
  getSettings,
  getFavorites,
  getHealthSyncEnabled,
} from '../utils/storage';
import {
  getCachedTodayData,
  cacheTodayData,
  getLatestCachedData,
} from '../utils/cache';
import { getFoodById, calculateFoodAmount } from '../data/foodDatabase';
import {
  initializeHealthKit,
  getTodaySteps,
  saveStepsToHealthKit,
  getCalories,
  getDistance,
} from '../utils/healthKit';
import {
  requestNotificationPermissions,
  sendGoalAchievedNotification,
  sendProgressNotification,
  setupNotificationListeners,
} from '../utils/notifications';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [steps, setSteps] = useState(0);
  const [calories, setCalories] = useState(0);
  const [distance, setDistance] = useState(0);
  const [goal, setGoal] = useState(10000);
  const [progress, setProgress] = useState(0);
  const [favorites, setFavorites] = useState(['ramen', 'onigiri', 'beer']);
  const [profile, setProfile] = useState({ height: 170, weight: 65, stride: 72 });
  const [isPedometerAvailable, setIsPedometerAvailable] = useState('checking');
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  // 🌙 ダークモード対応
  const systemColorScheme = useColorScheme();
  const theme = getTheme(systemColorScheme);

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

  // アプリの状態が変わった時の処理
  const handleAppStateChange = async (nextAppState) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      console.log('⚡ アプリがフォアグラウンドに復帰 - データを自動更新');
      await refreshData();
    }
    appState.current = nextAppState;
  };

  // データを強制的に更新（フォアグラウンド復帰時）
  const refreshData = async () => {
    const healthSyncEnabled = await getHealthSyncEnabled();

    if (healthSyncEnabled) {
      // ヘルスケアから最新データを取得
      try {
        const today = new Date();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const healthSteps = await getTodaySteps();
        const healthCalories = await getCalories(startOfDay, today);
        const healthDistance = await getDistance(startOfDay, today);

        if (healthSteps > 0) {
          updateHealthData(healthSteps, healthCalories, healthDistance / 1000);
        }
      } catch (error) {
        console.error('データ更新に失敗:', error);
      }
    } else {
      // Pedometerから最新データを取得
      try {
        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const pastStepCountResult = await Pedometer.getStepCountAsync(start, end);
        if (pastStepCountResult) {
          updateSteps(pastStepCountResult.steps);
        }
      } catch (error) {
        console.error('歩数データ更新に失敗:', error);
      }
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
      // 必要に応じて画面遷移などの処理を追加
    });

    // ヘルスケア連携の初期化
    const healthSyncEnabled = await getHealthSyncEnabled();
    if (healthSyncEnabled) {
      try {
        const initialized = await initializeHealthKit();
        if (initialized) {
          console.log('ヘルスケア連携が有効化されました');

          // ヘルスケアから歩数、カロリー、距離を取得
          const today = new Date();
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);

          const healthSteps = await getTodaySteps();
          const healthCalories = await getCalories(startOfDay, today);
          const healthDistance = await getDistance(startOfDay, today);

          if (healthSteps > 0) {
            // ヘルスケアのデータを優先して使用
            updateHealthData(healthSteps, healthCalories, healthDistance / 1000); // メートルをkmに変換
          }
        }
      } catch (error) {
        console.error('ヘルスケアデータの取得に失敗:', error);
        // 🌍 オフライン対応: エラー時はキャッシュデータを使用（既に表示済み）
        const latestCache = await getLatestCachedData();
        if (latestCache) {
          console.log('📦 オフラインモード: キャッシュデータを使用');
        }
      }
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  };

  const loadData = async () => {
    const todayData = await getTodayData();
    const userProfile = await getUserProfile();
    const settings = await getSettings();
    const userFavorites = await getFavorites();

    setProfile(userProfile);
    setGoal(settings.dailyGoal);
    setFavorites(userFavorites.slice(0, 3));

    if (todayData) {
      setSteps(todayData.steps);
      setCalories(todayData.calories);
      setDistance(todayData.distance);
      setProgress(calculateGoalProgress(todayData.steps, settings.dailyGoal));
    }
  };

  const setupPedometer = async () => {
    try {
      const isAvailable = await Pedometer.isAvailableAsync();
      setIsPedometerAvailable(String(isAvailable));

      if (isAvailable) {
        // Get today's step count
        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const pastStepCountResult = await Pedometer.getStepCountAsync(start, end);
        if (pastStepCountResult) {
          updateSteps(pastStepCountResult.steps);
        }

        // Subscribe to real-time updates
        const subscription = Pedometer.watchStepCount(result => {
          updateSteps(result.steps);
        });

        return () => subscription && subscription.remove();
      }
    } catch (error) {
      console.error('歩数計のセットアップに失敗:', error);
      // 🌍 オフライン対応: エラー時はキャッシュデータを使用（既に表示済み）
      setIsPedometerAvailable('error');
    }
  };

  // ヘルスケアからのデータを更新（カロリーと距離も含む）
  const updateHealthData = async (newSteps, healthCalories, healthDistance) => {
    const oldSteps = steps;
    setSteps(newSteps);
    setCalories(healthCalories);
    setDistance(healthDistance);

    const prog = calculateGoalProgress(newSteps, goal);
    setProgress(prog / 100);

    const data = {
      date: getTodayDateString(),
      steps: newSteps,
      calories: healthCalories,
      distance: healthDistance,
      hourlySteps: [],
      goal: goal,
    };

    // Save to storage
    await saveTodayData(data);

    // 🚀 キャッシュにも保存（起動高速化）
    await cacheTodayData(data);

    // 通知の送信
    const settings = await getSettings();
    if (settings.notifications) {
      if (newSteps >= goal && oldSteps < goal) {
        await sendGoalAchievedNotification(newSteps, goal);
      }
      await sendProgressNotification(newSteps, goal);
    }
  };

  // Pedometerからのデータを更新（アプリ内で計算）
  const updateSteps = async (newSteps) => {
    const oldSteps = steps;
    setSteps(newSteps);
    const cal = calculateCalories(newSteps);
    const dist = calculateDistance(newSteps, profile.stride);
    const prog = calculateGoalProgress(newSteps, goal);

    setCalories(cal);
    setDistance(dist);
    setProgress(prog / 100);

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

    // 通知の送信
    const settings = await getSettings();
    if (settings.notifications) {
      if (newSteps >= goal && oldSteps < goal) {
        await sendGoalAchievedNotification(newSteps, goal);
      }
      await sendProgressNotification(newSteps, goal);
    }

    // ヘルスケアへの同期
    const healthSyncEnabled = await getHealthSyncEnabled();
    if (healthSyncEnabled) {
      await saveStepsToHealthKit(newSteps);
    }
  };

  const renderFoodCard = (foodId) => {
    const food = getFoodById(foodId);
    if (!food) return null;

    const amount = calculateFoodAmount(calories, foodId);

    return (
      <TouchableOpacity
        key={foodId}
        style={[
          styles.foodCard,
          { backgroundColor: theme.card, borderColor: theme.border },
          getShadowStyle(theme.isDark)
        ]}
      >
        <Text style={styles.foodEmoji}>{food.emoji}</Text>
        <Text style={[styles.foodAmount, { color: theme.primary }]}>{amount}</Text>
        <Text style={[styles.foodUnit, { color: theme.textSecondary }]}>{food.unit}</Text>
      </TouchableOpacity>
    );
  };

  const isGoalAchieved = progress >= 1.0;
  const progressColor = isGoalAchieved ? theme.success : theme.primary;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* フローティング日付カード */}
      <View style={styles.header}>
        <View style={[styles.dateCard, { backgroundColor: theme.card }, getShadowStyle(theme.isDark)]}>
          <Text style={[styles.dateText, { color: theme.text }]}>{formatDate(getTodayDateString())}</Text>
        </View>
      </View>

      {/* 歩数サークル（リングデザイン） */}
      <View style={styles.circleContainer}>
        <View style={[styles.circleBackground, { backgroundColor: theme.card }, getShadowStyle(theme.isDark)]}>
          <Progress.Circle
            size={200}
            progress={progress}
            showsText={false}
            color={progressColor}
            unfilledColor={theme.circleUnfilled}
            borderWidth={0}
            thickness={12}
          />
          <View style={styles.circleCenter}>
            <Text style={[styles.stepsText, { color: theme.text }]}>{steps.toLocaleString()}</Text>
            <Text style={[styles.stepsLabel, { color: theme.textSecondary }]}>歩</Text>
          </View>
        </View>
      </View>

      {/* 進捗バー（達成時はグリーン） */}
      <View style={styles.progressContainer}>
        <Progress.Bar
          progress={progress}
          width={width - 40}
          height={10}
          color={progressColor}
          unfilledColor={theme.progressUnfilled}
          borderWidth={0}
          borderRadius={5}
        />
        <Text style={[styles.progressText, { color: theme.textSecondary }, isGoalAchieved && { color: theme.success }]}>
          {Math.round(progress * 100)}%
          {isGoalAchieved && ' 🎉'}
        </Text>
      </View>

      {/* カロリー・距離 */}
      <View style={[styles.statsContainer, { backgroundColor: theme.card }, getShadowStyle(theme.isDark)]}>
        <Text style={[styles.statsText, { color: theme.text }]}>
          {calories.toFixed(0)} kcal = {distance.toFixed(2)} km
        </Text>
      </View>

      {/* 食べ物換算 */}
      <View style={styles.foodSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>食べ物換算</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.foodList}>
            {favorites.map(foodId => renderFoodCard(foodId))}
          </View>
        </ScrollView>
      </View>

      {/* デバッグ情報 */}
      {isPedometerAvailable !== 'true' && (
        <View style={[styles.debugContainer, { backgroundColor: theme.isDark ? '#3E2723' : '#FFF3CD' }]}>
          <Text style={[styles.debugText, { color: theme.isDark ? '#FFAB91' : '#856404' }]}>
            歩数計: {isPedometerAvailable === 'checking' ? '確認中...' : '利用不可'}
          </Text>
          <Text style={[styles.debugText, { color: theme.isDark ? '#FFAB91' : '#856404' }]}>
            ※ 実機でテストするか、手動で歩数を追加できます
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  dateCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    letterSpacing: 0.5,
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
  },
  stepsText: {
    fontSize: 56,
    fontWeight: '900',  // 🔍 視認性改善: より太く
    color: '#212121',
    letterSpacing: -1.5,
  },
  stepsLabel: {
    fontSize: 20,
    color: '#757575',  // 🔍 視認性改善: 少し明るく
    marginTop: 4,
    fontWeight: '700',  // 🔍 視認性改善: より太く
  },
  progressContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  progressText: {
    fontSize: 20,  // 🔍 視認性改善: 大きく
    color: '#424242',  // 🔍 視認性改善: コントラストアップ
    marginTop: 12,
    fontWeight: '800',  // 🔍 視認性改善: より太く
  },
  achievedText: {
    color: '#00C853',
  },
  statsContainer: {
    alignItems: 'center',
    marginVertical: 10,
    paddingVertical: 18,  // 🔍 視認性改善: パディング増加
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statsText: {
    fontSize: 20,  // 🔍 視認性改善: 大きく
    color: '#212121',
    fontWeight: '700',  // 🔍 視認性改善: より太く
    letterSpacing: 0.3,
  },
  foodSection: {
    marginTop: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,  // 🔍 視認性改善: 大きく
    fontWeight: '800',  // 🔍 視認性改善: より太く
    color: '#212121',
    marginLeft: 20,
    marginBottom: 15,
    letterSpacing: 0.3,
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
});
