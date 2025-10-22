// ヘルスケア連携ユーティリティ（Apple Health & Google Fit）
import { Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';
import GoogleFit from 'react-native-google-fit';

// ヘルスケアの権限設定
const PERMISSIONS = {
  ios: {
    permissions: {
      read: [
        AppleHealthKit.Constants.Permissions.Steps,
        AppleHealthKit.Constants.Permissions.StepCount,
        AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
        AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      ],
      write: [
        AppleHealthKit.Constants.Permissions.Steps,
        AppleHealthKit.Constants.Permissions.StepCount,
      ],
    },
  },
  android: {
    scopes: [
      GoogleFit.Scopes.FITNESS_ACTIVITY_READ,
      GoogleFit.Scopes.FITNESS_ACTIVITY_WRITE,
      GoogleFit.Scopes.FITNESS_LOCATION_READ,
    ],
  },
};

/**
 * ヘルスケアの初期化と権限取得
 * @returns {Promise<boolean>} 成功したらtrue
 */
export const initializeHealthKit = async () => {
  try {
    if (Platform.OS === 'ios') {
      return new Promise((resolve, reject) => {
        AppleHealthKit.initHealthKit(PERMISSIONS.ios, (error, results) => {
          if (error) {
            console.error('Apple Health初期化エラー:', error);
            resolve(false);
            return;
          }
          console.log('Apple Health初期化成功:', results);
          resolve(true);
        });
      });
    } else if (Platform.OS === 'android') {
      const result = await GoogleFit.authorize(PERMISSIONS.android);
      console.log('Google Fit初期化:', result);
      return result.success;
    }
    return false;
  } catch (error) {
    console.error('ヘルスケア初期化エラー:', error);
    return false;
  }
};

/**
 * 今日の歩数を取得
 * @returns {Promise<number>} 歩数
 */
export const getTodaySteps = async () => {
  try {
    if (Platform.OS === 'ios') {
      return new Promise((resolve, reject) => {
        const options = {
          date: new Date().toISOString(),
          includeManuallyAdded: true,
        };

        AppleHealthKit.getStepCount(options, (error, results) => {
          if (error) {
            console.error('Apple Health歩数取得エラー:', error);
            resolve(0);
            return;
          }
          resolve(results.value || 0);
        });
      });
    } else if (Platform.OS === 'android') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const options = {
        startDate: today.toISOString(),
        endDate: new Date().toISOString(),
      };

      const result = await GoogleFit.getDailyStepCountSamples(options);

      if (result && result.length > 0) {
        // Google Fitからの最新データを取得
        const latestSource = result.find(
          source => source.source === 'com.google.android.gms:estimated_steps'
        ) || result[0];

        if (latestSource.steps && latestSource.steps.length > 0) {
          return latestSource.steps[latestSource.steps.length - 1].value || 0;
        }
      }
      return 0;
    }
    return 0;
  } catch (error) {
    console.error('歩数取得エラー:', error);
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
    if (Platform.OS === 'ios') {
      return new Promise((resolve, reject) => {
        const options = {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          includeManuallyAdded: true,
        };

        AppleHealthKit.getDailyStepCountSamples(options, (error, results) => {
          if (error) {
            console.error('Apple Health期間歩数取得エラー:', error);
            resolve([]);
            return;
          }

          // データを整形
          const formattedData = results.map(item => ({
            date: item.startDate.split('T')[0],
            steps: item.value,
          }));

          resolve(formattedData);
        });
      });
    } else if (Platform.OS === 'android') {
      const options = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        bucketUnit: 'DAY',
        bucketInterval: 1,
      };

      const result = await GoogleFit.getDailyStepCountSamples(options);

      if (result && result.length > 0) {
        const source = result.find(
          s => s.source === 'com.google.android.gms:estimated_steps'
        ) || result[0];

        if (source.steps) {
          return source.steps.map(item => ({
            date: new Date(item.date).toISOString().split('T')[0],
            steps: item.value,
          }));
        }
      }
      return [];
    }
    return [];
  } catch (error) {
    console.error('期間歩数取得エラー:', error);
    return [];
  }
};

/**
 * 歩数データを書き込む（同期用）
 * @param {number} steps 歩数
 * @param {Date} date 日付
 * @returns {Promise<boolean>} 成功したらtrue
 */
export const saveStepsToHealthKit = async (steps, date = new Date()) => {
  try {
    if (Platform.OS === 'ios') {
      return new Promise((resolve, reject) => {
        const options = {
          value: steps,
          startDate: date.toISOString(),
          endDate: date.toISOString(),
        };

        AppleHealthKit.saveSteps(options, (error, results) => {
          if (error) {
            console.error('Apple Health歩数保存エラー:', error);
            resolve(false);
            return;
          }
          console.log('Apple Health歩数保存成功:', results);
          resolve(true);
        });
      });
    } else if (Platform.OS === 'android') {
      const options = {
        value: steps,
        date: date.toISOString(),
        startDate: date.toISOString(),
        endDate: date.toISOString(),
      };

      const result = await GoogleFit.saveSteps(options);
      return result;
    }
    return false;
  } catch (error) {
    console.error('歩数保存エラー:', error);
    return false;
  }
};

/**
 * カロリーデータを取得
 * @param {Date} startDate 開始日
 * @param {Date} endDate 終了日
 * @returns {Promise<number>} 消費カロリー
 */
export const getCalories = async (startDate, endDate) => {
  try {
    if (Platform.OS === 'ios') {
      return new Promise((resolve, reject) => {
        const options = {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        };

        AppleHealthKit.getActiveEnergyBurned(options, (error, results) => {
          if (error) {
            console.error('Apple Healthカロリー取得エラー:', error);
            resolve(0);
            return;
          }

          const totalCalories = results.reduce((sum, item) => sum + item.value, 0);
          resolve(totalCalories);
        });
      });
    } else if (Platform.OS === 'android') {
      const options = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      const result = await GoogleFit.getDailyCalorieSamples(options);

      if (result && result.length > 0) {
        const totalCalories = result.reduce((sum, item) => sum + (item.calorie || 0), 0);
        return totalCalories;
      }
      return 0;
    }
    return 0;
  } catch (error) {
    console.error('カロリー取得エラー:', error);
    return 0;
  }
};

/**
 * 距離データを取得
 * @param {Date} startDate 開始日
 * @param {Date} endDate 終了日
 * @returns {Promise<number>} 距離（メートル）
 */
export const getDistance = async (startDate, endDate) => {
  try {
    if (Platform.OS === 'ios') {
      return new Promise((resolve, reject) => {
        const options = {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        };

        AppleHealthKit.getDistanceWalkingRunning(options, (error, results) => {
          if (error) {
            console.error('Apple Health距離取得エラー:', error);
            resolve(0);
            return;
          }

          const totalDistance = results.reduce((sum, item) => sum + item.value, 0);
          resolve(totalDistance);
        });
      });
    } else if (Platform.OS === 'android') {
      const options = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      const result = await GoogleFit.getDailyDistanceSamples(options);

      if (result && result.length > 0) {
        const totalDistance = result.reduce((sum, item) => sum + (item.distance || 0), 0);
        return totalDistance;
      }
      return 0;
    }
    return 0;
  } catch (error) {
    console.error('距離取得エラー:', error);
    return 0;
  }
};

/**
 * ヘルスケアが利用可能かチェック
 * @returns {Promise<boolean>}
 */
export const isHealthKitAvailable = async () => {
  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      AppleHealthKit.isAvailable((error, available) => {
        if (error) {
          console.error('Apple Health利用可否チェックエラー:', error);
          resolve(false);
          return;
        }
        resolve(available);
      });
    });
  } else if (Platform.OS === 'android') {
    try {
      const available = await GoogleFit.isAvailable();
      return available;
    } catch (error) {
      console.error('Google Fit利用可否チェックエラー:', error);
      return false;
    }
  }
  return false;
};
