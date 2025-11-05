// 今日のひとこと入力コンポーネント
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { getDayNote, setDayNote, deleteDayNote, getRandomPresets } from '../utils/dayNotes';
import { useI18n } from '../i18n/I18nProvider';
import { getTodayDateString } from '../utils/calculations';

export default function TodayNote({ theme, date, onNoteChange }) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [presets, setPresets] = useState([]);
  const [hasNote, setHasNote] = useState(false);

  // アニメーション用
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [showToast, setShowToast] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // dateプロパティが渡されていればそれを使い、なければ今日の日付
  const targetDate = date || getTodayDateString();

  useEffect(() => {
    // 日付切替時のフェードアニメーション
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // 選択された日のひとことを読み込み
    const loadNote = async () => {
      const existingNote = await getDayNote(targetDate);
      setNoteText(existingNote);
      setHasNote(!!existingNote);

      // ランダムなテンプレート候補を取得
      setPresets(getRandomPresets());
    };
    loadNote();
    // 日付が変わったら閉じる
    setIsExpanded(false);
  }, [targetDate]);

  const showSaveToast = () => {
    setShowToast(true);
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowToast(false));
  };

  const handleSave = async () => {
    const trimmed = noteText.trim();
    await setDayNote(targetDate, trimmed);
    setHasNote(!!trimmed);
    setIsExpanded(false);

    // トースト表示
    showSaveToast();

    // 親コンポーネントに通知
    if (onNoteChange) {
      onNoteChange(trimmed);
    }
  };

  const handlePresetSelect = async (preset) => {
    setNoteText(preset);
    await setDayNote(targetDate, preset);
    setHasNote(true);
    setIsExpanded(false);

    // トースト表示
    showSaveToast();

    if (onNoteChange) {
      onNoteChange(preset);
    }
  };

  const handleDelete = async () => {
    await deleteDayNote(targetDate);
    setNoteText('');
    setHasNote(false);
    setIsExpanded(false);

    if (onNoteChange) {
      onNoteChange('');
    }
  };

  // 今日かどうかをチェック
  const isToday = targetDate === getTodayDateString();
  const label = isToday ? (t('todayNote.titleToday') || '今日のひとこと') : (t('todayNote.title') || 'ひとこと');

  return (
    <>
      <Animated.View style={[styles.container, { backgroundColor: theme.card, opacity: fadeAnim }] }>
        {!isExpanded && !hasNote && (
        <TouchableOpacity
          activeOpacity={0.4}
          style={styles.addButton}
          onPress={() => setIsExpanded(true)}
        >
          <Text style={styles.commentIcon}>💬</Text>
          <Text style={[styles.addButtonText, { color: theme.primary }]}>
            {t('todayNote.add') || 'ひとことを追加'}
          </Text>
          <Text style={[styles.editIcon, { color: theme.textSecondary }]}>✏️</Text>
        </TouchableOpacity>
      )}

      {!isExpanded && hasNote && (
        <TouchableOpacity
          activeOpacity={0.4}
          style={styles.noteDisplay}
          onPress={() => setIsExpanded(true)}
        >
          <Text style={styles.commentIcon}>💬</Text>
          <View style={styles.noteContent}>
            <Text style={[styles.noteLabel, { color: theme.textSecondary }]}>
              {label}
            </Text>
            <Text style={[styles.noteText, { color: theme.text }]}>
              {noteText}
            </Text>
          </View>
          <Text style={[styles.editIcon, { color: theme.textSecondary }]}>✏️</Text>
        </TouchableOpacity>
      )}

      {isExpanded && (
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
            {label}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={noteText}
            onChangeText={setNoteText}
            placeholder={isToday ? (t('todayNote.placeholderToday') || '今日の気分や出来事を記録...') : (t('todayNote.placeholderOther') || 'この日の気分や出来事を記録...')}
            placeholderTextColor={theme.textSecondary}
            maxLength={100}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <View style={styles.presetsContainer}>
            <Text style={[styles.presetsLabel, { color: theme.textSecondary }]}>
              {t('todayNote.templates') || 'テンプレート：'}
            </Text>
            <View style={styles.presetsRow}>
              {presets.map((preset, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.presetButton, { backgroundColor: theme.primary + '20' }]}
                  onPress={() => handlePresetSelect(preset)}
                >
                  <Text style={[styles.presetText, { color: theme.primary }]}>
                    {preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor: theme.border }]}
              onPress={() => setIsExpanded(false)}
            >
              <Text style={[styles.buttonText, { color: theme.textSecondary }]}>
                {t('common.cancel') || 'キャンセル'}
              </Text>
            </TouchableOpacity>
            {hasNote && (
              <TouchableOpacity
                style={[styles.button, styles.deleteButton, { backgroundColor: '#FF3B30' }]}
                onPress={handleDelete}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  {t('todayNote.delete') || '削除'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.button, styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleSave}
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                {t('todayNote.save') || '保存'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      </Animated.View>

      {/* 保存トースト */}
      {showToast && (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: theme.primary,
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.toastText}>{t('todayNote.savedToast') || '保存しました'}</Text>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    position: 'relative',
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  addButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  noteDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  noteContent: {
    flex: 1,
    marginLeft: 8,
  },
  noteLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 15,
    lineHeight: 22,
  },
  commentIcon: {
    fontSize: 20,
  },
  editIcon: {
    fontSize: 18,
    marginLeft: 12,
  },
  inputContainer: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    minHeight: 44,
  },
  presetsContainer: {
    gap: 8,
  },
  presetsLabel: {
    fontSize: 12,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  deleteButton: {},
  saveButton: {},
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    bottom: -50,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
