// バックグラウンド歩数チェックタスク
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStepsToday } from '../utils/healthKit';
import { sendImmediateNotification, getEncouragementMessage } from '../utils/notifications';
import { getUserProfile, getSettings } from '../utils/storage';
import { calculateCalories } from '../utils/calculations';

const BACKGROUND_STEPS_TASK = 'background-steps-check';
const LAST_NOTIFICATION_KEY = 'lastGoalNotification';
const NOTIFICATION_COOLDOWN = 3600000; // 1時間（ミリ秒）

// バックグラウンドタスクの定義
TaskManager.defineTask(BACKGROUND_STEPS_TASK, async () => {
  try {
    console.log('[BackgroundTask] バックグラウンド歩数チェック開始');

    // 設定を確認
    const settings = await getSettings();
    if (!settings?.notificationsEnabled) {
      console.log('[BackgroundTask] 通知が無効化されています');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // HealthKitから今日の歩数を取得
    const todaySteps = await getStepsToday();
    console.log('[BackgroundTask] 今日の歩数:', todaySteps);

    if (!todaySteps || todaySteps === 0) {
      console.log('[BackgroundTask] 歩数データなし');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // ユーザープロファイルを取得
    const profile = await getUserProfile();
    const goalSteps = profile?.goalSteps || 10000;
    const weight = profile?.weight || 60;

    // 目標達成チェック
    const progress = (todaySteps / goalSteps) * 100;
    const calories = calculateCalories(todaySteps, weight);

    // 通知のクールダウンチェック
    const lastNotifTime = await AsyncStorage.getItem(LAST_NOTIFICATION_KEY);
    const now = Date.now();
    if (lastNotifTime && (now - parseInt(lastNotifTime, 10)) < NOTIFICATION_COOLDOWN) {
      console.log('[BackgroundTask] 通知クールダウン中');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 目標達成時の通知
    if (progress >= 100) {
      await sendImmediateNotification(
        '目標達成！',
        `${todaySteps.toLocaleString()}歩達成しました！${calories.toFixed(0)}kcal消費`,
        { type: 'goal_achieved', steps: todaySteps }
      );
      await AsyncStorage.setItem(LAST_NOTIFICATION_KEY, now.toString());
      console.log('[BackgroundTask] 目標達成通知を送信');
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    // 進捗に応じた励ましの通知（50%, 75%, 90%）
    const milestones = [50, 75, 90];
    for (const milestone of milestones) {
      const milestoneKey = `milestone_${milestone}_${new Date().toISOString().split('T')[0]}`;
      const alreadySent = await AsyncStorage.getItem(milestoneKey);

      if (progress >= milestone && !alreadySent) {
        const message = getEncouragementMessage(progress, todaySteps, goalSteps);
        await sendImmediateNotification(
          `目標の${milestone}%達成！`,
          message,
          { type: 'milestone', progress: milestone, steps: todaySteps }
        );
        await AsyncStorage.setItem(milestoneKey, 'sent');
        console.log(`[BackgroundTask] ${milestone}%マイルストーン通知を送信`);
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }
    }

    console.log('[BackgroundTask] 新しい通知なし');
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[BackgroundTask] エラー:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// バックグラウンドタスクの登録
export async function registerBackgroundStepsTask() {
  try {
    // iOS のみサポート
    if (Platform.OS !== 'ios') {
      console.log('[BackgroundTask] iOSのみサポート');
      return false;
    }

    // タスクが既に登録されているかチェック
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEPS_TASK);
    if (isRegistered) {
      console.log('[BackgroundTask] 既に登録済み');
      return true;
    }

    // バックグラウンドフェッチを登録
    await BackgroundFetch.registerTaskAsync(BACKGROUND_STEPS_TASK, {
      minimumInterval: 60 * 15, // 15分（最小間隔）
      stopOnTerminate: false, // アプリ終了時も継続
      startOnBoot: true, // デバイス起動時に開始
    });

    console.log('[BackgroundTask] バックグラウンドタスクを登録しました');
    return true;
  } catch (error) {
    console.error('[BackgroundTask] 登録エラー:', error);
    return false;
  }
}

// バックグラウンドタスクの解除
export async function unregisterBackgroundStepsTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEPS_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_STEPS_TASK);
      console.log('[BackgroundTask] バックグラウンドタスクを解除しました');
    }
    return true;
  } catch (error) {
    console.error('[BackgroundTask] 解除エラー:', error);
    return false;
  }
}

// バックグラウンドタスクのステータスを確認
export async function getBackgroundTaskStatus() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEPS_TASK);
    const status = await BackgroundFetch.getStatusAsync();

    const statusMap = {
      [BackgroundFetch.BackgroundFetchStatus.Restricted]: 'Restricted',
      [BackgroundFetch.BackgroundFetchStatus.Denied]: 'Denied',
      [BackgroundFetch.BackgroundFetchStatus.Available]: 'Available',
    };

    return {
      isRegistered,
      status: statusMap[status] || 'Unknown',
      statusCode: status,
    };
  } catch (error) {
    console.error('[BackgroundTask] ステータス確認エラー:', error);
    return {
      isRegistered: false,
      status: 'Error',
      error: error.message,
    };
  }
}
