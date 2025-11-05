// Lightweight analytics utility (local queue + console)
// No external network; suitable for Expo dev and MVP.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'analytics_events_queue_v1';

export const initAnalytics = async () => {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    if (!existing) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  } catch (_) {}
};

export const logEvent = async (name, params = {}) => {
  try {
    const event = {
      name,
      params: sanitizeParams(params),
      ts: Date.now(),
    };
    console.log(`[analytics] ${name}`, event.params || {});
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(event);
    // keep last 200 events
    if (arr.length > 200) arr.splice(0, arr.length - 200);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    // best-effort
  }
};

export const getQueuedEvents = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
};

export const clearQueuedEvents = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  } catch (_) {}
};

const sanitizeParams = (params) => {
  try {
    const clone = JSON.parse(JSON.stringify(params || {}));
    return clone;
  } catch (_) {
    return {};
  }
};

