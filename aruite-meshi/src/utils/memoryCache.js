/**
 * メモリキャッシュユーティリティ
 * TTL（有効期限）付きのシンプルなインメモリキャッシュ
 */

// キャッシュストレージ
const cache = new Map();

// デフォルトTTL（ミリ秒）
const DEFAULT_TTL = {
  weather: 60 * 60 * 1000,        // 1時間
  hourlyWeather: 60 * 60 * 1000,  // 1時間
  pastWeather: Infinity,           // 永久（過去の天気は変わらない）
  location: 5 * 60 * 1000,        // 5分
  dailySteps: 5 * 60 * 1000,      // 5分
  hourlySteps: 5 * 60 * 1000,     // 5分
};

/**
 * キャッシュにデータを保存
 * @param {string} key - キャッシュキー
 * @param {any} data - 保存するデータ
 * @param {number} ttl - 有効期限（ミリ秒）。省略時はキーに応じたデフォルト値
 */
export const setCache = (key, data, ttl = null) => {
  const cacheType = key.split(':')[0];
  const expiresIn = ttl ?? DEFAULT_TTL[cacheType] ?? 5 * 60 * 1000;
  const expiresAt = expiresIn === Infinity ? Infinity : Date.now() + expiresIn;

  cache.set(key, {
    data,
    expiresAt,
    createdAt: Date.now(),
  });
};

/**
 * キャッシュからデータを取得
 * @param {string} key - キャッシュキー
 * @returns {any|null} キャッシュデータ。期限切れまたは存在しない場合はnull
 */
export const getCache = (key) => {
  const entry = cache.get(key);

  if (!entry) return null;

  // 期限切れチェック
  if (entry.expiresAt !== Infinity && Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.data;
};

/**
 * キャッシュが有効かチェック
 * @param {string} key - キャッシュキー
 * @returns {boolean}
 */
export const hasValidCache = (key) => {
  return getCache(key) !== null;
};

/**
 * 特定のキャッシュを削除
 * @param {string} key - キャッシュキー
 */
export const deleteCache = (key) => {
  cache.delete(key);
};

/**
 * プレフィックスに一致するキャッシュをすべて削除
 * @param {string} prefix - キープレフィックス（例: 'weather:'）
 */
export const clearCacheByPrefix = (prefix) => {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
};

/**
 * 全キャッシュをクリア
 */
export const clearAllCache = () => {
  cache.clear();
};

/**
 * 期限切れのキャッシュを掃除
 */
export const cleanExpiredCache = () => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt !== Infinity && now > entry.expiresAt) {
      cache.delete(key);
    }
  }
};

/**
 * キャッシュの統計情報を取得（デバッグ用）
 */
export const getCacheStats = () => {
  const stats = {
    totalEntries: cache.size,
    validEntries: 0,
    expiredEntries: 0,
    types: {},
  };

  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    const type = key.split(':')[0];
    stats.types[type] = (stats.types[type] || 0) + 1;

    if (entry.expiresAt === Infinity || now <= entry.expiresAt) {
      stats.validEntries++;
    } else {
      stats.expiredEntries++;
    }
  }

  return stats;
};

// キャッシュキー生成ヘルパー
export const cacheKeys = {
  weather: (date) => `weather:${date}`,
  hourlyWeather: (date) => `hourlyWeather:${date}`,
  pastWeather: (date) => `pastWeather:${date}`,
  location: () => 'location:current',
  dailySteps: (date) => `dailySteps:${date}`,
  hourlySteps: (date) => `hourlySteps:${date}`,
};

export default {
  set: setCache,
  get: getCache,
  has: hasValidCache,
  delete: deleteCache,
  clearByPrefix: clearCacheByPrefix,
  clearAll: clearAllCache,
  cleanExpired: cleanExpiredCache,
  stats: getCacheStats,
  keys: cacheKeys,
};
