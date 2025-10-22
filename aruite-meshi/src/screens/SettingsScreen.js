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
} from 'react-native';
import {
  getUserProfile,
  saveUserProfile,
  getSettings,
  saveSettings,
  exportDataAsCSV,
  clearAllData,
  getHealthSyncEnabled,
  saveHealthSyncEnabled,
} from '../utils/storage';
import { estimateStrideLength, getMonthDates } from '../utils/calculations';
import { initializeHealthKit } from '../utils/healthKit';
import { scheduleReminderNotification, cancelReminderNotifications } from '../utils/notifications';

export default function SettingsScreen() {
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
  });
  const [healthSync, setHealthSync] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const userProfile = await getUserProfile();
    const userSettings = await getSettings();
    const healthSyncEnabled = await getHealthSyncEnabled();

    setProfile({
      height: String(userProfile.height),
      weight: String(userProfile.weight),
      stride: String(userProfile.stride),
    });

    setSettings({
      dailyGoal: String(userSettings.dailyGoal),
      defaultFood: userSettings.defaultFood,
      notifications: userSettings.notifications,
      unit: userSettings.unit,
    });

    setHealthSync(healthSyncEnabled);
  };

  const handleSaveProfile = async () => {
    const profileData = {
      height: parseInt(profile.height) || 170,
      weight: parseInt(profile.weight) || 65,
      stride: parseInt(profile.stride) || 72,
    };

    const success = await saveUserProfile(profileData);
    if (success) {
      Alert.alert('保存完了', 'プロフィールを保存しました');
    } else {
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  const handleSaveSettings = async () => {
    const settingsData = {
      dailyGoal: parseInt(settings.dailyGoal) || 10000,
      defaultFood: settings.defaultFood,
      notifications: settings.notifications,
      unit: settings.unit,
    };

    const success = await saveSettings(settingsData);
    if (success) {
      Alert.alert('保存完了', '設定を保存しました');
    } else {
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  const handleAutoCalculateStride = () => {
    const height = parseInt(profile.height) || 170;
    const calculatedStride = Math.round(estimateStrideLength(height));
    setProfile({ ...profile, stride: String(calculatedStride) });
    Alert.alert('自動計算', `歩幅を${calculatedStride}cmに設定しました`);
  };

  const handleExportData = async () => {
    const dates = getMonthDates();
    const csv = await exportDataAsCSV(dates);

    if (csv) {
      Alert.alert(
        'データエクスポート',
        '過去30日分のデータ:\n\n' + csv.substring(0, 200) + '...',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('エラー', 'データのエクスポートに失敗しました');
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'データ削除',
      'すべてのデータを削除しますか？この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            const success = await clearAllData();
            if (success) {
              Alert.alert('完了', 'すべてのデータを削除しました');
              loadSettings();
            } else {
              Alert.alert('エラー', '削除に失敗しました');
            }
          },
        },
      ]
    );
  };

  const handleHealthSyncToggle = async (value) => {
    if (value) {
      // ヘルスケアの権限をリクエスト
      const initialized = await initializeHealthKit();
      if (initialized) {
        setHealthSync(true);
        await saveHealthSyncEnabled(true);
        Alert.alert('成功', 'ヘルスケア連携を有効にしました');
      } else {
        Alert.alert('エラー', 'ヘルスケアの権限が取得できませんでした');
      }
    } else {
      setHealthSync(false);
      await saveHealthSyncEnabled(false);
      Alert.alert('無効化', 'ヘルスケア連携を無効にしました');
    }
  };

  const handleNotificationReminderToggle = async (value) => {
    if (value) {
      await scheduleReminderNotification(20, 0); // 20:00にリマインダー
      Alert.alert('設定完了', '毎日20:00にリマインダー通知を送信します');
    } else {
      await cancelReminderNotifications();
      Alert.alert('無効化', 'リマインダー通知を無効にしました');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* 基本情報 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 基本情報</Text>
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>身長</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={profile.height}
                onChangeText={(text) => setProfile({ ...profile, height: text })}
                keyboardType="numeric"
                placeholder="170"
              />
              <Text style={styles.inputUnit}>cm</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>体重</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={profile.weight}
                onChangeText={(text) => setProfile({ ...profile, weight: text })}
                keyboardType="numeric"
                placeholder="65"
              />
              <Text style={styles.inputUnit}>kg</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>歩幅</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={profile.stride}
                onChangeText={(text) => setProfile({ ...profile, stride: text })}
                keyboardType="numeric"
                placeholder="72"
              />
              <Text style={styles.inputUnit}>cm</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.autoButton} onPress={handleAutoCalculateStride}>
            <Text style={styles.autoButtonText}>身長から自動計算</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
            <Text style={styles.saveButtonText}>保存</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 目標設定 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 目標設定</Text>
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>1日の目標</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={settings.dailyGoal}
                onChangeText={(text) => setSettings({ ...settings, dailyGoal: text })}
                keyboardType="numeric"
                placeholder="10000"
              />
              <Text style={styles.inputUnit}>歩</Text>
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.inputLabel}>通知</Text>
            <Switch
              value={settings.notifications}
              onValueChange={(value) =>
                setSettings({ ...settings, notifications: value })
              }
              trackColor={{ false: '#ccc', true: '#FF7043' }}
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings}>
            <Text style={styles.saveButtonText}>保存</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ヘルスケア連携 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>❤️ ヘルスケア連携</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.inputLabel}>ヘルスケア同期</Text>
              <Text style={styles.helperText}>Apple Health / Google Fit</Text>
            </View>
            <Switch
              value={healthSync}
              onValueChange={handleHealthSyncToggle}
              trackColor={{ false: '#ccc', true: '#FF7043' }}
            />
          </View>

          <View style={styles.menuDivider} />

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.inputLabel}>リマインダー通知</Text>
              <Text style={styles.helperText}>毎日20:00に通知</Text>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={handleNotificationReminderToggle}
              trackColor={{ false: '#ccc', true: '#FF7043' }}
            />
          </View>
        </View>
      </View>

      {/* その他 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💡 その他</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.menuItem} onPress={handleExportData}>
            <Text style={styles.menuText}>データ書き出し</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuItem} onPress={handleClearData}>
            <Text style={[styles.menuText, styles.dangerText]}>データ削除</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* アプリについて */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ アプリについて</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>アプリ名</Text>
            <Text style={styles.infoValue}>歩いてメシ</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>バージョン</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
        </View>
      </View>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 10,
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
});
