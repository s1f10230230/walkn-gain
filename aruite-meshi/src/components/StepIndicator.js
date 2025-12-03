import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Modern step indicator with 6 dots
 * Shows progress through onboarding flow
 * @param {number} currentStep - Current step (1-6)
 * @param {number} totalSteps - Total steps (default: 6)
 * @param {object} theme - Theme object with colors
 */
export default function StepIndicator({ currentStep, totalSteps = 6, theme }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: isActive || isCompleted
                  ? theme.primary
                  : theme.isDark
                    ? 'rgba(255,255,255,0.15)'
                    : 'rgba(0,0,0,0.12)',
              },
              isActive && styles.activeDot,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    height: 40,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 28,
    borderRadius: 14,
  },
});
