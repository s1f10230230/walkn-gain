// 日々のひとことコメント管理（歩数と記憶を結びつける）
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAY_NOTE_PREFIX = 'daynote:';

/**
 * 指定日のひとことコメントを取得
 * @param {string} date - 'YYYY-MM-DD' 形式
 * @returns {Promise<string>} コメント（なければ空文字）
 */
export const getDayNote = async (date) => {
  try {
    const value = await AsyncStorage.getItem(`${DAY_NOTE_PREFIX}${date}`);
    return value ?? '';
  } catch (error) {
    console.error('getDayNote error:', error);
    return '';
  }
};

/**
 * 指定日のひとことコメントを保存
 * @param {string} date - 'YYYY-MM-DD' 形式
 * @param {string} text - コメント内容
 */
export const setDayNote = async (date, text) => {
  try {
    if (text && text.trim()) {
      await AsyncStorage.setItem(`${DAY_NOTE_PREFIX}${date}`, text.trim());
    } else {
      // 空文字の場合は削除
      await AsyncStorage.removeItem(`${DAY_NOTE_PREFIX}${date}`);
    }
  } catch (error) {
    console.error('setDayNote error:', error);
  }
};

/**
 * 指定日にコメントがあるかチェック
 * @param {string} date - 'YYYY-MM-DD' 形式
 * @returns {Promise<boolean>}
 */
export const hasNote = async (date) => {
  try {
    const value = await AsyncStorage.getItem(`${DAY_NOTE_PREFIX}${date}`);
    return value !== null;
  } catch (error) {
    console.error('hasNote error:', error);
    return false;
  }
};

/**
 * すべてのコメントを取得（日付降順）
 * @param {number} limit - 取得件数制限（デフォルト: 全件）
 * @returns {Promise<Array<{date: string, text: string, timestamp: number}>>}
 */
export const getAllNotes = async (limit = null) => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const noteKeys = allKeys.filter(key => key.startsWith(DAY_NOTE_PREFIX));

    const notesPromises = noteKeys.map(async (key) => {
      const date = key.replace(DAY_NOTE_PREFIX, '');
      const text = await AsyncStorage.getItem(key) ?? '';
      return {
        date,
        text,
        timestamp: new Date(date).getTime(),
      };
    });

    const notes = await Promise.all(notesPromises);
    const sorted = notes.sort((a, b) => b.timestamp - a.timestamp); // 日付降順

    return limit ? sorted.slice(0, limit) : sorted;
  } catch (error) {
    console.error('getAllNotes error:', error);
    return [];
  }
};

/**
 * 最近のひとこと（最大10件）を取得
 * @returns {Promise<Array<{date: string, text: string}>>}
 */
export const getRecentNotes = async () => {
  return await getAllNotes(10);
};

/**
 * コメントを削除
 * @param {string} date - 'YYYY-MM-DD' 形式
 */
export const deleteDayNote = async (date) => {
  try {
    await AsyncStorage.removeItem(`${DAY_NOTE_PREFIX}${date}`);
  } catch (error) {
    console.error('deleteDayNote error:', error);
  }
};

/**
 * ひとことテンプレート候補
 */
export const notePresets = [
  '静かな一日',
  'よく動けた日',
  '忙しかった',
  '充実した1日',
  'のんびり過ごした',
  '疲れた〜',
  '楽しかった！',
  '頑張った',
  'リフレッシュできた',
  '人混み多かった😅',
  '天気良かった☀️',
  '雨だった☔',
];

/**
 * ランダムなテンプレート候補を3つ取得
 * @returns {Array<string>}
 */
export const getRandomPresets = () => {
  const shuffled = [...notePresets].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
};
