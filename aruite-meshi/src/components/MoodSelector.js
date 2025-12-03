import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';

const COLORS = {
  teal: '#00A896',
  orange: '#FF6B35',
  textDark: '#2D3142',
  textGray: '#9CA5B5',
};

// ムードの定義（5段階）- labelKeyは翻訳キー
export const MOODS = [
  { value: 5, emoji: '😄', labelKey: 'best', color: '#FFD93D' },
  { value: 4, emoji: '🙂', labelKey: 'good', color: '#6BCB77' },
  { value: 3, emoji: '😐', labelKey: 'normal', color: '#4D96FF' },
  { value: 2, emoji: '😓', labelKey: 'notGreat', color: '#9B59B6' },
  { value: 1, emoji: '😫', labelKey: 'bad', color: '#FF6B6B' },
];

export function getMoodByValue(value) {
  return MOODS.find(m => m.value === value) || null;
}

function MoodButton({ mood, isSelected, onSelect, index, t }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSelected) {
      // バウンスアニメーション
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.15,
          friction: 3,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [isSelected]);

  const handlePress = () => {
    // タップ時の軽いバウンス
    Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: -8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: 0,
        friction: 4,
        tension: 150,
        useNativeDriver: true,
      }),
    ]).start();

    onSelect(mood.value);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={styles.moodButton}
    >
      <Animated.View
        style={[
          styles.moodEmoji,
          {
            transform: [
              { scale: scaleAnim },
              { translateY: bounceAnim },
            ],
            backgroundColor: isSelected ? `${mood.color}30` : 'transparent',
            borderWidth: isSelected ? 2 : 0,
            borderColor: mood.color,
          },
        ]}
      >
        <Text style={styles.emojiText}>{mood.emoji}</Text>
      </Animated.View>
      {isSelected && (
        <Text style={[styles.moodLabel, { color: mood.color }]}>
          {t(`home.diary.moods.${mood.labelKey}`)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function MoodSelector({ selectedMood, onSelectMood, theme }) {
  const { t } = useI18n();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme?.isDark ? theme.textSecondary : COLORS.textGray }]}>
        {t('home.diary.moodQuestion')}
      </Text>
      <View style={styles.moodRow}>
        {MOODS.map((mood, index) => (
          <MoodButton
            key={mood.value}
            mood={mood}
            isSelected={selectedMood === mood.value}
            onSelect={onSelectMood}
            index={index}
            t={t}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  moodButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  moodEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 26,
  },
  moodLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
});
