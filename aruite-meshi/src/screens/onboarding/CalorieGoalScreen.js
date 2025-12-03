import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  useColorScheme,
} from 'react-native';
import { getSettings } from '../../utils/storage';
import { getTheme } from '../../utils/theme';
import { useI18n } from '../../i18n/I18nProvider';
import StepIndicator from '../../components/StepIndicator';

export default function CalorieGoalScreen({ navigation, route }) {
  const { gender, age, height, weight, goalSteps } = route.params;
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { t, formatNumber } = useI18n();

  // 目標歩数から推奨カロリーを計算
  const getRecommendedCalories = () => {
    // MET法: 歩数 × 体重 × 0.00055
    const estimatedCalories = goalSteps * weight * 0.00055;
    // 100の倍数に丸める
    return Math.round(estimatedCalories / 100) * 100;
  };

  const recommendedCalories = getRecommendedCalories();
  const [selectedCalories, setSelectedCalories] = useState(recommendedCalories);

  const calorieOptions = [300, 400, 500, 600, 700, 800];

  const handleComplete = (skipCalorieGoal = false) => {
    // ProIntro画面へ遷移（保存処理はProIntroで実行）
    navigation.navigate('ProIntro', {
      gender,
      age,
      height,
      weight,
      goalSteps,
      goalCalories: skipCalorieGoal ? 500 : selectedCalories,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <StepIndicator currentStep={6} theme={theme} />

        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>{t('onboarding.calorie.title')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('onboarding.calorie.subtitle')}
          </Text>
        </View>

        <View style={styles.mainSection}>
          <View style={[styles.recommendBox, { backgroundColor: theme.card, borderColor: theme.accent }]}>
            <Text style={[styles.recommendLabel, { color: theme.accent }]}>{t('onboarding.calorie.recommended')}</Text>
            <Text style={[styles.recommendValue, { color: theme.text }]}>{formatNumber(recommendedCalories)} {t('units.kcal')}</Text>
            <Text style={[styles.recommendDescription, { color: theme.textSecondary }]}>
              {t('onboarding.calorie.autoFromSteps', { steps: formatNumber(goalSteps) })}
            </Text>
          </View>

          <Text style={[styles.optionsTitle, { color: theme.text }]}>{t('onboarding.calorie.pickAny')}</Text>
          <View style={styles.optionsGrid}>
            {calorieOptions.map((cal) => (
              <TouchableOpacity
                key={cal}
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  selectedCalories === cal && { borderColor: theme.accent, backgroundColor: theme.isDark ? '#1A3A36' : '#E0F7F4' },
                ]}
                onPress={() => setSelectedCalories(cal)}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: theme.text },
                    selectedCalories === cal && { color: theme.accent },
                  ]}
                >
                  {cal}
                </Text>
                <Text
                  style={[
                    styles.optionUnit,
                    { color: theme.textTertiary },
                    selectedCalories === cal && { color: theme.accent },
                  ]}
                >
                  {t('units.kcal')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: theme.primary }]}
            onPress={() => handleComplete(false)}
          >
            <Text style={styles.completeButtonText}>
              {t('onboarding.calorie.startWith', { cal: formatNumber(selectedCalories) })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => handleComplete(true)}
          >
            <Text style={[styles.skipButtonText, { color: theme.textSecondary }]}>{t('onboarding.calorie.setLater')}</Text>
          </TouchableOpacity>
        </View>
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
  },
  header: {
    marginTop: 8,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  mainSection: {
    flex: 1,
  },
  recommendBox: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 2,
  },
  recommendLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  recommendValue: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 4,
  },
  recommendDescription: {
    fontSize: 14,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionButton: {
    width: '30%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  optionText: {
    fontSize: 24,
    fontWeight: '700',
  },
  optionUnit: {
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    paddingBottom: 32,
  },
  completeButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#FF7043',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
