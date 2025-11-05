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
import { useI18n } from '../../i18n/I18nProvider';
import { useColorScheme } from 'react-native';
import { getTheme } from '../../utils/theme';

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
    const steps = parseInt(goalSteps) || 8000;
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
        <View style={styles.header}>
          <Text style={[styles.step, { color: theme.primary }]}>{t('onboarding.goal.stepLabel')}</Text>
          <Text style={[styles.title, { color: theme.text }]}>{t('onboarding.goal.title')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('onboarding.goal.subtitle')}</Text>
        </View>

        <View style={styles.inputSection}>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={goalSteps}
              onChangeText={setGoalSteps}
              keyboardType="number-pad"
              placeholder="10000"
              placeholderTextColor={theme.textSecondary}
            />
            <Text style={[styles.unit, { color: theme.textSecondary }]}>{t('onboarding.goal.unitSteps')}</Text>
          </View>

          <TouchableOpacity style={[styles.recommendButton, { backgroundColor: theme.accent }]} onPress={applyRecommended}>
            <Text style={styles.recommendButtonText}>
              {`✨ ${t('onboarding.goal.recommended', { steps: formatNumber(recommendedSteps) })}`}
            </Text>
          </TouchableOpacity>

          <View style={[styles.infoBox, { backgroundColor: theme.isDark ? '#2A1B14' : '#FFF3E0', borderLeftColor: theme.primary }]}>
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {`💡 ${t('onboarding.goal.info', { age, gender: gender === 'male' ? t('onboarding.profile.male') : t('onboarding.profile.female'), steps: formatNumber(recommendedSteps) })}`}
            </Text>
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
    marginTop: 40,
    marginBottom: 40,
  },
  step: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
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
  recommendButton: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', marginBottom: 24 },
  recommendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  infoBox: { padding: 16, borderRadius: 12, borderLeftWidth: 4 },
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
