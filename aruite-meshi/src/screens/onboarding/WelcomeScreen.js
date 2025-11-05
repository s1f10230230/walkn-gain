import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n/I18nProvider';
import { getTheme } from '../../utils/theme';

export default function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Image
          source={require('../../../assets/logo-small.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: theme.text }]}>{t('onboarding.welcome.title')}</Text>
      

        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Text style={styles.featureEmoji}>👟</Text>
            <Text style={[styles.featureText, { color: theme.text }]}>{t('onboarding.welcome.featureSteps')}</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureEmoji}>🔥</Text>
            <Text style={[styles.featureText, { color: theme.text }]}>{t('onboarding.welcome.featureCalories')}</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureEmoji}>🍜</Text>
            <Text style={[styles.featureText, { color: theme.text }]}>{t('onboarding.welcome.featureFood')}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('ProfileInput')}
        >
          <Text style={styles.buttonText}>{t('onboarding.welcome.start')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 15,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 50,
  },
  featuresContainer: {
    width: '100%',
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  featureEmoji: {
    fontSize: 40,
    marginRight: 20,
  },
  featureText: {
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 30,
  },
  button: {
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#FF7043',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
