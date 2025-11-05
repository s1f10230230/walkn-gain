// カレンダー連携ユーティリティ
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

/**
 * カレンダー権限をリクエスト
 * @returns {Promise<boolean>} 権限が許可されたかどうか
 */
export const requestCalendarPermissions = async () => {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting calendar permissions:', error);
    return false;
  }
};

/**
 * デバイスのカレンダー一覧を取得
 * @returns {Promise<array>} カレンダーの配列
 */
export const getCalendars = async () => {
  try {
    const hasPermission = await requestCalendarPermissions();

    if (!hasPermission) {
      console.log('Calendar permission not granted');
      return [];
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars;
  } catch (error) {
    console.error('Error getting calendars:', error);
    return [];
  }
};

/**
 * 特定の日付のイベントを取得
 * @param {Date} date - 取得する日付
 * @returns {Promise<array>} イベントの配列
 */
export const getEventsForDate = async (date) => {
  try {
    const hasPermission = await requestCalendarPermissions();

    if (!hasPermission) {
      console.log('Calendar permission not granted');
      return [];
    }

    const calendars = await getCalendars();

    if (calendars.length === 0) {
      return [];
    }

    // その日の0時から23:59:59まで
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // 全カレンダーのIDを取得
    const calendarIds = calendars.map(cal => cal.id);

    // イベントを取得
    const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);

    // 終日イベントとタイムイベントを分けて整理
    const sortedEvents = events
      .filter(event => event.title && event.title.trim() !== '')
      .sort((a, b) => {
        // 終日イベントを先に
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;

        // 開始時刻でソート
        return new Date(a.startDate) - new Date(b.startDate);
      });

    return sortedEvents;
  } catch (error) {
    console.error('Error getting events for date:', error);
    return [];
  }
};

/**
 * イベントを簡潔な形式にフォーマット
 * @param {object} event - カレンダーイベント
 * @returns {object} フォーマット済みイベント
 */
export const formatEvent = (event) => {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  return {
    id: event.id,
    title: event.title,
    allDay: event.allDay,
    startTime: event.allDay ? null : formatTime(startDate),
    endTime: event.allDay ? null : formatTime(endDate),
    location: event.location,
    notes: event.notes,
  };
};

/**
 * 時刻をフォーマット (HH:MM)
 * @param {Date} date - 日時
 * @returns {string} フォーマット済み時刻
 */
function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * イベントのサマリーテキストを生成
 * @param {array} events - イベントの配列
 * @param {number} maxLength - 最大表示件数
 * @returns {string} サマリーテキスト
 */
export const getEventsSummary = (events, maxLength = 3) => {
  if (events.length === 0) {
    return '予定なし';
  }

  const eventTitles = events.slice(0, maxLength).map(e => e.title);

  if (events.length > maxLength) {
    return `${eventTitles.join('、')}、他${events.length - maxLength}件`;
  }

  return eventTitles.join('、');
};
