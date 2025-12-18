import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, useColorScheme } from 'react-native';
import { useI18n } from '../../i18n/I18nProvider';
import { getTheme } from '../../utils/theme';
import { getSettings } from '../../utils/storage';

const OPTIONS = [
  { key: 'ja', labelKey: 'settings.languageJa' },
  { key: 'en', labelKey: 'settings.languageEn' },
];

export default function LanguageSelectScreen({ navigation }) {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { t, setLocale } = useI18n();
  const [selected, setSelected] = useState('ja');

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setSelected(['ja', 'en'].includes(s?.language) ? s.language : 'ja');
    })();
  }, []);

  const handleNext = async () => {
    await setLocale(selected);
    navigation.navigate('Welcome');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>{t('onboarding.language.title')}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('onboarding.language.subtitle')}</Text>

        <View style={styles.options}>
          {OPTIONS.map((opt) => {
            const active = selected === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.option,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  active && { borderColor: theme.primary, backgroundColor: theme.isDark ? '#2A1B14' : '#FFF3E8' },
                ]}
                onPress={() => setSelected(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.optionText, { color: active ? theme.primary : theme.text }]}>
                  {t(opt.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.nextButton, { backgroundColor: theme.primary }]} onPress={handleNext}>
          <Text style={styles.nextText}>{t('common.next')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  options: {
    gap: 12,
  },
  option: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  nextText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
