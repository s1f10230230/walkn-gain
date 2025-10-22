// プッシュ通知ユーティリティ
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 通知の動作設定
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * 通知の権限をリクエスト
 * @returns {Promise<boolean>} 権限が付与されたらtrue
 */
export const requestNotificationPermissions = async () => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('通知の権限が拒否されました');
      return false;
    }

    // Androidの通知チャンネル設定
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4CAF50',
      });
    }

    return true;
  } catch (error) {
    console.error('通知権限のリクエストエラー:', error);
    return false;
  }
};

/**
 * 即座に通知を送信
 * @param {string} title タイトル
 * @param {string} body 本文
 * @param {object} data 追加データ
 */
export const sendImmediateNotification = async (title, body, data = {}) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // 即座に送信
    });
  } catch (error) {
    console.error('通知送信エラー:', error);
  }
};

/**
 * 目標達成時の通知
 * @param {number} steps 達成した歩数
 * @param {number} goal 目標歩数
 */
export const sendGoalAchievedNotification = async (steps, goal) => {
  const title = '🎉 目標達成！';
  const body = `おめでとうございます！${goal.toLocaleString()}歩を達成しました！`;
  const data = { type: 'goal_achieved', steps, goal };

  await sendImmediateNotification(title, body, data);
};

/**
 * マイルストーン達成時の通知
 * @param {number} steps 達成した歩数
 */
export const sendMilestoneNotification = async (steps) => {
  const milestones = [5000, 10000, 15000, 20000];
  const milestone = milestones.find(m => m === steps);

  if (milestone) {
    const title = `🚶 ${milestone.toLocaleString()}歩達成！`;
    const body = 'いい調子です！この調子で頑張りましょう！';
    const data = { type: 'milestone', steps: milestone };

    await sendImmediateNotification(title, body, data);
  }
};

/**
 * リマインダー通知をスケジュール
 * @param {number} hour 時間（0-23）
 * @param {number} minute 分（0-59）
 */
export const scheduleReminderNotification = async (hour = 20, minute = 0) => {
  try {
    // 既存のリマインダーをキャンセル
    await cancelReminderNotifications();

    // 毎日指定時刻に通知
    const trigger = {
      hour,
      minute,
      repeats: true,
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚶 歩いていますか？',
        body: '今日の目標達成のために、少し歩いてみませんか？',
        data: { type: 'reminder' },
        sound: true,
      },
      trigger,
      identifier: 'daily_reminder',
    });

    console.log(`リマインダー通知を設定しました: ${hour}:${minute}`);
  } catch (error) {
    console.error('リマインダー通知の設定エラー:', error);
  }
};

/**
 * リマインダー通知をキャンセル
 */
export const cancelReminderNotifications = async () => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const reminderNotifications = scheduled.filter(
      n => n.identifier === 'daily_reminder'
    );

    for (const notification of reminderNotifications) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  } catch (error) {
    console.error('リマインダー通知のキャンセルエラー:', error);
  }
};

/**
 * すべての通知をキャンセル
 */
export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('すべての通知をキャンセルしました');
  } catch (error) {
    console.error('通知のキャンセルエラー:', error);
  }
};

/**
 * 通知タップのリスナーを設定
 * @param {function} callback コールバック関数
 * @returns {object} サブスクリプション
 */
export const setupNotificationListeners = (callback) => {
  // 通知がタップされた時
  const subscription = Notifications.addNotificationResponseReceivedListener(
    response => {
      const data = response.notification.request.content.data;
      console.log('通知がタップされました:', data);
      if (callback) {
        callback(data);
      }
    }
  );

  return subscription;
};

/**
 * 励ましメッセージを取得
 * @param {number} progress 進捗率（0-100）
 * @returns {string} 励ましメッセージ
 */
export const getEncouragementMessage = (progress) => {
  if (progress >= 100) {
    return '完璧です！目標達成おめでとうございます！🎉';
  } else if (progress >= 80) {
    return 'あと少しで目標達成です！頑張りましょう！💪';
  } else if (progress >= 50) {
    return 'いい調子です！半分を超えました！🚶';
  } else if (progress >= 25) {
    return '順調です！この調子で続けましょう！👍';
  } else if (progress > 0) {
    return 'まだまだこれから！歩き始めましょう！🌟';
  } else {
    return '今日も元気に歩きましょう！✨';
  }
};

/**
 * 進捗に応じた通知を送信
 * @param {number} steps 現在の歩数
 * @param {number} goal 目標歩数
 */
export const sendProgressNotification = async (steps, goal) => {
  const progress = (steps / goal) * 100;
  const message = getEncouragementMessage(progress);

  if (progress >= 50 && progress < 51) {
    // 50%達成時
    await sendImmediateNotification(
      '🎯 半分達成！',
      message,
      { type: 'progress', progress: 50 }
    );
  } else if (progress >= 80 && progress < 81) {
    // 80%達成時
    await sendImmediateNotification(
      '🔥 もう少し！',
      message,
      { type: 'progress', progress: 80 }
    );
  }
};
