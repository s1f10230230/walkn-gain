// ヘルスケア連携ユーティリティ（Apple Health & Google Fit）
import { Platform, Alert, AppState, NativeModules } from 'react-native';
import GoogleFit from 'react-native-google-fit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSettings, getUserProfile, getDailyData, saveDailyData } from './storage';
import { calculateCalories, calculateDistance } from './calculations';
import { sendGoalAchievedNotification, sendImmediateNotification, getEncouragementMessage } from './notifications';

// HealthKit Constantsをハードコード（ライブラリのインポートエラーを回避）
const HealthKitConstants = {
  Permissions: {
    ActiveEnergyBurned: 'ActiveEnergyBurned',
    DistanceWalkingRunning: 'DistanceWalkingRunning',
    StepCount: 'StepCount',
    Steps: 'Steps',
  },
  Units: {
    gram: 'gram',
    kilogram: 'kilogram',
    pound: 'pound',
    meter: 'meter',
    kilometer: 'kilometer',
    mile: 'mile',
    joule: 'joule',
    kilocalorie: 'kilocalorie',
    count: 'count',
  },
  // 背景配信の更新頻度（react-native-healthが提供するものに合わせる）
  UpdateFrequency: {
    IMMEDIATE: 'immediate',
    HOURLY: 'hourly',
    DAILY: 'daily',
    WEEKLY: 'weekly',
  },
};

// react-native-healthライブラリをインポート
// 複数の方法を試して最も確実な方法を使用
let AppleHealthKit = null;
let healthKitLoadMethod = 'none';

// デバッグ/切り分け用: Pedometerフォールバックを一時停止（iOSのみ）
const DISABLE_PEDOMETER_FALLBACK = true;

try {
  console.log('🔵 [healthKit.js] HealthKit読み込み開始...');

  // 方法1: NativeModulesから直接取得（最も確実）
  const { AppleHealthKit: DirectHealthKit } = NativeModules;

  if (DirectHealthKit && DirectHealthKit.initHealthKit) {
    console.log('✅ [healthKit.js] NativeModules.AppleHealthKit found');
    console.log('🔵 [healthKit.js] Available methods:', Object.keys(DirectHealthKit).slice(0, 15).join(', '));

    // Constantsを手動で追加（ライブラリのインポートエラーを回避）
    AppleHealthKit = Object.assign({}, DirectHealthKit, {
      Constants: HealthKitConstants,
    });
    healthKitLoadMethod = 'nativeModules';
    console.log('✅ [healthKit.js] Using NativeModules directly (Method 1)');
  } else {
    console.log('⚠️ [healthKit.js] NativeModules.AppleHealthKit not found, trying library wrapper...');

    // 方法2: ライブラリのラッパー経由（フォールバック）
    const RNHealth = require('react-native-health');
    console.log('🔵 [healthKit.js] react-native-health loaded:', {
      hasDefault: !!RNHealth.default,
      hasHealthKit: !!RNHealth.HealthKit,
      keys: Object.keys(RNHealth).slice(0, 10)
    });

    AppleHealthKit = RNHealth.default || RNHealth.HealthKit || RNHealth;

    if (AppleHealthKit && AppleHealthKit.initHealthKit) {
      // Constantsが欠けている場合は追加
      if (!AppleHealthKit.Constants || !AppleHealthKit.Constants.Permissions) {
        AppleHealthKit.Constants = HealthKitConstants;
        console.log('🔵 [healthKit.js] Added missing Constants to wrapper');
      }
      healthKitLoadMethod = 'wrapper';
      console.log('✅ [healthKit.js] Using library wrapper (Method 2)');
    } else {
      console.error('❌ [healthKit.js] Both NativeModule and library wrapper failed');
      console.error('❌ [healthKit.js] Available NativeModules:', Object.keys(NativeModules).filter(k => k.toLowerCase().includes('health')));
    }
  }
} catch (error) {
  console.error('❌ [healthKit.js] HealthKit module initialization error:', error);
  console.error('❌ [healthKit.js] Error message:', error.message);
  AppleHealthKit = null;
}

// 最終チェック
if (AppleHealthKit && AppleHealthKit.initHealthKit) {
  console.log(`✅ [healthKit.js] HealthKit successfully loaded via ${healthKitLoadMethod}`);
  console.log(`✅ [healthKit.js] Constants available:`, !!AppleHealthKit.Constants?.Permissions);
} else {
  console.error('❌ [healthKit.js] HealthKit initialization failed - module or initHealthKit not available');
  console.error('❌ [healthKit.js] This is expected in Expo Go or development without native modules');
}

// iOSの権限設定を安全に取得
const getIOSPermissions = () => {
  try {
    // ライブラリのバージョン差異により Steps / StepCount のどちらかしか
    // 存在しない場合があるため、存在確認しつつ配列を整形する
    const perms = AppleHealthKit?.Constants?.Permissions || {};
    const stepRead = perms.StepCount || perms.Steps;
    const stepWrite = perms.StepCount || perms.Steps;

    const read = [
      stepRead,
      perms.DistanceWalkingRunning,
      perms.ActiveEnergyBurned,
    ].filter(Boolean);

    // このアプリではHealthKitへの歩数書き込みは現状未使用のため、
    // 権限ダイアログの簡素化と審査リスク低減のためwriteは空にする
    const write = [];

    return {
      permissions: { read, write },
    };
  } catch (error) {
    console.error('iOS権限設定の取得エラー:', error);
    return { permissions: { read: [], write: [] } };
  }
};

// Androidの権限設定を安全に取得
const getAndroidPermissions = () => {
  try {
    // GoogleFit.Scopesが存在するか確認
    if (GoogleFit && GoogleFit.Scopes) {
      return {
        scopes: [
          GoogleFit.Scopes.FITNESS_ACTIVITY_READ,
          GoogleFit.Scopes.FITNESS_ACTIVITY_WRITE,
          GoogleFit.Scopes.FITNESS_LOCATION_READ,
        ],
      };
    } else {
      console.warn('GoogleFit.Scopesが利用できません。デフォルト値を使用します。');
      return {
        scopes: [
          'https://www.googleapis.com/auth/fitness.activity.read',
          'https://www.googleapis.com/auth/fitness.activity.write',
          'https://www.googleapis.com/auth/fitness.location.read',
        ],
      };
    }
  } catch (error) {
    console.error('Android権限設定の取得エラー:', error);
    return { scopes: [] };
  }
};

// ヘルスケアの権限設定
const PERMISSIONS = {
  ios: getIOSPermissions(),
  android: getAndroidPermissions(),
};

// 初期化の多重実行を防止
let hkInitPromise = null;
const waitForAppActive = async () => {
  try {
    if (AppState.currentState === 'active') return;
    await new Promise((resolve) => {
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          try { sub.remove?.(); } catch (_) {}
          resolve();
        }
      });
    });
  } catch (_) {}
};

/**
 * ヘルスケアの初期化と権限取得
 * ハイブリッド戦略: 精度の高いHealthKitをメイン、Pedometerをフォールバックとして使用
 * @returns {Promise<boolean>} 成功したらtrue
 */
export const initializeHealthKit = async (showAlert = false) => {
  if (hkInitPromise) return hkInitPromise;
  hkInitPromise = (async () => {
  try {
    // iOSの権限ダイアログはアプリがactiveの時に要求するのが安定
    await waitForAppActive();
    if (Platform.OS === 'ios') {
      try {
        console.log('HealthKit permissions (iOS):', JSON.stringify(PERMISSIONS.ios));
      } catch (_) {}
      // iOSの場合はApple HealthKitを使用（実機のみ）
      if (!AppleHealthKit || !AppleHealthKit.initHealthKit) {
        console.log('ℹ️ HealthKit: 開発ビルドで利用可能（Pedometerで代替動作中）');
        if (showAlert) {
          Alert.alert(
            'HealthKit未同梱のビルド',
            'このビルドにはHealthKitのネイティブ実装が含まれていない可能性があります。\n\n・Expo GoではHealthKitは使用できません\n・開発クライアント（EAS development）またはTestFlightの本番ビルドで確認してください\n・Apple DeveloperのApp IDでHealthKitを有効化してから再ビルドしてください'
          );
        }
        return false;
      }

      return new Promise((resolve) => {
        // 端末で利用可能か
        if (AppleHealthKit.isAvailable) {
          try {
            AppleHealthKit.isAvailable((err, ok) => {
              console.log('HealthKit.isAvailable:', err ? `error: ${err?.message || String(err)}` : ok);
            });
          } catch (_) {}
        }
        AppleHealthKit.initHealthKit(PERMISSIONS.ios, (error, results) => {
          if (error) {
            console.error('❌ Apple Health初期化エラー:', error);
            console.error('エラーの詳細:', JSON.stringify(error, null, 2));
            if (showAlert) {
              let msg = 'ヘルスケアの接続に失敗しました。';
              try {
                const details = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
                if (details) msg += `\n\n詳細: ${details}`;
              } catch (_) {}
              Alert.alert('HealthKit 初期化エラー', msg);
            }
            resolve(false);
            return;
          }
          console.log('✅ Apple Health初期化成功:', results);

          // 権限状態を確認
          checkHealthKitPermissions();

          if (showAlert) {
            try {
              const summary = typeof results === 'object' ? JSON.stringify(results) : String(results);
              Alert.alert('HealthKit 初期化', `接続に成功しました。\n\n${summary || ''}`);
            } catch (_) {
              Alert.alert('HealthKit 初期化', '接続に成功しました。');
            }
          }

          resolve(true);
        });
      });
    } else if (Platform.OS === 'android') {
      // AndroidでExpo Goを使用している場合はスキップ
      if (!GoogleFit || !GoogleFit.authorize) {
        console.warn('Google Fitが利用できません（開発ビルドが必要です）');
        return false;
      }

      const result = await GoogleFit.authorize(PERMISSIONS.android);
      console.log('Google Fit初期化:', result);
      return result?.success === true;
    }
    return false;
  } catch (error) {
    console.error('ヘルスケア初期化エラー:', error);
    return false;
  }
  })();
  const ok = await hkInitPromise.catch(() => false);
  // 失敗時は次回再試行できるようにプロミスをリセット
  if (!ok) hkInitPromise = null;
  return ok;
};

/**
 * HealthKitの権限状態を確認（デバッグ用）
 */
export const checkHealthKitPermissions = () => {
  if (Platform.OS !== 'ios' || !AppleHealthKit) {
    return;
  }

  try {
    if (AppleHealthKit.getAuthStatus) {
      AppleHealthKit.getAuthStatus(PERMISSIONS.ios, (err, status) => {
        if (err) {
          console.log('⚠️ HealthKit権限状態取得エラー:', err);
          return;
        }
        try {
          console.log('📋 HealthKit 権限状態:', JSON.stringify(status));
        } catch (_) {
          console.log('📋 HealthKit 権限状態(簡易):', status);
        }
      });
    }
  } catch (error) {
    console.log('権限状態チェックエラー:', error);
  }
};

/**
 * HealthKit の診断情報を表示（未同梱/API可用性/権限状態など）
 */
export const diagnoseHealthKit = async (showAlert = true) => {
  try {
    const lines = [];
    lines.push(`Platform: ${Platform.OS}`);
    lines.push(`Load method: ${healthKitLoadMethod}`);

    const hasModule = !!AppleHealthKit;
    const hasInit = !!AppleHealthKit?.initHealthKit;
    lines.push(`AppleHealthKit module: ${hasModule ? 'present' : 'missing'}`);
    lines.push(`initHealthKit: ${hasInit ? 'present' : 'missing'}`);

    // NativeModulesの診断
    try {
      const allModules = Object.keys(NativeModules);
      const healthRelated = allModules.filter(k => k.toLowerCase().includes('health'));
      lines.push(`Total NativeModules: ${allModules.length}`);
      lines.push(`Health-related modules: ${healthRelated.length > 0 ? healthRelated.join(', ') : 'none'}`);
      lines.push(`NativeModules.AppleHealthKit: ${NativeModules.AppleHealthKit ? 'exists' : 'missing'}`);
    } catch (e) {
      lines.push(`NativeModules check error: ${e.message}`);
    }

    // react-native-health ライブラリの状態
    try {
      const RNHealth = require('react-native-health');
      lines.push(`RNHealth.default: ${RNHealth.default ? 'exists' : 'missing'}`);
      lines.push(`RNHealth.HealthKit: ${RNHealth.HealthKit ? 'exists' : 'missing'}`);
    } catch (e) {
      lines.push(`RNHealth import error: ${e.message}`);
    }

    // isAvailable
    let available = 'n/a';
    if (hasModule && AppleHealthKit.isAvailable) {
      available = await new Promise((resolve) => {
        try {
          AppleHealthKit.isAvailable((err, ok) => {
            if (err) return resolve(`error: ${err?.message || String(err)}`);
            resolve(ok ? 'true' : 'false');
          });
        } catch (e) {
          resolve(`error: ${e?.message || String(e)}`);
        }
      });
    }
    lines.push(`HealthKit.isAvailable: ${available}`);

    // Permissions constants existence
    const perms = AppleHealthKit?.Constants?.Permissions || {};
    lines.push(`Permissions constants: StepCount=${perms.StepCount ? 'ok' : 'missing'}, Steps=${perms.Steps ? 'ok' : 'missing'}, DistanceWalkingRunning=${perms.DistanceWalkingRunning ? 'ok' : 'missing'}, ActiveEnergyBurned=${perms.ActiveEnergyBurned ? 'ok' : 'missing'}`);

    // 現在の権限配列（read/write）
    try {
      if (AppleHealthKit?.getAuthStatus) {
        const auth = await new Promise((resolve) =>
          AppleHealthKit.getAuthStatus(PERMISSIONS.ios, (err, res) => resolve(err ? { error: String(err) } : res))
        );
        lines.push(`AuthStatus(read): ${JSON.stringify(auth?.permissions?.read)}`);
        lines.push(`AuthStatus(write): ${JSON.stringify(auth?.permissions?.write)}`);
      } else {
        lines.push('AuthStatus: method not available');
      }
    } catch (e) {
      lines.push(`AuthStatus error: ${e?.message || String(e)}`);
    }

    const text = lines.join('\n');
    console.log('🧪 HealthKit診断\n' + text);
    if (showAlert) Alert.alert('HealthKit 診断', text);
    return text;
  } catch (e) {
    const errorMsg = `HealthKit 診断エラー: ${e?.message || String(e)}`;
    console.log(errorMsg);
    if (showAlert) Alert.alert('HealthKit 診断エラー', e?.message || String(e));
    return errorMsg;
  }
};

// =============================
// 背景配信（iOS / HealthKit）
// =============================
const PROGRESS_STATE_KEY = 'hk_progress_state';

const getTodayKey = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const loadProgressState = async () => {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_STATE_KEY);
    if (!raw) return { date: getTodayKey(), sent: [] };
    const parsed = JSON.parse(raw);
    if (parsed.date !== getTodayKey()) {
      return { date: getTodayKey(), sent: [] };
    }
    return { date: parsed.date || getTodayKey(), sent: Array.isArray(parsed.sent) ? parsed.sent : [] };
  } catch (e) {
    return { date: getTodayKey(), sent: [] };
  }
};

const saveProgressState = async (state) => {
  try {
    await AsyncStorage.setItem(PROGRESS_STATE_KEY, JSON.stringify(state));
  } catch (_) {}
};

const processBackgroundStepUpdate = async () => {
  try {
    // 今日の歩数を取得
    if (!AppleHealthKit || !AppleHealthKit.getStepCount) return;
    const options = { date: new Date().toISOString(), includeManuallyAdded: true };
    const steps = await new Promise((resolve) => {
      try {
        AppleHealthKit.getStepCount(options, (error, results) => {
          if (error) return resolve(0);
          resolve(results?.value || 0);
        });
      } catch (e) {
        resolve(0);
      }
    });

    // 目標・通知設定を取得
    const settings = await getSettings();
    // 通知がOFFなら何もしない（統一ポリシー）
    if (!settings?.notifications) return;
    const goal = settings?.dailyGoal || 10000;

    if (!goal || goal <= 0) return;

    // 進捗
    const progress = (steps / goal) * 100;

    // 単発通知のための状態
    const state = await loadProgressState();
    const sent = new Set(state.sent);

    // 50%/80%/100%の閾値を跨いだときのみ通知
    const milestones = [50, 80, 100];
    for (const m of milestones) {
      if (progress >= m && !sent.has(m)) {
        if (m === 100) {
          await sendGoalAchievedNotification(steps, goal);
        } else if (m === 50) {
          const title = '🎯 半分達成！';
          const body = getEncouragementMessage(progress);
          await sendImmediateNotification(title, body, { type: 'progress', progress: m });
        } else if (m === 80) {
          const title = '🔥 もう少し！';
          const body = getEncouragementMessage(progress);
          await sendImmediateNotification(title, body, { type: 'progress', progress: m });
        }
        sent.add(m);
      }
    }

    const nextState = { date: getTodayKey(), sent: Array.from(sent) };
    await saveProgressState(nextState);
  } catch (error) {
    console.error('HealthKit 背景更新処理エラー:', error);
  }
};

let hkBgDeliveryEnabled = false;
let hkObserverSet = false;
export const startStepsBackgroundUpdates = async () => {
  try {
    if (Platform.OS !== 'ios') return false;
    if (!AppleHealthKit) return false;

    // 背景配信の有効化
    if (!hkBgDeliveryEnabled && AppleHealthKit.enableBackgroundDelivery) {
      try {
        const freq = AppleHealthKit?.Constants?.UpdateFrequency?.HOURLY || 'hourly';
        await new Promise((resolve) => {
          AppleHealthKit.enableBackgroundDelivery(
            'StepCount',
            freq,
            (err, ok) => {
              if (err) {
                console.warn('enableBackgroundDelivery エラー:', err);
              }
              resolve(!err && ok);
            }
          );
        });
        hkBgDeliveryEnabled = true;
        console.log('✅ 背景配信を有効化しました');
      } catch (e) {
        console.warn('enableBackgroundDelivery が利用できません', e);
      }
    }

    // オブザーバの設定（更新イベントで呼び出し）
    if (!hkObserverSet && AppleHealthKit.setObserver) {
      try {
        AppleHealthKit.setObserver({ type: 'StepCount' }, () => {
          processBackgroundStepUpdate();
        });
        hkObserverSet = true;
      } catch (e) {
        console.warn('HealthKit setObserver の設定に失敗', e);
      }
    }

    // 起動直後にも一度処理
    await processBackgroundStepUpdate();
    return true;
  } catch (error) {
    console.error('背景更新の開始に失敗:', error);
    return false;
  }
};

export const stopStepsBackgroundUpdates = async () => {
  try {
    if (Platform.OS !== 'ios') return true;
    if (!AppleHealthKit) return true;
    if (AppleHealthKit.disableBackgroundDelivery) {
      try {
        await new Promise((resolve) => {
          AppleHealthKit.disableBackgroundDelivery('StepCount', () => resolve(true));
        });
      } catch (e) {
        console.warn('disableBackgroundDelivery 失敗', e);
      }
    }
    return true;
  } catch (error) {
    console.error('背景更新の停止に失敗:', error);
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
      if (!AppleHealthKit || !AppleHealthKit.getStepCount) {
        console.warn('Apple HealthKit getStepCountが利用できません');
        return 0;
      }

      return new Promise((resolve) => {
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
      if (!GoogleFit || !GoogleFit.getDailyStepCountSamples) {
        console.warn('Google Fit getDailyStepCountSamplesが利用できません');
        return 0;
      }

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
      const useDailySamples = typeof AppleHealthKit?.getDailyStepCountSamples === 'function';

      // 最強フォールバック: Rawサンプルを取得してローカル日付で集計
      const aggregateRawSamples = async () => {
        try {
          const hasGetSamplesForType = typeof AppleHealthKit?.getSamplesForType === 'function';
          const hasGetSamples = typeof AppleHealthKit?.getSamples === 'function';
          if (!hasGetSamplesForType && !hasGetSamples) return null;

          const options = {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            type: 'StepCount',
            ascending: true,
            includeManuallyAdded: true,
          };

          const samples = await new Promise((resolve) => {
            try {
              const cb = (err, res) => {
                if (err) return resolve(null);
                resolve(Array.isArray(res) ? res : []);
              };
              if (hasGetSamplesForType) {
                AppleHealthKit.getSamplesForType(options, cb);
              } else if (hasGetSamples) {
                AppleHealthKit.getSamples(options, cb);
              }
            } catch (_) {
              resolve(null);
            }
          });

          if (!samples) return null;
          // ローカル日付キーで合算
          const byDate = new Map();
          for (const it of samples) {
            try {
              const d = it?.startDate || it?.endDate || it?.date;
              const val = Number(it?.value ?? it?.quantity ?? it?.count ?? 0);
              if (!d || !Number.isFinite(val)) continue;
              const dd = new Date(d);
              const y = dd.getFullYear();
              const m = String(dd.getMonth() + 1).padStart(2, '0');
              const day = String(dd.getDate()).padStart(2, '0');
              const key = `${y}-${m}-${day}`;
              byDate.set(key, (byDate.get(key) || 0) + val);
            } catch (_) {}
          }
          const out = Array.from(byDate.entries())
            .sort((a, b) => (a[0] > b[0] ? 1 : -1))
            .map(([date, steps]) => ({ date, steps }));
          return out;
        } catch (e) {
          return null;
        }
      };

      // フォールバック: getDailyStepCountSamples が無い/エラー時は日ごとに getStepCount を呼ぶ
      const fallbackByDay = async () => {
        try {
          const out = [];
          const cur = new Date(startDate);
          cur.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          while (cur <= end) {
            const dayKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
            const dayEnd = new Date(cur);
            dayEnd.setHours(23, 59, 59, 999);
            const steps = await new Promise((resolve) => {
              try {
                AppleHealthKit.getStepCount({ date: dayEnd.toISOString(), includeManuallyAdded: true }, (err, res) => {
                  if (err) return resolve(0);
                  resolve(res?.value || 0);
                });
              } catch (_) {
                resolve(0);
              }
            });
            out.push({ date: dayKey, steps });
            // 軽いウェイト（連続呼び出しの安定化）
            try { await new Promise((r) => setTimeout(r, 25)); } catch (_) {}
            // 次の日へ
            cur.setDate(cur.getDate() + 1);
            cur.setHours(0, 0, 0, 0);
          }
          return out;
        } catch (e) {
          console.error('Apple Health日別フォールバック取得エラー:', e);
          return [];
        }
      };

      // まずRawサンプル合算を試す
      const raw = await aggregateRawSamples();
      if (Array.isArray(raw) && raw.length > 0) return raw;

      if (!useDailySamples) {
        console.log('Apple Health getDailyStepCountSamples が未定義のため、日別フォールバックで取得します');
        return await fallbackByDay();
      }

      // 通常パス: 日別サンプルAPI
      const results = await new Promise((resolve) => {
        const options = {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          period: 1440, // 1日 = 1440分
          includeManuallyAdded: true,
        };
        try {
          AppleHealthKit.getDailyStepCountSamples(options, (error, res) => {
            if (error) {
              console.warn('Apple Health期間歩数取得エラー。フォールバックに切り替えます:', error);
              return resolve(null);
            }
            resolve(res || []);
          });
        } catch (e) {
          console.warn('Apple Health期間歩数取得例外。フォールバックに切り替えます:', e);
          resolve(null);
        }
      });

      if (!Array.isArray(results)) {
        return await fallbackByDay();
      }

      const formattedData = results.map(item => ({
        date: (item.startDate || '').split('T')[0],
        steps: item.value,
      }));
      return formattedData;
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
  try {
    if (Platform.OS === 'ios') {
      if (!AppleHealthKit) {
        console.warn('Apple HealthKitモジュールが見つかりません');
        return false;
      }

      // 一部の環境では isAvailable がエクスポートされない場合がある。
      // その場合でも initializeHealthKit が成功していれば実アクセス可能なことが多いため、
      // ここでは「利用可能」とみなして先に進める（偽陰性回避）。
      if (typeof AppleHealthKit.isAvailable !== 'function') {
        console.log('Apple Health isAvailable が未定義のため、利用可能とみなします');
        return true;
      }

      return new Promise((resolve) => {
        AppleHealthKit.isAvailable((error, available) => {
          if (error) {
            console.error('Apple Health利用可否チェックエラー:', error);
            // エラー時も保守的に「利用可能」とみなして先に進める（初期化が通っていれば多くは動作する）
            resolve(true);
            return;
          }
          resolve(available);
        });
      });
    } else if (Platform.OS === 'android') {
      if (!GoogleFit || !GoogleFit.isAvailable) {
        console.warn('Google Fitが利用できません');
        return false;
      }

      const available = GoogleFit.isAvailable();
      return available;
    }
    return false;
  } catch (error) {
    console.error('ヘルスケア利用可否チェックエラー:', error);
    return false;
  }
};

// =============================
// ハイブリッド歩数取得（HealthKit優先、Pedometer フォールバック）
// =============================

/**
 * ハイブリッド歩数取得: HealthKitを優先、失敗時はPedometerにフォールバック
 * @param {Date} startDate 開始日時（省略時は今日の0時）
 * @param {Date} endDate 終了日時（省略時は現在）
 * @returns {Promise<{steps: number, source: 'healthkit'|'pedometer'|'none'}>}
 */
export const getStepsHybrid = async (startDate = null, endDate = null) => {
  // デフォルト値の設定
  if (!startDate) {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  }
  if (!endDate) {
    endDate = new Date();
  }

  // まずHealthKitを試す
  try {
    if (Platform.OS === 'ios' && AppleHealthKit) {
      // 同日かどうかをチェック
      const isSameDay = startDate.toDateString() === endDate.toDateString();

      if (isSameDay) {
        // 同日の場合は getStepCount で高速取得
        const steps = await new Promise((resolve) => {
          const options = {
            date: endDate.toISOString(),
            includeManuallyAdded: true,
          };

          AppleHealthKit.getStepCount(options, (error, results) => {
            if (error) {
              console.log('HealthKit歩数取得失敗、Pedometerにフォールバック:', error);
              resolve(null);
              return;
            }
            resolve(results?.value || 0);
          });
        });

        if (steps !== null) {
          console.log('✓ HealthKitから歩数取得 (当日):', steps);
          return { steps, source: 'healthkit' };
        }
      } else {
        // 範囲指定の場合は getDailyStepCountSamples で取得
        const stepsData = await new Promise((resolve) => {
          const options = {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            period: 1440, // 1日 = 1440分
            includeManuallyAdded: true,
          };

          AppleHealthKit.getDailyStepCountSamples(options, (error, results) => {
            if (error) {
              console.log('HealthKit期間歩数取得失敗、Pedometerにフォールバック:', error);
              resolve(null);
              return;
            }
            // 全日の合計を計算
            const total = results.reduce((sum, day) => sum + (day.value || 0), 0);
            resolve(total);
          });
        });

        if (stepsData !== null) {
          console.log('✓ HealthKitから歩数取得 (期間):', stepsData);
          return { steps: stepsData, source: 'healthkit' };
        }
      }
    } else if (Platform.OS === 'android' && GoogleFit) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const options = {
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        bucketUnit: 'DAY',
        bucketInterval: 1,
      };

      const result = await GoogleFit.getDailyStepCountSamples(options);

      if (result && result.length > 0) {
        const src = result.find(
          source => source.source === 'com.google.android.gms:estimated_steps'
        ) || result[0];

        if (src.steps && src.steps.length > 0) {
          // setHours は元のDateオブジェクトを変更するため、新しいDateインスタンスを作成
          const sTime = new Date(s).setHours(0, 0, 0, 0);
          const eTime = new Date(e).setHours(23, 59, 59, 999);
          const toTime = (item) => {
            // item.date or item.startDate/endDate depending on library version
            const d = item.date || item.endDate || item.startDate;
            return d ? new Date(d).getTime() : NaN;
          };
          const steps = src.steps.reduce((acc, item) => {
            const t = toTime(item);
            if (Number.isFinite(t) && t >= sTime && t <= eTime) {
              return acc + (item.value || 0);
            }
            return acc;
          }, 0);
          console.log('✓ Google Fitから歩数取得 (範囲適用):', steps);
          return { steps, source: 'googlefit' };
        }
      }
    }
  } catch (error) {
    console.log('HealthKit取得エラー、Pedometerにフォールバック:', error);
  }

  // HealthKit失敗時、Pedometerにフォールバック
  try {
    // 切り分け用にフォールバックを止めたい場合
    if (Platform.OS === 'ios' && DISABLE_PEDOMETER_FALLBACK) {
      return { steps: 0, source: 'none' };
    }
    // Pedometerをインポート（動的）
    const { Pedometer } = require('expo-sensors');
    const isAvailable = await Pedometer.isAvailableAsync();

    if (isAvailable) {
      const result = await Pedometer.getStepCountAsync(startDate, endDate);
      const steps = result?.steps || 0;
      console.log('✓ Pedometerから歩数取得（フォールバック）:', steps);
      return { steps, source: 'pedometer' };
    }
  } catch (error) {
    console.error('Pedometer取得エラー:', error);
  }

  // 両方失敗
  console.warn('⚠ 歩数取得失敗（HealthKit & Pedometer）');
  return { steps: 0, source: 'none' };
};

// =============================
// 過去データのインポート機能
// =============================

const HISTORICAL_IMPORT_KEY = 'healthkit_historical_import_completed';
const HISTORICAL_IMPORT_DATE_KEY = 'healthkit_historical_import_date';

/**
 * 過去データのインポートが完了しているかチェック
 * @returns {Promise<boolean>}
 */
export const isHistoricalImportCompleted = async () => {
  try {
    const completed = await AsyncStorage.getItem(HISTORICAL_IMPORT_KEY);
    return completed === 'true';
  } catch (error) {
    console.error('インポート状態チェックエラー:', error);
    return false;
  }
};

/**
 * 過去データのインポート完了をマーク
 * @returns {Promise<void>}
 */
export const markHistoricalImportCompleted = async () => {
  try {
    await AsyncStorage.setItem(HISTORICAL_IMPORT_KEY, 'true');
    await AsyncStorage.setItem(HISTORICAL_IMPORT_DATE_KEY, new Date().toISOString());
  } catch (error) {
    console.error('インポート完了マークエラー:', error);
  }
};

/**
 * 過去データのインポートをリセット（再インポート用）
 * @returns {Promise<void>}
 */
export const resetHistoricalImport = async () => {
  try {
    await AsyncStorage.removeItem(HISTORICAL_IMPORT_KEY);
    await AsyncStorage.removeItem(HISTORICAL_IMPORT_DATE_KEY);
  } catch (error) {
    console.error('インポートリセットエラー:', error);
  }
};

/**
 * HealthKit/Google Fitから過去データをインポートしてローカルストレージに保存
 * @param {number} daysBack インポートする過去の日数（デフォルト: 30日）
 * @param {Function} onProgress 進捗コールバック (current, total) => void
 * @returns {Promise<{success: boolean, importedDays: number, errors: Array}>}
 */
export const importHistoricalData = async (daysBack = 30, onProgress = null) => {
  try {
    console.log(`過去${daysBack}日分のデータをインポート開始...`);

    // HealthKitが利用可能かチェック
    const available = await isHealthKitAvailable();
    if (!available) {
      // 一部環境で偽陰性があるため、警告のみ出して続行（実アクセスで判定）
      console.warn('HealthKitの利用可否チェックがfalseですが、取り込みを試行します');
    }

    // 初期化
    const initialized = await initializeHealthKit();
    if (!initialized) {
      console.warn('HealthKit初期化に失敗したため、インポートをスキップします');
      return { success: false, importedDays: 0, errors: ['HealthKit initialization failed'] };
    }

    // 許可直後はインデックス反映に時間がかかる場合があるため、短い待機を入れる
    try { await new Promise((r) => setTimeout(r, 400)); } catch (_) {}

    // インポート期間を計算
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    // 欲しい開始日（直近 daysBack 日）
    const desiredStart = new Date();
    desiredStart.setDate(desiredStart.getDate() - daysBack);
    desiredStart.setHours(0, 0, 0, 0);

    // 既知の回避策: 開始日をさらに1ヶ月（30日）前倒しして取得し、あとで直近 daysBack 日だけ抽出
    const queryStart = new Date(desiredStart);
    queryStart.setDate(queryStart.getDate() - 30);
    queryStart.setHours(0, 0, 0, 0);

    // 期間のデータを取得（前倒し期間で取得）
    let historicalSteps = await getStepsInRange(queryStart, endDate);
    try {
      // 直近 daysBack 日だけに絞り込み
      const cutoff = desiredStart.toISOString().split('T')[0];
      historicalSteps = (historicalSteps || [])
        .filter(d => (d?.date || '') >= cutoff)
        .sort((a, b) => (a.date > b.date ? 1 : -1));
    } catch (_) {}

    if (!historicalSteps || historicalSteps.length === 0) {
      console.log('インポートするデータがありません');
      return { success: true, importedDays: 0, errors: [] };
    }

    console.log(`${historicalSteps.length}日分のデータを取得しました`);

    // ローカルストレージに保存（既存のstorageユーティリティを使用）
    const errors = [];
    let importedCount = 0;

    const settings = await getSettings();
    const profile = await getUserProfile();
    const weight = profile?.weight || 65;
    const stride = profile?.stride || 72;

    for (let i = 0; i < historicalSteps.length; i++) {
      const dayData = historicalSteps[i];

      try {
        // 進捗通知
        if (onProgress) {
          onProgress(i + 1, historicalSteps.length);
        }

        // 既存データを確認（既存の保存形式を使用）
        const existing = await getDailyData(dayData.date);
        if (existing && typeof existing.steps === 'number' && existing.steps >= (dayData.steps || 0)) {
          console.log(`${dayData.date}: 既存データを保持（${existing.steps} >= ${dayData.steps}）`);
          continue;
        }

        // 既存形式に合わせて計算（kcal / km）
        const steps = Number(dayData.steps || 0);
        const calories = Math.round(calculateCalories(steps, weight));
        const distance = calculateDistance(steps, stride); // km

        const dataToSave = {
          ...(existing || {}),
          date: dayData.date,
          steps,
          calories,
          distance,
          goal: settings?.dailyGoal || 10000,
          importedFromHealthKit: true,
          importedAt: new Date().toISOString(),
        };

        await saveDailyData(dayData.date, dataToSave);
        importedCount++;

        console.log(`${dayData.date}: ${dayData.steps}歩をインポート`);
      } catch (error) {
        console.error(`${dayData.date}のインポートエラー:`, error);
        errors.push({ date: dayData.date, error: error.message });
      }
    }

    // インポート完了をマーク
    await markHistoricalImportCompleted();

    console.log(`インポート完了: ${importedCount}/${historicalSteps.length}日`);

    return {
      success: true,
      importedDays: importedCount,
      totalDays: historicalSteps.length,
      errors: errors,
    };
  } catch (error) {
    console.error('過去データインポートエラー:', error);
    return {
      success: false,
      importedDays: 0,
      errors: [error.message],
    };
  }
};

/**
 * 今日の歩数を取得（バックグラウンドタスク用）
 * @returns {Promise<number>} 今日の歩数
 */
export const getStepsToday = async () => {
  try {
    if (Platform.OS !== 'ios' || !AppleHealthKit) {
      console.warn('[getStepsToday] HealthKit not available');
      return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const now = new Date();

    return new Promise((resolve) => {
      const options = {
        date: now.toISOString(),
        includeManuallyAdded: true,
      };

      AppleHealthKit.getStepCount(options, (err, results) => {
        if (err) {
          console.error('[getStepsToday] Error:', err);
          resolve(0);
          return;
        }
        const steps = results?.value || 0;
        console.log('[getStepsToday] Steps:', steps);
        resolve(steps);
      });
    });
  } catch (error) {
    console.error('[getStepsToday] Exception:', error);
    return 0;
  }
};
