import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { useI18n } from '../i18n/I18nProvider';
import {
  getUserProfile,
  saveUserProfile,
  getSettings,
  saveSettings,
  clearAllData,
  getHealthSyncEnabled,
  saveHealthSyncEnabled,
  saveOnboardingComplete,
  saveReminderEnabled,
  getReminderEnabled,
} from '../utils/storage';
import { estimateStrideLength } from '../utils/calculations';
import { initializeHealthKit, startStepsBackgroundUpdates, stopStepsBackgroundUpdates, isHistoricalImportCompleted, importHistoricalData, getHealthKitAuthorizationState, syncPastDaysToStorage, resetHistoricalImport } from '../utils/healthKit';
import { registerBackgroundStepsTask, unregisterBackgroundStepsTask } from '../tasks/backgroundStepsTask';
import { scheduleReminderNotification, cancelReminderNotifications } from '../utils/notifications';
import { UserIcon, TargetIcon, HeartIcon, PenIcon, InfoIcon } from '../components/SettingsIcons';
import { logEvent } from '../utils/analytics';
import { getTheme } from '../utils/theme';
import * as Notifications from 'expo-notifications';
import * as Calendar from 'expo-calendar';
import { Pedometer } from 'expo-sensors';
import { PermissionsAndroid, Linking, Platform } from 'react-native';
import { requestNotificationPermissions } from '../utils/notifications';
import { requestPedometerPermissions } from '../utils/pedometer';

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t, setLocale } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  // "true" / "false" などの文字列も正しい boolean に正規化
  const toBoolean = (v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.toLowerCase() === 'true';
    return !!v;
  };

  // OS権限トグル
  // 通知は「目標設定 > 通知」トグルで統合管理（OS許可もそこで同期）
  const onToggleNotificationsOS = async (value) => {
    if (value) {
      const ok = await requestNotificationPermissions();
      setNotifOSGranted(!!ok);
    } else {
      // OS側はアプリからOFFにできないため、設定アプリを開く
      Alert.alert(t('common.error'), t('settings.helpers.languageHelper') || '端末の設定から変更できます');
      try { await Linking.openSettings(); } catch (_) {}
    }
  };

  const onToggleCalendarOS = async (value) => {
    if (value) {
      try {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        setCalendarOSGranted(status === 'granted');
      } catch (_) {}
    } else {
      Alert.alert(t('common.error'), t('settings.helpers.languageHelper') || '端末の設定から変更できます');
      try { await Linking.openSettings(); } catch (_) {}
    }
  };

  const onToggleMotionOS = async (value) => {
    if (value) {
      const ok = await requestPedometerPermissions();
      setMotionOSGranted(!!ok);
    } else {
      Alert.alert(t('common.error'), t('settings.helpers.languageHelper') || '端末の設定から変更できます');
      try { await Linking.openSettings(); } catch (_) {}
    }
  };

  const [profile, setProfile] = useState({
    height: '170',
    weight: '65',
    stride: '72',
  });
  const [settings, setSettings] = useState({
    dailyGoal: '10000',
    defaultFood: 'ramen',
    notifications: true,
    unit: 'kcal',
    goalCalories: '500',
    language: 'auto',
  });
  const [healthSync, setHealthSync] = useState(false);
  // 位置情報・都市選択はオプトイン外に（非表示）
  // OS権限の状態
  const [notifOSGranted, setNotifOSGranted] = useState(false);
  const [calendarOSGranted, setCalendarOSGranted] = useState(false);
  const [motionOSGranted, setMotionOSGranted] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const userProfile = await getUserProfile();
    const userSettings = await getSettings();
    const healthSyncEnabled = await getHealthSyncEnabled();
    const reminderOn = await getReminderEnabled();
    let healthAuthorized = false;
    try {
      const status = await getHealthKitAuthorizationState();
      healthAuthorized = !!status?.authorized;
    } catch (_) {}

    setProfile({
      height: String(userProfile.height),
      weight: String(userProfile.weight),
      stride: String(userProfile.stride),
    });

    setSettings({
      dailyGoal: String(userSettings.dailyGoal),
      defaultFood: userSettings.defaultFood,
      notifications: toBoolean(userSettings.notifications),
      unit: userSettings.unit,
      goalCalories: String(userSettings.goalCalories ?? '500'),
      language: userSettings.language ?? 'auto',
    });

    setHealthSync(toBoolean(healthSyncEnabled) && healthAuthorized);
    setReminderEnabled(!!reminderOn);
    // 位置情報関連は読み込まない（非表示）

    // OS権限の状態
    try {
      const p = await Notifications.getPermissionsAsync();
      setNotifOSGranted(p?.status === 'granted');
    } catch (_) {}
    try {
      const p = await Calendar.getCalendarPermissionsAsync();
      setCalendarOSGranted(p?.status === 'granted');
    } catch (_) {}
    try {
      if (Platform.OS === 'android') {
        const ok = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
        setMotionOSGranted(!!ok);
      } else {
        const pm = await Pedometer.getPermissionsAsync?.();
        setMotionOSGranted(pm?.status === 'granted');
      }
    } catch (_) {}
  };

  const handleSaveProfile = async () => {
    const profileData = {
      height: parseInt(profile.height) || 170,
      weight: parseInt(profile.weight) || 65,
      stride: parseInt(profile.stride) || 72,
    };

    const success = await saveUserProfile(profileData);
    if (success) {
      Alert.alert(t('common.success'), t('settings.alerts.profileSaved'));
    } else {
      Alert.alert(t('common.error'), t('settings.alerts.saveError'));
    }
  };

  const handleSaveSettings = async () => {
    const MIN_DAILY_GOAL = 1000;
    const MAX_DAILY_GOAL = 50000;
    const dailyGoalNum = parseInt(settings.dailyGoal) || 10000;

    // 目標歩数の範囲チェック
    if (dailyGoalNum < MIN_DAILY_GOAL || dailyGoalNum > MAX_DAILY_GOAL) {
      Alert.alert(
        t('common.error'),
        `目標歩数は${MIN_DAILY_GOAL}〜${MAX_DAILY_GOAL}の範囲で設定してください。`
      );
      return;
    }

    const settingsData = {
      dailyGoal: dailyGoalNum,
      defaultFood: settings.defaultFood,
      notifications: settings.notifications,
      unit: settings.unit,
      goalCalories: parseInt(settings.goalCalories) || 500,
      language: settings.language || 'auto',
    };

    const success = await saveSettings(settingsData);
    if (success) {
      Alert.alert(
        t('common.success'),
        '設定を保存しました。\n\n目標歩数の変更は明日から反映されます。過去に獲得したトロフィーとストリークは変更されません。'
      );
      try { logEvent('settings_changed', { field: 'daily_goal' }); } catch (_) {}
    } else {
      Alert.alert(t('common.error'), t('settings.alerts.saveError'));
    }
  };

  const handleChangeLanguage = async (lang) => {
    const next = { ...settings, language: lang };
    setSettings(next);
    const payload = {
      dailyGoal: parseInt(next.dailyGoal) || 10000,
      defaultFood: next.defaultFood,
      notifications: !!next.notifications,
      unit: next.unit,
      goalCalories: parseInt(next.goalCalories) || 500,
      language: lang,
    };
    const ok = await saveSettings(payload);
    if (ok) {
      setLocale(lang);
      try { logEvent('settings_changed', { field: 'language' }); } catch (_) {}
    } else {
      Alert.alert(t('common.error'), t('settings.alerts.languageSaveError'));
    }
  };

  // 通知トグル：ONにしたらデフォルトでリマインダーもONにする
  const handleAppNotificationsToggle = async (value) => {
    // ON時はOS許可も同時に要求し、拒否ならアプリ設定もOFFに戻す
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        setSettings((s) => ({ ...s, notifications: false }));
        const ok2 = await saveSettings({
          dailyGoal: parseInt(settings.dailyGoal) || 10000,
          defaultFood: settings.defaultFood,
          notifications: false,
          unit: settings.unit,
          goalCalories: parseInt(settings.goalCalories) || 500,
          language: settings.language || 'auto',
        });
        if (!ok2) {
          Alert.alert(t('common.error'), t('settings.alerts.notificationsSaveError'));
        }
        return;
      }
    }

    const next = { ...settings, notifications: value };
    setSettings(next);
    const ok = await saveSettings({
      dailyGoal: parseInt(next.dailyGoal) || 10000,
      defaultFood: next.defaultFood,
      notifications: value,
      unit: next.unit,
      goalCalories: parseInt(next.goalCalories) || 500,
      language: next.language || 'auto',
    });
    if (!ok) {
      Alert.alert(t('common.error'), t('settings.alerts.notificationsSaveError'));
      return;
    }

    // デフォルト動作：通知ONにしたら、リマインダーを自動ON（初回/未設定時）
    if (value) {
      try {
        const hasDailyReminder = await getReminderEnabled();
        if (!hasDailyReminder) {
          await scheduleReminderNotification(20, 30);
          await saveReminderEnabled(true);
          setReminderEnabled(true);
        }
      } catch (_) {}
    }

    try { logEvent('settings_changed', { field: 'notifications' }); } catch (_) {}
  };

  const handleAutoCalculateStride = () => {
    const height = parseInt(profile.height) || 170;
    const calculatedStride = Math.round(estimateStrideLength(height));
    setProfile({ ...profile, stride: String(calculatedStride) });
    Alert.alert(t('settings.alerts.autoStrideTitle'), t('settings.alerts.autoStrideMessage', { stride: calculatedStride }));
  };

  // CSVエクスポートは削除

  const handleClearData = () => {
    Alert.alert(
      t('settings.alerts.clearTitle'),
      t('settings.alerts.clearConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.data.clear'),
          style: 'destructive',
          onPress: async () => {
            const success = await clearAllData();
            if (success) {
              Alert.alert(t('settings.alerts.clearDoneTitle'), t('settings.alerts.clearDoneMessage'));
              loadSettings();
            } else {
              Alert.alert(t('common.error'), t('settings.alerts.clearFail'));
            }
          },
        },
      ]
    );
  };

  const handleHealthSyncToggle = async (value) => {
    if (value) {
      console.log('🔵 [SettingsScreen] HealthKit連携トグルON');

      // iOS以外では実行しない
      if (Platform.OS !== 'ios') {
        Alert.alert('HealthKit', 'この機能はiOS専用です。');
        setHealthSync(false);
        await saveHealthSyncEnabled(false);
        return;
      }

      // TestFlightで誤判定されるのでavailabilityチェックを削除
      // const availability = getHealthKitAvailability();
      // if (!availability.available) {
      //   Alert.alert('HealthKit', 'このデバイスではHealthKitを利用できません。');
      //   setHealthSync(false);
      //   await saveHealthSyncEnabled(false);
      //   return;
      // }
      // ヘルスケアの権限をリクエスト
      console.log('🔵 [SettingsScreen] initializeHealthKit() を呼び出します...');
      const initialized = await initializeHealthKit(true);
      console.log('🔵 [SettingsScreen] initializeHealthKit() の結果:', initialized);
      if (initialized) {
        setHealthSync(true);
        await saveHealthSyncEnabled(true);
        // 背景更新を開始
        await startStepsBackgroundUpdates();
        // フォールバック：BackgroundFetch（通知ONかつOS通知許可済みの時のみ）
        try {
          if (toBoolean(settings.notifications) && notifOSGranted) {
            await registerBackgroundStepsTask();
          }
        } catch (_) {}
        console.log('✅ [SettingsScreen] HealthKit連携成功');
        Alert.alert(t('settings.alerts.healthEnabledTitle'), t('settings.alerts.healthEnabledMessage'));
        // 過去30日を同期してストレージをHK優先で更新
        try { await syncPastDaysToStorage(30); } catch (_) {}

        // 背景配信用に限定: 自動の過去取り込みやキャッチアップは実行しない
      } else {
        console.log('❌ [SettingsScreen] HealthKit連携失敗');
        Alert.alert(t('common.error'), t('settings.alerts.healthPermissionFail') || '設定アプリで健康データアクセスを許可してください。');
      }
    } else {
      console.log('🔵 [SettingsScreen] HealthKit連携トグルOFF');
      setHealthSync(false);
      await saveHealthSyncEnabled(false);
      // 背景更新を停止
      await stopStepsBackgroundUpdates();
      try { await unregisterBackgroundStepsTask(); } catch (_) {}
    }
    try { logEvent('settings_changed', { field: 'health_sync' }); } catch (_) {}
  };

  const handleReminderToggle = async (value) => {
    try {
      if (value) {
        const granted = await requestNotificationPermissions();
        if (!granted) {
          setReminderEnabled(false);
          return;
        }
        await scheduleReminderNotification(20, 30);
        await saveReminderEnabled(true);
        setReminderEnabled(true);
        Alert.alert(t('common.success'), t('settings.alerts.reminderSetMessage'));
      } else {
        await cancelReminderNotifications();
        await saveReminderEnabled(false);
        setReminderEnabled(false);
        Alert.alert(t('settings.alerts.reminderDisabledTitle') || '無効化', t('settings.alerts.reminderDisabledMessage'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), 'リマインダー設定に失敗しました');
    }
  };


  // 30日再取り込み機能は提出版では非表示

  const handleResetOnboarding = () => {
    Alert.alert(
      t('settings.alerts.obResetTitle'),
      t('settings.alerts.obResetMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.alerts.obResetConfirm'),
          style: 'destructive',
          onPress: async () => {
            await saveOnboardingComplete(false);
            const parent = navigation.getParent?.() || navigation;
            parent.dispatch(
              CommonActions.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
            );
          },
        },
      ]
    );
  };

  // HealthKit デバッグ：権限状態をチェック
  const handleCheckHealthKitStatus = () => {
    checkHealthKitPermissions();
    Alert.alert(
      'HealthKit 権限状態確認',
      'コンソールログを確認してください。\n\n0 = Not Determined（未決定）\n1 = Sharing Denied（拒否）\n2 = Sharing Authorized（許可済み）'
    );
  };

  // 履歴データ再インポート
  const [isReimporting, setIsReimporting] = React.useState(false);
  const handleReimportData = async () => {
    if (isReimporting) return;

    Alert.alert(
      '履歴データの再インポート',
      '過去30日分の歩数データと時間帯別データをHealthKitから再取得します。\n\n既存のデータは上書きされます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '再インポート',
          onPress: async () => {
            setIsReimporting(true);
            try {
              // インポート済みフラグをリセット
              await resetHistoricalImport();

              // 再インポート実行
              const result = await importHistoricalData(30);
              console.log('[Settings] Re-import result:', result);

              if (result.success) {
                Alert.alert(
                  '完了',
                  `${result.importedDays}日分のデータをインポートしました。\n（時間帯別データ含む）`
                );
              } else {
                Alert.alert(
                  'インポート失敗',
                  'データの取得に失敗しました。ヘルスケア連携が有効か確認してください。'
                );
              }
            } catch (error) {
              console.error('[Settings] Re-import error:', error);
              Alert.alert('エラー', 'インポート中にエラーが発生しました。');
            } finally {
              setIsReimporting(false);
            }
          },
        },
      ]
    );
  };

  // 提出用: HealthKit診断機能は非表示

  // 都市選択ハンドラは削除

  // 位置情報トグルは削除

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 100 + insets.bottom }}
    >
      {/* 基本情報 */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <UserIcon size={20} color={theme.accent} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.sections.basicInfo')}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card }] }>
          <View style={styles.inputRow}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>{t('settings.fields.height')}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={profile.height}
                onChangeText={(text) => setProfile({ ...profile, height: text })}
                keyboardType="numeric"
                placeholder="170"
              />
              <Text style={[styles.inputUnit, { color: theme.textSecondary }]}>{t('units.cm')}</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>{t('settings.fields.weight')}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={profile.weight}
                onChangeText={(text) => setProfile({ ...profile, weight: text })}
                keyboardType="numeric"
                placeholder="65"
              />
              <Text style={[styles.inputUnit, { color: theme.textSecondary }]}>{t('units.kg')}</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>{t('settings.fields.stride')}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={profile.stride}
                onChangeText={(text) => setProfile({ ...profile, stride: text })}
                keyboardType="numeric"
                placeholder="72"
              />
              <Text style={styles.inputUnit}>{t('units.cm')}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.autoButton} onPress={handleAutoCalculateStride}>
            <Text style={styles.autoButtonText}>{t('settings.buttons.autoCalcStride')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
            <Text style={styles.saveButtonText}>{t('settings.buttons.save')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 目標設定 */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <TargetIcon size={20} color={theme.accent} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.sections.goal')}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card }] }>
          <View style={styles.inputRow}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>{t('settings.fields.dailyGoal')}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={settings.dailyGoal}
                onChangeText={(text) => setSettings({ ...settings, dailyGoal: text })}
                keyboardType="numeric"
                placeholder="10000"
              />
              <Text style={[styles.inputUnit, { color: theme.textSecondary }]}>{t('units.steps')}</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>{t('settings.fields.goalCalories')}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={settings.goalCalories}
                onChangeText={(text) => setSettings({ ...settings, goalCalories: text })}
                keyboardType="numeric"
                placeholder="500"
              />
              <Text style={[styles.inputUnit, { color: theme.textSecondary }]}>{t('units.kcal')}</Text>
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>{t('settings.fields.notifications')}</Text>
            <Switch
              value={toBoolean(settings.notifications)}
              onValueChange={handleAppNotificationsToggle}
              trackColor={{ false: '#ccc', true: theme.accent }}
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings}>
            <Text style={styles.saveButtonText}>{t('settings.buttons.save')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 言語設定 */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <PenIcon size={20} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.language')}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card }] }>
          <View style={styles.languageRow}>
            <TouchableOpacity
              style={[styles.langButton, settings.language === 'auto' && styles.langActive]}
              onPress={() => handleChangeLanguage('auto')}
            >
              <Text style={[styles.langText, settings.language === 'auto' && styles.langActiveText]}>
                {t('settings.languageAuto')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langButton, settings.language === 'ja' && styles.langActive]}
              onPress={() => handleChangeLanguage('ja')}
            >
              <Text style={[styles.langText, settings.language === 'ja' && styles.langActiveText]}>
                {t('settings.languageJa')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langButton, settings.language === 'en' && styles.langActive]}
              onPress={() => handleChangeLanguage('en')}
            >
              <Text style={[styles.langText, settings.language === 'en' && styles.langActiveText]}>
                {t('settings.languageEn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langButton, settings.language === 'zh-Hans' && styles.langActive]}
              onPress={() => handleChangeLanguage('zh-Hans')}
            >
              <Text style={[styles.langText, settings.language === 'zh-Hans' && styles.langActiveText]}>
                {t('settings.languageZhHans')}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.helperText, { color: theme.textSecondary }] }>
            {t('settings.helpers.languageHelper')}
          </Text>
        </View>
      </View>

      {/* 位置情報・都市選択は非表示 */}

      {/* ヘルスケア連携 */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <HeartIcon size={20} color={theme.accent} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.sections.health')}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card }] }>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>{t('settings.fields.healthSync')}</Text>
              <Text style={[styles.helperText, { color: theme.textSecondary }]}>{t('settings.helpers.healthPlatforms')}</Text>
              <Text style={[styles.helperText, { color: theme.textSecondary }]}>{t('settings.helpers.healthSyncStar')}</Text>
            </View>
            <Switch
              value={toBoolean(healthSync)}
              onValueChange={handleHealthSyncToggle}
              trackColor={{ false: '#ccc', true: theme.accent }}
            />
          </View>
          {/* 履歴データ再インポートボタン */}
          {Platform.OS === 'ios' && toBoolean(healthSync) && (
            <TouchableOpacity
              style={[
                styles.reimportButton,
                { backgroundColor: theme.accent, opacity: isReimporting ? 0.6 : 1 }
              ]}
              onPress={handleReimportData}
              disabled={isReimporting}
            >
              {isReimporting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.reimportButtonText}>履歴データを再インポート</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 提出用: データ削除・オンボーディングリセットは非表示 */}

      {/* 権限（OS） */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <InfoIcon size={20} color={theme.accent} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>権限</Text>
  </View>
  {/* Diagnostics Modal（提出版では非表示） */}
        <View style={[styles.card, { backgroundColor: theme.card }] }>
          <View style={styles.switchRow}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>{t('settings.permissions.calendar') || 'カレンダーの許可'}</Text>
            <Switch value={calendarOSGranted} onValueChange={onToggleCalendarOS} />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>{t('settings.permissions.motion') || 'モーションとフィットネス'}</Text>
            <Switch value={motionOSGranted} onValueChange={onToggleMotionOS} />
          </View>
        </View>
      </View>

      {/* 通知（アプリ） */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <InfoIcon size={20} color={theme.accent} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>通知</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>{t('settings.fields.notifications') || '通知'}</Text>
              <Text style={[styles.helperText, { color: theme.textSecondary }]}>{t('settings.helpers.reminderDaily') || 'アプリからの通知を有効にします'}</Text>
            </View>
            <Switch
              value={toBoolean(settings.notifications)}
              onValueChange={handleAppNotificationsToggle}
              trackColor={{ false: '#ccc', true: theme.accent }}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>{t('settings.fields.reminder') || 'リマインダー通知'}</Text>
              <Text style={[styles.helperText, { color: theme.textSecondary }]}>毎日20:30にお知らせ</Text>
            </View>
            <Switch
              value={toBoolean(reminderEnabled)}
              onValueChange={handleReminderToggle}
              trackColor={{ false: '#ccc', true: theme.accent }}
            />
          </View>
        </View>
      </View>

      {/* 計算式の透明化 */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <PenIcon size={20} color={theme.accent} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.sections.formulas')}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card }] }>
          <View style={styles.formulaSection}>
            <Text style={[styles.formulaTitle, { color: theme.text }]}>{t('settings.formulas.walkingCalories.title')}</Text>
            <Text style={[styles.formulaText, { color: theme.text, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>{t('settings.formulas.walkingCalories.formula')}</Text>
            <Text style={[styles.formulaDescription, { color: theme.textSecondary }]}>
              {t('settings.formulas.walkingCalories.desc')}
            </Text>
          </View>

          <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />

          <View style={styles.formulaSection}>
            <Text style={[styles.formulaTitle, { color: theme.text }]}>{t('settings.formulas.distance.title')}</Text>
            <Text style={[styles.formulaText, { color: theme.text, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>{t('settings.formulas.distance.formula')}</Text>
            <Text style={[styles.formulaDescription, { color: theme.textSecondary }]}>{t('settings.formulas.distance.note')}</Text>
          </View>

          <View style={styles.menuDivider} />

          <View style={styles.formulaSection}>
            <Text style={[styles.formulaTitle, { color: theme.text }]}>{t('settings.formulas.stride.title')}</Text>
            <Text style={[styles.formulaText, { color: theme.text, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>{t('settings.formulas.stride.formula')}</Text>
            <Text style={[styles.formulaDescription, { color: theme.textSecondary }]}>{t('settings.formulas.stride.note')}</Text>
          </View>

          <View style={[styles.formulaNote, { backgroundColor: theme.card, borderLeftColor: theme.accent }]}>
            <Text style={[styles.formulaNoteText, { color: theme.textSecondary }]}>{t('settings.formulas.caution')}</Text>
          </View>
        </View>
      </View>

      {/* アプリについて */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <InfoIcon size={20} color={theme.accent} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('settings.sections.about')}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card }] }>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{t('settings.about.appNameLabel')}</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>Walk'n Gain</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{t('settings.about.version')}</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>1.0.0</Text>
          </View>

          <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <Text style={[styles.menuText, { color: theme.text }]}>{t('settings.privacyPolicy')}</Text>
            <Text style={[styles.menuArrow, { color: theme.textSecondary }]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* データ再取り込みは提出版では非表示 */}
      {/* 都市選択モーダルは非表示 */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  section: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    color: '#212121',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 16,
    width: 100,
    textAlign: 'right',
  },
  inputUnit: {
    fontSize: 16,
    color: '#616161',
    marginLeft: 8,
    width: 30,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  autoButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF7043',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  autoButtonText: {
    color: '#FF7043',
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#FF7043',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  languageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  langButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  langActive: {
    backgroundColor: '#FF7043',
  },
  langText: {
    fontSize: 14,
    color: '#616161',
    fontWeight: '600',
  },
  langActiveText: {
    color: '#FFFFFF',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
  },
  menuText: {
    fontSize: 16,
    color: '#212121',
  },
  dangerText: {
    color: '#F44336',
  },
  menuArrow: {
    fontSize: 24,
    color: '#999',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 16,
    color: '#616161',
  },
  infoValue: {
    fontSize: 16,
    color: '#212121',
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  debugButton: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  debugButtonText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
  reimportButton: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  reimportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // 🔍 計算式セクションのスタイル
  formulaSection: {
    paddingVertical: 15,
  },
  formulaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 8,
  },
  formulaText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF7043',
    fontFamily: 'monospace',
    marginBottom: 8,
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
  },
  formulaDescription: {
    fontSize: 13,
    color: '#757575',
    lineHeight: 18,
  },
  formulaNote: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  formulaNoteText: {
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 20,
  },
  // 都市選択スタイル
  cityButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 8,
  },
  cityButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  cityButtonArrow: {
    fontSize: 12,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    fontSize: 24,
    fontWeight: '300',
  },
  cityList: {
    maxHeight: 400,
  },
  cityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cityItemText: {
    fontSize: 16,
  },
});
