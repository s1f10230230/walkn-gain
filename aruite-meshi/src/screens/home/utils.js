// HomeScreen small helpers

export const isToday = (date) => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

export const isFuture = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
};

export const formatMonthDay = (date, locale = 'ja') => {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (locale === 'en') return `${m}/${d}`;
  if (locale === 'zh-Hans') return `${m}月${d}日`;
  return `${m}月${d}日`;
};

export const formatMonthYear = (date, locale = 'ja') => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (locale === 'en') return `${y}/${m}`;
  if (locale === 'zh-Hans') return `${y}年${m}月`;
  return `${y}年${m}月`;
};

