import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useColorScheme, Animated, Alert, useWindowDimensions } from 'react-native';
import { useI18n } from '../../i18n/I18nProvider';
import { getTheme } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import StepIndicator from '../../components/StepIndicator';
import ScreenContainer from '../../components/ScreenContainer';

export default function WelcomeScreen({ navigation }) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

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
      t('onboarding.skipConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.ok'),
          onPress: async () => {
            // スキップ時はデフォルト値でPermissionsへ（必須画面のみ通過）
            navigation.navigate('Permissions', {
              gender: 'male',
              age: 30,
              height: 170,
              weight: 65,
              goalSteps: 10000,
              goalCalories: 500,
              fromSkip: true,
            });
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer scroll={false} style={{ backgroundColor: theme.background }}>
      <TouchableOpacity 
        style={[styles.skipButton]} 
        onPress={handleSkip}
      >
        <Text style={[styles.skipText, { color: theme.textSecondary }]}>{t('common.skip') || 'Skip'}</Text>
      </TouchableOpacity>

      <View style={[styles.content, isTablet && styles.contentTablet]}>
        <StepIndicator currentStep={1} theme={theme} />

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], width: '100%', maxWidth: 640, alignItems: 'center' }}>
          <Image
            source={require('../../../assets/logo-small.png')}
            style={[styles.logo, isTablet && styles.logoTablet]}
            resizeMode="contain"
          />
          <Text style={[styles.title, isTablet && styles.titleTablet, { color: theme.text }]}>{t('onboarding.welcome.title')}</Text>
        </Animated.View>
      

        <View style={[styles.featuresContainer, isTablet && styles.featuresContainerTablet]}>
          <Animated.View style={[styles.feature, isTablet && styles.featureTablet, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
              <Ionicons name="footsteps" size={26} color="#FFC8A2" />
            </View>
            <Text style={[styles.featureText, isTablet && styles.featureTextTablet, { color: theme.text }]}>{t('onboarding.welcome.featureSteps')}</Text>
          </Animated.View>
          <Animated.View style={[styles.feature, isTablet && styles.featureTablet, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
              <Ionicons name="document-text" size={26} color="#FFC8A2" />
            </View>
            <Text style={[styles.featureText, isTablet && styles.featureTextTablet, { color: theme.text }]}>{t('onboarding.welcome.featureDiary')}</Text>
          </Animated.View>
          <Animated.View style={[styles.feature, isTablet && styles.featureTablet, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
              <Ionicons name="bar-chart" size={26} color="#FFC8A2" />
            </View>
            <Text style={[styles.featureText, isTablet && styles.featureTextTablet, { color: theme.text }]}>{t('onboarding.welcome.featureStats')}</Text>
          </Animated.View>
        </View>
      </View>

      <View style={[styles.footer, isTablet && styles.footerTablet, { paddingBottom: 20 }]}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('ProfileInput')}
        >
          <Text style={[styles.buttonText, isTablet && styles.buttonTextTablet]}>{t('onboarding.welcome.start')}</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
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
  contentTablet: {
    paddingHorizontal: 80,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 30,
    alignSelf: 'center',
  },
  logoTablet: {
    width: 160,
    height: 160,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 15,
    textAlign: 'center',
  },
  titleTablet: {
    fontSize: 36,
    maxWidth: 640,
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
  featuresContainerTablet: {
    maxWidth: 640,
    alignSelf: 'center',
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  featureTablet: {
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderRadius: 16,
  },
  featureText: {
    fontSize: 18,
    fontWeight: '600',
  },
  featureTextTablet: {
    fontSize: 20,
  },
  footer: {
    paddingHorizontal: 30,
  },
  footerTablet: {
    paddingHorizontal: 80,
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
  buttonTextTablet: {
    fontSize: 20,
  },
});
