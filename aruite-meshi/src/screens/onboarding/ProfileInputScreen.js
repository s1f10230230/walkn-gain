import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n/I18nProvider';
import { getTheme } from '../../utils/theme';

export default function ProfileInputScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const [gender, setGender] = useState(''); // 'male' or 'female'
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const handleNext = () => {
    // バリデーション
    if (!gender) {
      Alert.alert(t('common.error'), t('onboarding.profile.errors.gender'));
      return;
    }
    if (!age || parseInt(age) < 1 || parseInt(age) > 120) {
      Alert.alert(t('common.error'), t('onboarding.profile.errors.age'));
      return;
    }
    if (!height || parseInt(height) < 50 || parseInt(height) > 250) {
      Alert.alert(t('common.error'), t('onboarding.profile.errors.height'));
      return;
    }
    if (!weight || parseInt(weight) < 20 || parseInt(weight) > 300) {
      Alert.alert(t('common.error'), t('onboarding.profile.errors.weight'));
      return;
    }

    // 次の画面へ遷移（データは保存せず、パラメータとして渡す）
    navigation.navigate('GoalSteps', {
      gender,
      age: parseInt(age),
      height: parseInt(height),
      weight: parseInt(weight),
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: theme.text }]}>{t('onboarding.profile.title')}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('onboarding.profile.subtitle')}</Text>

        {/* 性別選択 */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>{t('onboarding.profile.gender')}</Text>
          <View style={styles.genderContainer}>
            <TouchableOpacity
              style={[
                styles.genderButton,
                { backgroundColor: theme.card, borderColor: theme.border },
                gender === 'male' && (theme.isDark ? { backgroundColor: '#2A1B14', borderColor: theme.primary } : { backgroundColor: '#FFF3E0', borderColor: theme.primary }),
              ]}
              onPress={() => setGender('male')}
            >
              <Text
                style={[
                  styles.genderEmoji,
                  gender === 'male' && styles.genderEmojiActive,
                ]}
              >
                👨
              </Text>
              <Text
                style={[
                  styles.genderText,
                  { color: theme.textSecondary },
                  gender === 'male' && { color: theme.primary },
                ]}
              >
                {t('onboarding.profile.male')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.genderButton,
                { backgroundColor: theme.card, borderColor: theme.border },
                gender === 'female' && (theme.isDark ? { backgroundColor: '#2A1B14', borderColor: theme.primary } : { backgroundColor: '#FFF3E0', borderColor: theme.primary }),
              ]}
              onPress={() => setGender('female')}
            >
              <Text
                style={[
                  styles.genderEmoji,
                  gender === 'female' && styles.genderEmojiActive,
                ]}
              >
                👩
              </Text>
              <Text
                style={[
                  styles.genderText,
                  { color: theme.textSecondary },
                  gender === 'female' && { color: theme.primary },
                ]}
              >
                {t('onboarding.profile.female')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 年齢 */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>{t('onboarding.profile.age')}</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="25"
              placeholderTextColor={theme.textSecondary}
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              maxLength={3}
              returnKeyType="next"
            />
            <Text style={[styles.unit, { color: theme.textSecondary }]}>{t('units.years')}</Text>
          </View>
        </View>

        {/* 身長 */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>{t('onboarding.profile.height')}</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="170"
              placeholderTextColor={theme.textSecondary}
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
              maxLength={3}
              returnKeyType="next"
            />
            <Text style={[styles.unit, { color: theme.textSecondary }]}>{t('units.cm')}</Text>
          </View>
        </View>

        {/* 体重 */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>{t('onboarding.profile.weight')}</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="65"
              placeholderTextColor={theme.textSecondary}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              maxLength={3}
              returnKeyType="done"
            />
            <Text style={[styles.unit, { color: theme.textSecondary }]}>{t('units.kg')}</Text>
          </View>
        </View>

        {/* キーボード表示時のスペース確保 */}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={handleNext}>
          <Text style={styles.buttonText}>{t('common.next')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  section: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderButton: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 2,
  },
  genderEmoji: {
    fontSize: 50,
    marginBottom: 10,
    opacity: 0.5,
  },
  genderEmojiActive: {
    opacity: 1,
  },
  genderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
  },
  unit: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
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
