// 歩数計ユーティリティ（Expo Pedometer使用）
import { Pedometer } from 'expo-sensors';
import { toDateKeyLocal } from './calculations';
import { Platform, PermissionsAndroid } from 'react-native';

/**
 * 歩数計が利用可能かチェック
 * @returns {Promise<boolean>}
 */
export const isPedometerAvailable = async () => {
  try {
    const isAvailable = await Pedometer.isAvailableAsync();
    return isAvailable;
  } catch (error) {
    console.error('歩数計の利用可否チェックエラー:', error);
    return false;
  }
};

/**
 * Android用のACTIVITY_RECOGNITION権限をリクエスト
 * @returns {Promise<boolean>}
 */
const requestAndroidActivityPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    // Android 10 (API 29) 以上で必要
    if (Platform.Version >= 29) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
        {
          title: '歩数計の権限',
          message: '歩数を計測するために、身体活動の認識権限が必要です。',
          buttonNeutral: '後で',
          buttonNegative: 'キャンセル',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  } catch (error) {
    console.error('Android権限リクエストエラー:', error);
    return false;
  }
};

/**
 * 歩数計の権限をリクエスト
 * @returns {Promise<boolean>}
 */
export const requestPedometerPermissions = async () => {
  try {
    // Androidの場合、先にACTIVITY_RECOGNITION権限をリクエスト
    if (Platform.OS === 'android') {
      const androidPermission = await requestAndroidActivityPermission();
      if (!androidPermission) {
        console.log('Android ACTIVITY_RECOGNITION権限が拒否されました');
        return false;
      }
    }

    // Expo Pedometerの権限をリクエスト
    const { status } = await Pedometer.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('歩数計の権限リクエストエラー:', error);
    return false;
  }
};

/**
 * 今日の歩数を取得
 * @returns {Promise<number>} 歩数
 */
export const getTodaySteps = async () => {
  try {
    const isAvailable = await isPedometerAvailable();
    if (!isAvailable) {
      console.log('歩数計が利用できません');
      return 0;
    }

    // 今日の開始時刻（午前0時）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const now = new Date();
    const result = await Pedometer.getStepCountAsync(today, now);

    return result.steps || 0;
  } catch (error) {
    console.error('今日の歩数取得エラー:', error);
    return 0;
  }
};

/**
 * 指定期間の歩数データを取得
 * @param {Date} startDate 開始日
 * @param {Date} endDate 終了日
 * @returns {Promise<Array>} 日別歩数データの配列
 */
export const getStepsInRange = async (startDate, endDate) => {
  try {
    const isAvailable = await isPedometerAvailable();
    if (!isAvailable) {
      return [];
    }

    // 日ごとのデータを取得
    const data = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      try {
        const result = await Pedometer.getStepCountAsync(dayStart, dayEnd);
        data.push({
          date: toDateKeyLocal(currentDate),
          steps: result.steps || 0,
        });
      } catch (error) {
        console.error(`${currentDate.toDateString()}の歩数取得エラー:`, error);
        data.push({
          date: toDateKeyLocal(currentDate),
          steps: 0,
        });
      }

      // 次の日へ
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return data;
  } catch (error) {
    console.error('期間歩数取得エラー:', error);
    return [];
  }
};

/**
 * リアルタイム歩数更新のリスナーを設定
 * @param {Function} callback 歩数が更新されたときに呼ばれるコールバック関数
 * @returns {Object} サブスクリプションオブジェクト（remove()メソッドでリスナー解除）
 */
export const watchStepCount = (callback) => {
  try {
    const subscription = Pedometer.watchStepCount(result => {
      callback(result.steps || 0);
    });

    return subscription;
  } catch (error) {
    console.error('歩数監視エラー:', error);
    return { remove: () => {} };
  }
};

/**
 * 歩数から距離を推定（メートル）
 * 平均歩幅: 約0.7m（成人の平均）
 * @param {number} steps 歩数
 * @returns {number} 距離（メートル）
 */
export const estimateDistance = (steps) => {
  const averageStepLength = 0.7; // メートル
  return steps * averageStepLength;
};

/**
 * 歩数から消費カロリーを推定
 * 平均: 1歩あたり約0.04kcal（体重60kgの成人の場合）
 * @param {number} steps 歩数
 * @param {number} weight 体重（kg）デフォルト60kg
 * @returns {number} 消費カロリー（kcal）
 */
export const estimateCalories = (steps, weight = 60) => {
  // 1歩あたりの消費カロリー = 体重(kg) × 0.0007
  const caloriesPerStep = weight * 0.0007;
  return Math.round(steps * caloriesPerStep);
};

/**
 * 歩数計の初期化（互換性のため）
 * @returns {Promise<boolean>}
 */
export const initializePedometer = async () => {
  try {
    const isAvailable = await isPedometerAvailable();
    if (!isAvailable) {
      console.log('歩数計が利用できません');
      return false;
    }

    const hasPermission = await requestPedometerPermissions();
    if (!hasPermission) {
      console.log('歩数計の権限が許可されていません');
      return false;
    }

    console.log('歩数計の初期化成功');
    return true;
  } catch (error) {
    console.error('歩数計の初期化エラー:', error);
    return false;
  }
};
