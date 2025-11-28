import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useColorScheme, Animated, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n/I18nProvider';
import { getTheme } from '../../utils/theme';
import { saveUserProfile, saveSettings, saveOnboardingComplete } from '../../utils/storage';
import { AppIcon } from '../../components/AppIcon';

export default function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSkip = async () => {
    Alert.alert(
      t('common.skip'),
      t('onboarding.skipConfirm'), // You might need to add this key to your translation files or use a hardcoded string for now if not present
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.ok'),
          onPress: async () => {
            try {
              // Save default profile
              await saveUserProfile({
                height: 170,
                weight: 65,
                stride: 72,
              });
              // Save default settings
              await saveSettings({
                dailyGoal: 10000,
                defaultFood: 'ramen',
                notifications: true,
                unit: 'kcal',
                goalCalories: 500,
                language: 'auto',
              });
              // Mark onboarding as complete
              await saveOnboardingComplete(true);
              
              // Navigate to MainApp
              // We need to reset the navigation stack to ensure the user can't go back to onboarding
              navigation.reset({
                index: 0,
                routes: [{ name: 'MainApp' }],
              });
            } catch (error) {
              console.error('Error skipping onboarding:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <TouchableOpacity 
        style={[styles.skipButton, { top: insets.top + 10 }]} 
        onPress={handleSkip}
      >
        <Text style={[styles.skipText, { color: theme.textSecondary }]}>{t('common.skip') || 'Skip'}</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Image
            source={require('../../../assets/logo-small.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: theme.text }]}>{t('onboarding.welcome.title')}</Text>
        </Animated.View>
      

        <View style={styles.featuresContainer}>
          <Animated.View style={[styles.feature, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
            <View style={{ marginRight: 20 }}>
              <AppIcon name="footsteps" size={40} color={theme.primary} />
            </View>
            <Text style={[styles.featureText, { color: theme.text }]}>{t('onboarding.welcome.featureSteps')}</Text>
          </Animated.View>
          <Animated.View style={[styles.feature, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
            <Text style={styles.featureEmoji}>📝</Text>
            <Text style={[styles.featureText, { color: theme.text }]}>{t('onboarding.welcome.featureDiary')}</Text>
          </Animated.View>
          <Animated.View style={[styles.feature, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
            <Text style={styles.featureEmoji}>📊</Text>
            <Text style={[styles.featureText, { color: theme.text }]}>{t('onboarding.welcome.featureStats')}</Text>
          </Animated.View>
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
  skipButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
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
    alignSelf: 'center',
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
    marginTop: 20,
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
