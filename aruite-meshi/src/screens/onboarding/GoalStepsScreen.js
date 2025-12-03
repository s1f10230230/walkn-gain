import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../i18n/I18nProvider';
import { useColorScheme } from 'react-native';
import { getTheme } from '../../utils/theme';
import StepIndicator from '../../components/StepIndicator';

export default function GoalStepsScreen({ navigation, route }) {
  const { gender, age, height, weight } = route.params;
  const { t, formatNumber } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  // 年齢・性別からおすすめ歩数を推定
  const getRecommendedSteps = () => {
    if (age < 30) {
      return gender === 'male' ? 10000 : 9000;
    } else if (age < 50) {
      return gender === 'male' ? 9000 : 8000;
    } else if (age < 65) {
      return gender === 'male' ? 8000 : 7000;
    } else {
      return gender === 'male' ? 7000 : 6000;
    }
  };

  const [goalSteps, setGoalSteps] = useState('10000');
  const recommendedSteps = getRecommendedSteps();

  const handleNext = () => {
    const MIN_DAILY_GOAL = 1000;
    const MAX_DAILY_GOAL = 50000;
    const steps = parseInt(goalSteps) || 8000;

    // 目標歩数の範囲チェック
    if (steps < MIN_DAILY_GOAL || steps > MAX_DAILY_GOAL) {
      alert(`目標歩数は${MIN_DAILY_GOAL}〜${MAX_DAILY_GOAL}の範囲で設定してください。`);
      return;
    }

    navigation.navigate('Permissions', {
      gender,
      age,
      height,
      weight,
      goalSteps: steps,
    });
  };

  const applyRecommended = () => {
    setGoalSteps(recommendedSteps.toString());
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <StepIndicator currentStep={3} theme={theme} />

        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>{t('onboarding.goal.title')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('onboarding.goal.subtitle')}</Text>
        </View>

        <View style={styles.inputSection}>
          <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.primary, borderWidth: 2 }]}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={goalSteps}
              onChangeText={setGoalSteps}
              keyboardType="number-pad"
              placeholder="10000"
              placeholderTextColor={theme.textSecondary}
            />
            <Text style={[styles.unit, { color: theme.textSecondary }]}>{t('onboarding.goal.unitSteps')}</Text>
            <View style={styles.editIconContainer}>
              <Ionicons name="pencil" size={18} color={theme.textSecondary} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.recommendButton, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
            onPress={applyRecommended}
            activeOpacity={0.8}
          >
            <View style={styles.recommendButtonContent}>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.recommendButtonText}>
                {t('onboarding.goal.recommended', { steps: formatNumber(recommendedSteps) })}
              </Text>
            </View>
            <Text style={styles.recommendSubText}>
              {t('onboarding.goal.tapToApply') || 'Tap to apply'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.infoBox, { backgroundColor: theme.isDark ? '#2A1B14' : '#FFF3E0', borderLeftColor: theme.primary }]}>
            <View style={styles.infoContent}>
              <Ionicons name="bulb" size={18} color={theme.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.infoText, { color: theme.textSecondary, flex: 1 }]}>
                {t('onboarding.goal.info', { age, gender: gender === 'male' ? t('onboarding.profile.male') : t('onboarding.profile.female'), steps: formatNumber(recommendedSteps) })}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.nextButton, { backgroundColor: theme.primary }]} onPress={handleNext}>
            <Text style={styles.nextButtonText}>{t('common.next')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backText, { color: theme.textSecondary }]}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginTop: 8,
    marginBottom: 32,
  },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 12, letterSpacing: 0.3 },
  subtitle: { fontSize: 16, lineHeight: 24 },
  inputSection: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    paddingHorizontal: 24, paddingVertical: 20, marginBottom: 16,
  },
  input: { flex: 1, fontSize: 48, fontWeight: '700', textAlign: 'center' },
  unit: { fontSize: 24, fontWeight: '600', marginLeft: 8 },
  editIconContainer: {
    position: 'absolute',
    right: 16,
    top: 16,
    opacity: 0.5,
  },
  recommendButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  recommendButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recommendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  recommendSubText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  infoBox: { padding: 16, borderRadius: 12, borderLeftWidth: 4 },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: { fontSize: 14, lineHeight: 20 },
  infoBold: {
    fontWeight: '700',
    color: '#FF7043',
  },
  footer: {
    paddingBottom: 32,
  },
  nextButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backText: {
    textAlign: 'center',
    color: '#757575',
    fontSize: 16,
  },
});
