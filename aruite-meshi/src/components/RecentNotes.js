// 最近のひとこと表示コンポーネント
import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { getRecentNotes } from '../utils/dayNotes';
import { useI18n } from '../i18n/I18nProvider';

const RecentNotes = forwardRef(({ theme, onNotePress }, ref) => {
  const { t, formatNumber } = useI18n();
  const [notes, setNotes] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadRecentNotes();
  }, []);

  const loadRecentNotes = async () => {
    const recentNotes = await getRecentNotes();
    setNotes(recentNotes);
  };

  // 親コンポーネントから再読み込みを呼び出せるようにする
  useImperativeHandle(ref, () => ({
    reload: loadRecentNotes,
  }));

  // 日付をフォーマット（例: 11/3（月））
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = t('weekdaysShort') || ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const weekday = Array.isArray(weekdays) ? weekdays[date.getDay()] : '';
    return `${month}/${day} (${weekday})`;
  };

  if (notes.length === 0) {
    return null;
  }

  const displayNotes = showAll ? notes : notes.slice(0, 5);
  const hasMore = notes.length > 5;

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          {t('recentNotes.title') || '最近のひとこと'}
        </Text>
        <Text style={[styles.count, { color: theme.textSecondary }]}>
          {t('recentNotes.count', { count: formatNumber(notes.length) }) || `${notes.length}件`}
        </Text>
      </View>
      <View style={styles.notesList}>
        {displayNotes.map((note, index) => (
          <TouchableOpacity
            key={note.date}
            activeOpacity={0.4}
            style={[
              styles.noteItem,
              {
                borderBottomColor: theme.border,
                backgroundColor: theme.cardBackground,
              },
              index === displayNotes.length - 1 && styles.lastNoteItem,
            ]}
            onPress={() => onNotePress && onNotePress(note.date)}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.commentIcon}>💬</Text>
            </View>
            <View style={styles.noteContent}>
              <Text style={[styles.noteDate, { color: theme.textSecondary }]}>
                {formatDate(note.date)}
              </Text>
              <Text
                style={[styles.noteText, { color: theme.text }]}
                numberOfLines={2}
              >
                {note.text}
              </Text>
            </View>
            <Text style={[styles.arrow, { color: theme.textSecondary }]}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
      {hasMore && !showAll && (
        <TouchableOpacity
          style={[styles.showMoreButton, { borderTopColor: theme.border }]}
          onPress={() => setShowAll(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.showMoreText, { color: theme.primary }]}>
            {t('recentNotes.showMore', { count: formatNumber(notes.length - 5) }) || `さらに表示 (${notes.length - 5}件)`}
          </Text>
        </TouchableOpacity>
      )}
      {showAll && hasMore && (
        <TouchableOpacity
          style={[styles.showMoreButton, { borderTopColor: theme.border }]}
          onPress={() => setShowAll(false)}
          activeOpacity={0.7}
        >
          <Text style={[styles.showMoreText, { color: theme.primary }]}>
            {t('recentNotes.showLess') || '一部のみ表示'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

export default RecentNotes;

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  count: {
    fontSize: 13,
    fontWeight: '500',
  },
  notesList: {
    gap: 0,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderRadius: 8,
    marginHorizontal: -4,
  },
  lastNoteItem: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    marginRight: 12,
  },
  commentIcon: {
    fontSize: 20,
  },
  noteContent: {
    flex: 1,
  },
  noteDate: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '500',
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  arrow: {
    fontSize: 24,
    fontWeight: '300',
    marginLeft: 12,
  },
  showMoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 8,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
