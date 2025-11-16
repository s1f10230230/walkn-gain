import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n/I18nProvider';
import { getTheme } from '../../utils/theme';
import { useColorScheme } from 'react-native';
import * as Calendar from 'expo-calendar';
import { requestNotificationPermissions, scheduleReminderNotification } from '../../utils/notifications';
import { saveReminderEnabled } from '../../utils/storage';
import { requestPedometerPermissions } from '../../utils/pedometer';
import * as Notifications from 'expo-notifications';

export default function PermissionsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const [calendarGranted, setCalendarGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [motionGranted, setMotionGranted] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  useEffect(() => {
    (async () => {
      try {
        const status = await Calendar.getCalendarPermissionsAsync();
        setCalendarGranted(status.status === 'granted');
      } catch (error) {
        console.error('Calendar permission check error:', error);
      }
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setNotificationsGranted(status === 'granted');
      } catch (error) {
        console.error('Notification permission check error:', error);
      }
    })();
  }, []);

  const requestCalendarPermission = async () => {
    try {
      const existing = await Calendar.getCalendarPermissionsAsync();
      if (existing.status === 'granted') {
        setCalendarGranted(true);
        return true;
      }
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      const granted = status === 'granted';
      setCalendarGranted(granted);
      return granted;
    } catch (error) {
      console.error('Calendar permission error:', error);
      return false;
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const ok = await requestNotificationPermissions();
      const granted = !!ok;
      setNotificationsGranted(granted);
      if (granted && !notificationsGranted) {
        try {
          await scheduleReminderNotification(20, 30);
          await saveReminderEnabled(true);
        } catch (_) {}
      }
      return granted;
    } catch (_) {
      return false;
    }
  };

  const requestMotionPermission = async () => {
    try {
      const ok = await requestPedometerPermissions();
      setMotionGranted(!!ok);
      return ok;
    } catch (error) {
      console.error('Pedometer permission error:', error);
      return false;
    }
  };

  const handleContinue = async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    await requestCalendarPermission();
    await requestNotificationPermission();
    await requestMotionPermission();
    setIsRequesting(false);
    navigation.navigate('HealthKitPermission', route.params);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
          isLargeScreen && styles.scrollContentTablet,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contentWrapper, { borderColor: theme.border, backgroundColor: theme.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              {t('onboarding.permissions.title') || 'より便利に使うために'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t('onboarding.permissions.subtitle') || '以下の権限を許可すると、より多くの機能を利用できます'}
            </Text>
          </View>

          {[
            {
              icon: '📅',
              title: t('onboarding.permissions.calendar.title') || 'カレンダー',
              description: t('onboarding.permissions.calendar.description') || 'ホーム画面に今日の予定を表示できます',
              granted: calendarGranted,
            },
            {
              icon: '🔔',
              title: t('onboarding.permissions.notifications.title') || '通知',
              description: t('onboarding.permissions.notifications.description') || '目標達成やリマインダーをお知らせします',
              granted: notificationsGranted,
            },
            {
              icon: '🏃‍♂️',
              title: t('onboarding.permissions.motion.title') || 'モーションとフィットネス',
              description: t('onboarding.permissions.motion.description') || '歩数の計測に必要です（端末の設定でいつでも変更できます）',
              granted: motionGranted,
            },
          ].map((item) => (
            <View key={item.title} style={[styles.permissionCard, { borderColor: theme.border }]}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <View style={styles.permissionContent}>
                <Text style={[styles.permissionTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.permissionDescription, { color: theme.textSecondary }]}>{item.description}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      borderColor: item.granted ? theme.success : theme.border,
                      backgroundColor: item.granted
                        ? (theme.isDark ? '#12301F' : '#ECFDF5')
                        : (theme.isDark ? '#2A1B14' : '#FFF7ED'),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: item.granted ? theme.success : theme.textSecondary },
                    ]}
                  >
                    {item.granted
                      ? (t('onboarding.permissions.granted') || '✓ 許可済み')
                      : (t('onboarding.permissions.pending') || '未許可')}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          <Text style={[styles.note, { color: theme.textSecondary }]}>
            {t('onboarding.permissions.note') || '※ これらの権限は後から設定アプリで変更できます'}
          </Text>

          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: theme.primary }]}
            onPress={handleContinue}
            disabled={isRequesting}
          >
            {isRequesting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.continueButtonText}>{t('common.continue') || '続ける'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  scrollContentTablet: {
    paddingHorizontal: 40,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 640,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    gap: 18,
  },
  header: {
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
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
    backgroundColor: 'transparent',
  },
  iconContainer: {
    marginRight: 16,
  },
  icon: {
    fontSize: 32,
  },
  permissionContent: {
    flex: 1,
    gap: 8,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  permissionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  note: {
    fontSize: 13,
    textAlign: 'center',
  },
  continueButton: {
    marginTop: 4,
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
