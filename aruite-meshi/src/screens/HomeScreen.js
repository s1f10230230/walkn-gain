import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Pedometer } from 'expo-sensors';
import * as Progress from 'react-native-progress';
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
import { getFoodById, calculateFoodAmount } from '../data/foodDatabase';
import { initializeHealthKit, getTodaySteps, saveStepsToHealthKit } from '../utils/healthKit';
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

  useEffect(() => {
    loadData();
    setupPedometer();
    initializeApp();
  }, []);

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
      const initialized = await initializeHealthKit();
      if (initialized) {
        console.log('ヘルスケア連携が有効化されました');
        // ヘルスケアから歩数を取得
        const healthSteps = await getTodaySteps();
        if (healthSteps > 0) {
          updateSteps(healthSteps);
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
  };

  const updateSteps = async (newSteps) => {
    const oldSteps = steps;
    setSteps(newSteps);
    const cal = calculateCalories(newSteps);
    const dist = calculateDistance(newSteps, profile.stride);
    const prog = calculateGoalProgress(newSteps, goal);

    setCalories(cal);
    setDistance(dist);
    setProgress(prog / 100);

    // Save to storage
    await saveTodayData({
      date: getTodayDateString(),
      steps: newSteps,
      calories: cal,
      distance: dist,
      hourlySteps: [], // TODO: Implement hourly tracking
      goal: goal,
    });

    // 通知の送信
    const settings = await getSettings();
    if (settings.notifications) {
      // 目標達成時の通知
      if (newSteps >= goal && oldSteps < goal) {
        await sendGoalAchievedNotification(newSteps, goal);
      }

      // 進捗通知（50%、80%）
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
      <TouchableOpacity key={foodId} style={styles.foodCard}>
        <Text style={styles.foodEmoji}>{food.emoji}</Text>
        <Text style={styles.foodAmount}>{amount}</Text>
        <Text style={styles.foodUnit}>{food.unit}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.dateText}>{formatDate(getTodayDateString())}</Text>
      </View>

      {/* 歩数サークル */}
      <View style={styles.circleContainer}>
        <Progress.Circle
          size={200}
          progress={progress}
          showsText={false}
          color="#FF8C42"
          unfilledColor="#E0E0E0"
          borderWidth={0}
          thickness={15}
        />
        <View style={styles.circleCenter}>
          <Text style={styles.stepsText}>{steps.toLocaleString()}</Text>
          <Text style={styles.stepsLabel}>歩</Text>
        </View>
      </View>

      {/* 進捗バー */}
      <View style={styles.progressContainer}>
        <Progress.Bar
          progress={progress}
          width={width - 40}
          height={8}
          color="#FF8C42"
          unfilledColor="#E0E0E0"
          borderWidth={0}
        />
        <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
      </View>

      {/* カロリー・距離 */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {calories.toFixed(0)} kcal = {distance.toFixed(2)} km
        </Text>
      </View>

      {/* 食べ物換算 */}
      <View style={styles.foodSection}>
        <Text style={styles.sectionTitle}>食べ物換算</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.foodList}>
            {favorites.map(foodId => renderFoodCard(foodId))}
          </View>
        </ScrollView>
      </View>

      {/* デバッグ情報 */}
      {isPedometerAvailable !== 'true' && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            歩数計: {isPedometerAvailable === 'checking' ? '確認中...' : '利用不可'}
          </Text>
          <Text style={styles.debugText}>
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
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    position: 'relative',
  },
  circleCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
  },
  stepsLabel: {
    fontSize: 20,
    color: '#666',
    marginTop: 5,
  },
  progressContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  progressText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  statsContainer: {
    alignItems: 'center',
    marginVertical: 10,
    paddingVertical: 15,
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    borderRadius: 10,
  },
  statsText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
  foodSection: {
    marginTop: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 20,
    marginBottom: 15,
  },
  foodList: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  foodCard: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 20,
    marginRight: 15,
    alignItems: 'center',
    width: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  foodEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  foodAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  foodUnit: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
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
