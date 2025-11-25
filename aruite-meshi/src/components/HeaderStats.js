import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';
import { AppIcon } from './AppIcon';

export default function HeaderStats({ totalTrophies = 0, currentStreak = 0, isCalculating = false, theme }) {
  const { t } = useI18n();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {isCalculating ? (
        <ActivityIndicator size="small" color={theme.accent} style={{ marginRight: 8 }} />
      ) : null}
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <AppIcon name="trophy" size={18} color={theme.accent} style={{ marginRight: 4 }} />
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>
            {t('home.trophies.achieved', { count: totalTrophies })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppIcon name="fire" size={18} color={theme.primary} style={{ marginRight: 4 }} />
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>
            {t('home.trophies.streak', { count: currentStreak })}
          </Text>
        </View>
      </View>
    </View>
  );
}
