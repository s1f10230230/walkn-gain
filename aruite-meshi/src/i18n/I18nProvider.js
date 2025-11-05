import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { TRANSLATIONS } from './translations';
import { getSettings, saveSettings } from '../utils/storage';

const I18nContext = createContext({
  locale: 'ja',
  setLocale: () => {},
  t: (key) => key,
  formatNumber: (n) => String(n),
  getWeekdayShort: (date) => String(date?.getDay?.() ?? ''),
  formatWeekRange: (mondayDate) => '',
});

const SUPPORTED = ['ja', 'en', 'zh-Hans'];

const mapToSupported = (raw) => {
  if (!raw) return 'ja';
  const lower = raw.toLowerCase();
  if (lower.startsWith('ja')) return 'ja';
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('zh')) {
    // default to Simplified if unspecified
    if (lower.includes('hant') || lower.includes('tw') || lower.includes('hk')) {
      return 'zh-Hans'; // fallback to Simplified for now
    }
    return 'zh-Hans';
  }
  return 'en';
};

const detectSystemLocale = () => {
  try {
    const loc = Intl?.DateTimeFormat?.().resolvedOptions().locale;
    return mapToSupported(loc);
  } catch (e) {
    return 'ja';
  }
};

const getNested = (obj, path) => {
  return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);
};

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState('ja');

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      const chosen = s?.language && s.language !== 'auto' ? s.language : detectSystemLocale();
      setLocaleState(SUPPORTED.includes(chosen) ? chosen : 'ja');
    })();
  }, []);

  const t = useMemo(() => {
    const dict = TRANSLATIONS[locale] || TRANSLATIONS.ja;
    return (key, params = {}) => {
      const val = getNested(dict, key);
      if (!val) return key;
      if (typeof val === 'string') {
        return val.replace(/\{(\w+)\}/g, (_, p1) => (params[p1] != null ? String(params[p1]) : ''));
      }
      return val;
    };
  }, [locale]);

  const formatNumber = (n) => {
    try {
      return new Intl.NumberFormat(locale).format(n);
    } catch (e) {
      return String(n);
    }
  };

  const getWeekdayShort = (date) => {
    const dict = TRANSLATIONS[locale] || TRANSLATIONS.ja;
    const arr = dict.weekdaysShort || TRANSLATIONS.ja.weekdaysShort;
    const d = date?.getDay?.();
    return typeof d === 'number' ? arr[d] : '';
  };

  const formatWeekRange = (monday) => {
    if (!(monday instanceof Date)) return '';
    const start = monday;
    const end = new Date(monday);
    end.setDate(monday.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();

    const dict = TRANSLATIONS[locale] || TRANSLATIONS.ja;
    const mShort = dict.monthsShort || TRANSLATIONS.ja.monthsShort;

    const sM = start.getMonth();
    const sD = start.getDate();
    const eM = end.getMonth();
    const eD = end.getDate();

    if (locale === 'en') {
      const sLabel = `${mShort[sM]} ${sD}`;
      const eLabel = sameMonth ? `${eD}` : `${mShort[eM]} ${eD}`;
      return `${sLabel}–${eLabel}`;
    }

    if (locale === 'zh-Hans') {
      if (sameMonth) return `${sM + 1}月${sD}日—${eD}日`;
      return `${sM + 1}月${sD}日—${eM + 1}月${eD}日`;
    }

    // ja default
    if (sameMonth) return `${sM + 1}月${sD}日〜${eD}日`;
    return `${sM + 1}月${sD}日〜${eM + 1}月${eD}日`;
  };

  const setLocale = async (next) => {
    const mapped = next === 'auto' ? detectSystemLocale() : (SUPPORTED.includes(next) ? next : 'ja');
    setLocaleState(mapped);
    // best-effort persist into settings.language
    try {
      const s = await getSettings();
      await saveSettings({ ...s, language: next });
    } catch (e) {
      // ignore
    }
  };

  const value = useMemo(
    () => ({ locale, setLocale, t, formatNumber, getWeekdayShort, formatWeekRange }),
    [locale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
