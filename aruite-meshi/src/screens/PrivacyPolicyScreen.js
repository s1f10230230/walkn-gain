import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, useColorScheme } from 'react-native';
import { getTheme } from '../utils/theme';
import { useI18n } from '../i18n/I18nProvider';

export default function PrivacyPolicyScreen() {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { t } = useI18n();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>{t('policy.title')}</Text>
        <Text style={[styles.date, { color: theme.textSecondary }]}>
          {t('policy.lastUpdated')}
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('policy.sections.collection.title')}</Text>
          <Text style={[styles.paragraph, { color: theme.textSecondary }]}>{t('policy.sections.collection.intro')}</Text>
          {(t('policy.sections.collection.bullets') || []).map((item, idx) => (
            <Text key={`c-${idx}`} style={[styles.listItem, { color: theme.textSecondary }]}>• {item}</Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('policy.sections.usage.title')}</Text>
          <Text style={[styles.paragraph, { color: theme.textSecondary }]}>{t('policy.sections.usage.intro')}</Text>
          {(t('policy.sections.usage.bullets') || []).map((item, idx) => (
            <Text key={`u-${idx}`} style={[styles.listItem, { color: theme.textSecondary }]}>• {item}</Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('policy.sections.storage.title')}</Text>
          <Text style={[styles.paragraph, { color: theme.textSecondary }]}>{t('policy.sections.storage.body')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('policy.sections.sharing.title')}</Text>
          <Text style={[styles.paragraph, { color: theme.textSecondary }]}>{t('policy.sections.sharing.body')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('policy.sections.security.title')}</Text>
          <Text style={[styles.paragraph, { color: theme.textSecondary }]}>{t('policy.sections.security.body')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('policy.sections.rights.title')}</Text>
          <Text style={[styles.paragraph, { color: theme.textSecondary }]}>{t('policy.sections.rights.intro')}</Text>
          {(t('policy.sections.rights.bullets') || []).map((item, idx) => (
            <Text key={`r-${idx}`} style={[styles.listItem, { color: theme.textSecondary }]}>• {item}</Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('policy.sections.health.title')}</Text>
          <Text style={[styles.paragraph, { color: theme.textSecondary }]}>{t('policy.sections.health.body')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('policy.sections.analytics.title')}</Text>
          <Text style={[styles.paragraph, { color: theme.textSecondary }]}>{t('policy.sections.analytics.body')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('policy.sections.children.title')}</Text>
          <Text style={[styles.paragraph, { color: theme.textSecondary }]}>{t('policy.sections.children.body')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('policy.sections.changes.title')}</Text>
          <Text style={[styles.paragraph, { color: theme.textSecondary }]}>{t('policy.sections.changes.body')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('policy.sections.contact.title')}</Text>
          <Text style={[styles.paragraph, { color: theme.textSecondary }]}>{t('policy.sections.contact.intro')}</Text>
          <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
            {t('policy.sections.contact.emailLabel')}: ask.help.thisapp@gmail.com{'\n'}
            {t('policy.sections.contact.appNameLabel')}: Walk'n Gain
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 8,
  },
  listItem: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 4,
    paddingLeft: 8,
  },
});
