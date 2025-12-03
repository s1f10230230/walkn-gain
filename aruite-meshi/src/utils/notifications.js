// プッシュ通知ユーティリティ
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRANSLATIONS } from '../i18n/translations';
import { getSettings, saveSettings } from './storage';
import { getTodayDateString } from './calculations';

// 内部的に使用するストレージキー（機能は変えずに内部の安定性を向上）
const STORAGE_KEYS = {
  DAILY_REMINDER_ID: 'notifications_daily_reminder_id',
  PROGRESS_STATE: 'notifications_progress_state', // { date: 'YYYY-MM-DD', count: number, lastTs: number }
  PERSISTENT_ID: 'persistent_widget_notification_id',
};

// 通知の動作設定
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Expo SDKの仕様に従い、フォアグラウンドでもアラートを表示
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// --- i18n helpers for non-React modules ---
const SUPPORTED = ['ja', 'en', 'zh-Hans'];
const mapToSupported = (raw) => {
  if (!raw) return 'ja';
  const lower = String(raw).toLowerCase();
  if (lower.startsWith('ja')) return 'ja';
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('zh')) return 'zh-Hans';
  return 'ja';
};

const detectSystemLocale = () => {
  try {
    const loc = Intl?.DateTimeFormat?.().resolvedOptions().locale;
    return mapToSupported(loc);
  } catch (e) {
    return 'ja';
  }
};

const getNested = (obj, path) => path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);

const getLocale = async () => {
  try {
    const s = await getSettings();
    const choice = s?.language && s.language !== 'auto' ? s.language : detectSystemLocale();
    return SUPPORTED.includes(choice) ? choice : 'ja';
  } catch (e) {
    return 'ja';
  }
};

const tAsync = async (key, params = {}) => {
  const locale = await getLocale();
  const dict = TRANSLATIONS[locale] || TRANSLATIONS.ja;
  const val = getNested(dict, key);
  if (!val) return key;
  if (typeof val === 'string') {
    return val.replace(/\{(\w+)\}/g, (_, p1) => (params[p1] != null ? String(params[p1]) : ''));
  }
  // if array/object, not suitable for notification content directly
  return String(val);
};

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
      try {
        const s = await getSettings();
        await saveSettings({ ...s, notifications: false });
      } catch (_) {}
      return false;
    }

    // Androidの通知チャンネル設定
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF7043',
      });
    }

    // アプリ設定の通知トグルも同期
    try {
      const s = await getSettings();
      await saveSettings({ ...s, notifications: true });
    } catch (_) {}

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
    const content = {
      title,
      body,
      data,
      sound: true,
    };

    // Time Sensitiveは使用しない（審査リスク回避）

    await Notifications.scheduleNotificationAsync({
      content,
      trigger: null, // 即座に送信
    });
  } catch (error) {
    console.error('通知送信エラー:', error);
  }
};

// 進捗通知のクールダウン＆1日上限（アプリ全体で共有）
const PROGRESS_CD_MS = 30 * 60 * 1000; // 30分
const PROGRESS_DAILY_MAX = 2; // 1日最大2件

const getProgressState = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PROGRESS_STATE);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

const saveProgressState = async (state) => {
  try { await AsyncStorage.setItem(STORAGE_KEYS.PROGRESS_STATE, JSON.stringify(state)); } catch (_) {}
};

export const canSendProgressNotification = async () => {
  const today = getTodayDateString();
  const now = Date.now();
  const state = (await getProgressState()) || { date: today, count: 0, lastTs: 0 };
  if (state.date !== today) {
    // 新しい日
    return true;
  }
  // クールダウン
  if (state.lastTs && now - state.lastTs < PROGRESS_CD_MS) return false;
  // 1日上限
  if (state.count >= PROGRESS_DAILY_MAX) return false;
  return true;
};

export const markProgressNotificationSent = async () => {
  const today = getTodayDateString();
  const now = Date.now();
  const state = (await getProgressState()) || { date: today, count: 0, lastTs: 0 };
  if (state.date !== today) {
    await saveProgressState({ date: today, count: 1, lastTs: now });
  } else {
    await saveProgressState({ date: today, count: (state.count || 0) + 1, lastTs: now });
  }
};

/**
 * 目標達成時の通知
 * @param {number} steps 達成した歩数
 * @param {number} goal 目標歩数
 */
export const sendGoalAchievedNotification = async (steps, goal) => {
  const title = await tAsync('notifications.goalAchieved.title');
  const body = await tAsync('notifications.goalAchieved.body', { goal });
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
    const title = await tAsync('notifications.milestone.title', { steps: milestone });
    const body = await tAsync('notifications.milestone.body');
    const data = { type: 'milestone', steps: milestone };

    await sendImmediateNotification(title, body, data);
  }
};

/**
 * リマインダー通知をスケジュール
 * @param {number} hour 時間（0-23）
 * @param {number} minute 分（0-59）
 */
export const scheduleReminderNotification = async (hour = 20, minute = 30) => {
  try {
    // 既存のスケジュールを確認（既にある場合は再スケジュールしない）
    const savedId = await AsyncStorage.getItem(STORAGE_KEYS.DAILY_REMINDER_ID);
    if (savedId) {
      // 既存のスケジュールが有効かチェック
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const existingReminder = scheduled.find(n => n.identifier === savedId);

      if (existingReminder) {
        // 既にスケジュール済みなので何もしない
        return;
      }
    }

    // 既存のリマインダーをキャンセル（念のため）
    await cancelReminderNotifications();

    // カレンダー形式のトリガー（毎日繰り返し、次の該当時刻から開始）
    const trigger = {
      hour,
      minute,
      repeats: true,
    };

    const title = await tAsync('notifications.reminder.title');
    const body = await tAsync('notifications.reminder.body');

    const content = {
      title,
      body,
      data: { type: 'reminder' },
      sound: true,
    };

    // Time Sensitiveは使用しない（審査リスク回避）

    const identifier = await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    });

    // 後で確実にキャンセルできるようにIDを保存
    await AsyncStorage.setItem(STORAGE_KEYS.DAILY_REMINDER_ID, identifier);
  } catch (error) {
    console.error('リマインダー通知の設定エラー:', error);
  }
};

/**
 * リマインダー通知をキャンセル
 */
export const cancelReminderNotifications = async () => {
  try {
    // まず保存済みのIDがあればそれをキャンセル
    const savedId = await AsyncStorage.getItem(STORAGE_KEYS.DAILY_REMINDER_ID);
    if (savedId) {
      await Notifications.cancelScheduledNotificationAsync(savedId);
      await AsyncStorage.removeItem(STORAGE_KEYS.DAILY_REMINDER_ID);
      return;
    }

    // フォールバック: すべてのスケジュールを確認し、data.type === 'reminder' をキャンセル
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      const isReminder = n?.content?.data?.type === 'reminder';
      if (isReminder && n?.identifier) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
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
  // Note: This function remains synchronous for compatibility.
  // It returns Japanese by default; notification entrypoints fetch i18n asynchronously.
  if (progress >= 100) return '完璧です！目標達成おめでとうございます！🎉';
  if (progress >= 80) return 'あと少しで目標達成です！頑張りましょう！💪';
  if (progress >= 50) return 'いい調子です！半分を超えました！🚶';
  if (progress >= 25) return '順調です！この調子で続けましょう！👍';
  if (progress > 0) return 'まだまだこれから！歩き始めましょう！🌟';
  return '今日も元気に歩きましょう！✨';
};

/**
 * 進捗に応じた通知を送信
 * @param {number} steps 現在の歩数
 * @param {number} goal 目標歩数
 */
export const sendProgressNotification = async (steps, goal) => {
  const progress = (steps / goal) * 100;
  let bodyKey = 'notifications.encouragement.zero';
  if (progress >= 100) bodyKey = 'notifications.encouragement.perfect';
  else if (progress >= 80) bodyKey = 'notifications.encouragement.near';
  else if (progress >= 50) bodyKey = 'notifications.encouragement.half';
  else if (progress >= 25) bodyKey = 'notifications.encouragement.quarter';
  else if (progress > 0) bodyKey = 'notifications.encouragement.start';
  const message = await tAsync(bodyKey);

  // バランスポリシー：80%のみ（50%は送らない）。100%は別途 sendGoalAchievedNotification で通知。
  if (progress >= 80) {
    if (await canSendProgressNotification()) {
      await sendImmediateNotification(await tAsync('notifications.progress.nearTitle'), message, { type: 'progress', progress: 80 });
      await markProgressNotificationSent();
    }
  }
};

// =============================
// 常駐型通知ウィジェット（Uber Eats配達員アプリ風）
// =============================

const PERSISTENT_NOTIFICATION_ID = 'persistent_widget_notification';

/**
 * 常駐型の進捗通知を表示・更新
 * 通知センターに固定表示され、歩数が更新されるたびに内容が更新される
 * @param {number} steps 現在の歩数
 * @param {number} goal 目標歩数
 * @param {number} calories 消費カロリー
 * @param {string} nextFoodName 次の食べ物目標名
 * @param {number} nextFoodCalories 次の食べ物に必要な残りカロリー
 */
export const updatePersistentWidget = async (steps, goal, calories, nextFoodName = null, nextFoodCalories = null) => {
  try {
    const progress = Math.min(Math.round((steps / goal) * 100), 100);
    const progressBar = '━'.repeat(Math.floor(progress / 10)) + '　'.repeat(10 - Math.floor(progress / 10));

    // 次の目標情報
    let nextGoalText = '';
    if (nextFoodName && nextFoodCalories > 0) {
      nextGoalText = `\n🍜 次: ${nextFoodName} (あと${Math.round(nextFoodCalories)}kcal)`;
    }

    const title = '👟 今日の歩数';
    const body = `${progressBar} ${progress}%\n${steps.toLocaleString()} / ${goal.toLocaleString()}歩\n🔥 ${Math.round(calories)} kcal消費${nextGoalText}`;

    // 既存の常駐通知を更新（音なし）
    try {
      const savedId = await AsyncStorage.getItem(STORAGE_KEYS.PERSISTENT_ID);
      if (savedId) {
        await Notifications.dismissNotificationAsync(savedId);
      }
    } catch (_) {}

    const newId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'persistent_widget',
          steps,
          goal,
          calories,
          progress,
        },
        sound: false, // 音なし
        sticky: true, // Android: スワイプで消せない
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        categoryIdentifier: 'widget', // iOS: 通知カテゴリ
      },
      trigger: null, // 即座に表示
    });
    try { await AsyncStorage.setItem(STORAGE_KEYS.PERSISTENT_ID, newId); } catch (_) {}
    console.log(`📊 ウィジェット更新: ${steps}歩 (${progress}%)`);
  } catch (error) {
    console.error('常駐型通知の更新エラー:', error);
  }
};

/**
 * 常駐型通知を削除
 */
export const dismissPersistentWidget = async () => {
  try {
    const savedId = await AsyncStorage.getItem(STORAGE_KEYS.PERSISTENT_ID);
    if (savedId) {
      await Notifications.dismissNotificationAsync(savedId);
      await AsyncStorage.removeItem(STORAGE_KEYS.PERSISTENT_ID);
    }
    console.log('📊 ウィジェットを削除しました');
  } catch (error) {
    console.error('常駐型通知の削除エラー:', error);
  }
};

/**
 * アプリ起動時の今日の歩数ダイジェストを1日1回だけ送信
 */
// 起動時ダイジェストは廃止（ユーザー体験の簡素化のため）

// =============================
// 年間ランキング更新通知 (Pro限定)
// =============================

const STORAGE_KEYS_RANKING = {
  TOP3_NOTIFIED_TODAY: 'ranking_top3_notified_today', // { date: 'YYYY-MM-DD', rank: number }
};

/**
 * 年間トップ3を更新した場合に通知を送信 (Pro限定)
 * @param {number} currentSteps 今日の歩数
 * @param {Array} topDays 年間トップ3の配列 [{date, steps}, ...]
 * @param {boolean} isPremium Proプランかどうか
 * @returns {Promise<{sent: boolean, rank: number|null}>} 通知を送ったかどうか、ランク
 */
export const sendTop3RankingNotification = async (currentSteps, topDays, isPremium) => {
  try {
    // Pro限定
    if (!isPremium) {
      return { sent: false, rank: null };
    }

    // 既に今日通知済みかチェック
    const today = getTodayDateString();
    const raw = await AsyncStorage.getItem(STORAGE_KEYS_RANKING.TOP3_NOTIFIED_TODAY);
    const notifiedData = raw ? JSON.parse(raw) : null;

    // トップ3のうちどの位置にランクインしているか確認
    const existingTop = topDays.filter(d => d.date !== today);
    let newRank = null;

    // 現在の歩数が何位か判定
    if (currentSteps > 0) {
      if (existingTop.length === 0 || currentSteps > existingTop[0]?.steps) {
        newRank = 1;
      } else if (existingTop.length < 2 || currentSteps > existingTop[1]?.steps) {
        newRank = 2;
      } else if (existingTop.length < 3 || currentSteps > existingTop[2]?.steps) {
        newRank = 3;
      }
    }

    // ランクインしていない場合
    if (!newRank) {
      return { sent: false, rank: null };
    }

    // 同じ日に同じランク以上の通知を既に送った場合はスキップ
    if (notifiedData && notifiedData.date === today && notifiedData.rank <= newRank) {
      return { sent: false, rank: newRank };
    }

    // 通知を送信
    const rankEmojis = ['🥇', '🥈', '🥉'];
    const rankNames = ['1位', '2位', '3位'];
    const title = `${rankEmojis[newRank - 1]} 年間ランキング更新！`;
    const body = await tAsync('notifications.rankingUpdate.body', {
      rank: rankNames[newRank - 1],
      steps: currentSteps.toLocaleString()
    });

    await sendImmediateNotification(title, body, {
      type: 'ranking_update',
      rank: newRank,
      steps: currentSteps
    });

    // 通知済みを記録
    await AsyncStorage.setItem(
      STORAGE_KEYS_RANKING.TOP3_NOTIFIED_TODAY,
      JSON.stringify({ date: today, rank: newRank })
    );

    console.log(`🏆 年間ランキング${newRank}位更新通知を送信: ${currentSteps}歩`);
    return { sent: true, rank: newRank };
  } catch (error) {
    console.error('ランキング通知エラー:', error);
    return { sent: false, rank: null };
  }
};
