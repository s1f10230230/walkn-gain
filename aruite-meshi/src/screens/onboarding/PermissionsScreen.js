import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n/I18nProvider';
import { getTheme } from '../../utils/theme';
import { useColorScheme } from 'react-native';
import * as Calendar from 'expo-calendar';
import { requestNotificationPermissions, scheduleReminderNotification } from '../../utils/notifications';
import { saveReminderEnabled } from '../../utils/storage';
import { requestPedometerPermissions } from '../../utils/pedometer';

export default function PermissionsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const [calendarGranted, setCalendarGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [motionGranted, setMotionGranted] = useState(false);
  // 位置情報は使用しないため削除

  const requestCalendarPermission = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      setCalendarGranted(status === 'granted');
      return status === 'granted';
    } catch (error) {
      console.error('Calendar permission error:', error);
      return false;
    }
  };

  // 位置情報は未使用

  const handleContinue = () => {
    // まだ許可していない場合は、ここでまとめて促す
    (async () => {
      try {
        if (!notificationsGranted) {
          const ok = await requestNotificationPermissions();
          setNotificationsGranted(!!ok);
        }
      } catch (_) {}
      try {
        if (!motionGranted) {
          const ok = await requestPedometerPermissions();
          setMotionGranted(!!ok);
        }
      } catch (_) {}
    })();
    // 次の画面に遷移（既存のフローに合わせる）
    navigation.navigate('HealthKitPermission', route.params);
  };

  const handleSkipAll = () => {
    navigation.navigate('HealthKitPermission', route.params);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            {t('onboarding.permissions.title') || 'より便利に使うために'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('onboarding.permissions.subtitle') || '以下の権限を許可すると、より多くの機能を利用できます'}
          </Text>
        </View>

        {/* Calendar Permission */}
        <View style={[styles.permissionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📅</Text>
          </View>
          <View style={styles.permissionContent}>
            <Text style={[styles.permissionTitle, { color: theme.text }]}>
              {t('onboarding.permissions.calendar.title') || 'カレンダー'}
            </Text>
            <Text style={[styles.permissionDescription, { color: theme.textSecondary }]}>
              {t('onboarding.permissions.calendar.description') || 'ホーム画面に今日の予定を表示できます'}
            </Text>
            <TouchableOpacity
              style={[
                styles.permissionButton,
                calendarGranted && styles.permissionButtonGranted,
                { backgroundColor: calendarGranted ? theme.success : theme.primary }
              ]}
              onPress={requestCalendarPermission}
              disabled={calendarGranted}
            >
              <Text style={styles.permissionButtonText}>
                {calendarGranted
                  ? (t('onboarding.permissions.granted') || '✓ 許可済み')
                  : (t('onboarding.permissions.allow') || '許可する')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications Permission */}
        <View style={[styles.permissionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔔</Text>
          </View>
          <View style={styles.permissionContent}>
            <Text style={[styles.permissionTitle, { color: theme.text }]}>通知</Text>
            <Text style={[styles.permissionDescription, { color: theme.textSecondary }]}>目標達成やリマインダーをお知らせします</Text>
            <TouchableOpacity
              style={[
                styles.permissionButton,
                notificationsGranted && styles.permissionButtonGranted,
                { backgroundColor: notificationsGranted ? theme.success : theme.primary }
              ]}
              onPress={async () => {
                const ok = await requestNotificationPermissions();
                setNotificationsGranted(!!ok);
                if (ok) {
                  try {
                    await scheduleReminderNotification(20, 30);
                    await saveReminderEnabled(true);
                  } catch (_) {}
                }
              }}
              disabled={notificationsGranted}
            >
              <Text style={styles.permissionButtonText}>
                {notificationsGranted ? (t('onboarding.permissions.granted') || '✓ 許可済み') : (t('onboarding.permissions.allow') || '許可する')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Motion & Fitness (Pedometer) Permission */}
        <View style={[styles.permissionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🏃‍♂️</Text>
          </View>
          <View style={styles.permissionContent}>
            <Text style={[styles.permissionTitle, { color: theme.text }]}>モーションとフィットネス</Text>
            <Text style={[styles.permissionDescription, { color: theme.textSecondary }]}>歩数の計測に必要です（端末の設定でいつでも変更できます）</Text>
            <TouchableOpacity
              style={[
                styles.permissionButton,
                motionGranted && styles.permissionButtonGranted,
                { backgroundColor: motionGranted ? theme.success : theme.primary }
              ]}
              onPress={async () => {
                const ok = await requestPedometerPermissions();
                setMotionGranted(!!ok);
              }}
              disabled={motionGranted}
            >
              <Text style={styles.permissionButtonText}>
                {motionGranted ? (t('onboarding.permissions.granted') || '✓ 許可済み') : (t('onboarding.permissions.allow') || '許可する')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 位置情報は使用しないためカード非表示 */}

        {/* Note */}
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          {t('onboarding.permissions.note') || '※ これらの権限は後から設定アプリで変更できます'}
        </Text>
      </View>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={[styles.skipButton, { borderColor: theme.border }]}
          onPress={handleSkipAll}
        >
          <Text style={[styles.skipButtonText, { color: theme.textSecondary }]}>
            {t('onboarding.permissions.skip') || 'スキップ'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: theme.primary }]}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>
            {t('common.continue') || '続ける'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  permissionCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    marginRight: 16,
  },
  icon: {
    fontSize: 32,
  },
  permissionContent: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  permissionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  permissionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  permissionButtonGranted: {
    opacity: 0.7,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  note: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
