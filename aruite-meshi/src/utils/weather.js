import * as Location from 'expo-location';
import { getCache, setCache, cacheKeys } from './memoryCache';

// OpenMeteo API (Free, No Key)
const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// キャッシュ付き位置情報取得（5分間有効）
const getCachedLocation = async () => {
  const cached = getCache(cacheKeys.location());
  if (cached) {
    return cached;
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    // デフォルト: 東京
    const defaultLocation = { latitude: 35.6895, longitude: 139.6917 };
    setCache(cacheKeys.location(), defaultLocation);
    return defaultLocation;
  }

  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
  setCache(cacheKeys.location(), coords);
  return coords;
};

// WMO Weather Codes mapping
// https://open-meteo.com/en/docs
// Map WMO codes to AppIcon names
export const getWeatherIconName = (code) => {
  if (code === undefined || code === null) return null;
  
  // Clear
  if (code === 0) return 'sunny';
  // Mostly Clear / Partly Cloudy
  if (code === 1 || code === 2 || code === 3) return 'cloudy'; // AppIcon doesn't have partly cloudy yet, use cloudy or sunny
  // Fog
  if (code === 45 || code === 48) return 'cloudy';
  // Drizzle / Rain
  if (code >= 51 && code <= 67) return 'rainy';
  // Snow
  if (code >= 71 && code <= 77) return 'rainy'; // Use rainy for snow for now or add snow icon
  // Showers
  if (code >= 80 && code <= 82) return 'rainy';
  // Snow Showers
  if (code >= 85 && code <= 86) return 'rainy';
  // Thunderstorm
  if (code >= 95 && code <= 99) return 'rainy';

  return 'cloudy';
};

export const getWeatherIcon = (code) => {
  if (code === undefined || code === null) return '❓';
  
  // Clear
  if (code === 0) return '☀️';
  // Mostly Clear / Partly Cloudy
  if (code === 1 || code === 2 || code === 3) return '⛅';
  // Fog
  if (code === 45 || code === 48) return '🌫️';
  // Drizzle
  if (code >= 51 && code <= 57) return '🌧️';
  // Rain
  if (code >= 61 && code <= 67) return '☔';
  // Snow
  if (code >= 71 && code <= 77) return '☃️';
  // Rain Showers
  if (code >= 80 && code <= 82) return '🌦️';
  // Snow Showers
  if (code >= 85 && code <= 86) return '🌨️';
  // Thunderstorm
  if (code >= 95 && code <= 99) return '⚡';

  return '☁️';
};

export const getWeatherDescription = (code, t) => {
  if (code === undefined || code === null) return '';
  
  // Simple mapping, can be expanded with i18n keys
  if (code === 0) return '快晴';
  if (code <= 3) return '晴れ/曇り';
  if (code <= 48) return '霧';
  if (code <= 67) return '雨';
  if (code <= 77) return '雪';
  if (code <= 82) return 'にわか雨';
  if (code <= 86) return '雪';
  if (code <= 99) return '雷雨';
  
  return '曇り';
};

export const fetchWeatherForLocation = async () => {
  try {
    // 今日の日付キー
    const today = new Date().toISOString().split('T')[0];

    // キャッシュチェック（1時間有効）
    const cached = getCache(cacheKeys.weather(today));
    if (cached) {
      return cached;
    }

    // キャッシュ付き位置情報取得
    const { latitude, longitude } = await getCachedLocation();

    // 天気取得
    const weather = await fetchWeather(latitude, longitude);

    if (weather) {
      setCache(cacheKeys.weather(today), weather);
    }

    return weather;

  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
};

const fetchWeather = async (lat, lon) => {
  try {
    // daily=weathercode,temperature_2m_max,temperature_2m_min
    // timezone=auto
    const url = `${BASE_URL}?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data.daily) return null;

    const today = data.daily;
    return {
      code: today.weathercode[0],
      maxTemp: today.temperature_2m_max[0],
      minTemp: today.temperature_2m_min[0],
      date: today.time[0]
    };
  } catch (e) {
    console.error('OpenMeteo fetch error:', e);
    return null;
  }
};

export const fetchWeatherHistory = async (days = 30) => {
  try {
    // キャッシュ付き位置情報取得
    const { latitude: lat, longitude: lon } = await getCachedLocation();

    // Fetch History (Forecast API supports past_days up to 92)
    const url = `${BASE_URL}?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&past_days=${days}&forecast_days=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.daily) return [];

    const { time, weathercode, temperature_2m_max, temperature_2m_min } = data.daily;

    // 各日の天気をキャッシュに保存（永久キャッシュ）
    const results = time.map((date, index) => {
      const weatherData = {
        date,
        weather: {
          code: weathercode[index],
          maxTemp: temperature_2m_max[index],
          minTemp: temperature_2m_min[index],
        }
      };
      // 過去の天気は永久キャッシュ
      setCache(cacheKeys.pastWeather(date), weatherData.weather, Infinity);
      return weatherData;
    });

    return results;

  } catch (e) {
    console.error('OpenMeteo history fetch error:', e);
    return [];
  }
};

export const fetchHourlyWeather = async (date = new Date()) => {
  try {
    // Format date as YYYY-MM-DD
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
    const today = new Date().toISOString().split('T')[0];
    const isPastDay = dateStr < today;

    // キャッシュチェック（過去日は永久、今日は1時間）
    const cached = getCache(cacheKeys.hourlyWeather(dateStr));
    if (cached) {
      return cached;
    }

    // キャッシュ付き位置情報取得
    const { latitude: lat, longitude: lon } = await getCachedLocation();

    // Fetch hourly data for the specific date
    const url = `${BASE_URL}?latitude=${lat}&longitude=${lon}&hourly=weathercode&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.hourly) return Array(24).fill(null);

    const { weathercode } = data.hourly;
    const hourlyData = weathercode.slice(0, 24);

    // キャッシュに保存（過去日は永久、今日は1時間）
    const ttl = isPastDay ? Infinity : 60 * 60 * 1000;
    setCache(cacheKeys.hourlyWeather(dateStr), hourlyData, ttl);

    return hourlyData;

  } catch (e) {
    console.error('OpenMeteo hourly fetch error:', e);
    return Array(24).fill(null);
  }
};

// Generate weather summary from hourly data (AM → PM pattern)
export const getWeatherSummary = (hourlyWeatherCodes) => {
  if (!hourlyWeatherCodes || hourlyWeatherCodes.length !== 24) {
    return { text: '', icon: '❓' };
  }

  // Split into AM (6-12) and PM (12-18) for typical activity hours
  const amCodes = hourlyWeatherCodes.slice(6, 12).filter(c => c !== null && c !== undefined);
  const pmCodes = hourlyWeatherCodes.slice(12, 18).filter(c => c !== null && c !== undefined);

  if (amCodes.length === 0 && pmCodes.length === 0) {
    return { text: '', icon: '❓' };
  }

  // Get most common weather code for each period
  const getMostCommon = (codes) => {
    if (codes.length === 0) return null;
    const counts = {};
    codes.forEach(code => {
      counts[code] = (counts[code] || 0) + 1;
    });
    return parseInt(Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b));
  };

  const amWeather = getMostCommon(amCodes);
  const pmWeather = getMostCommon(pmCodes);

  // If both periods have the same weather, show single icon
  if (amWeather === pmWeather && amWeather !== null) {
    return {
      text: '終日',
      icon: getWeatherIcon(amWeather)
    };
  }

  // If different, show AM → PM pattern
  const amIcon = amWeather !== null ? getWeatherIcon(amWeather) : '';
  const pmIcon = pmWeather !== null ? getWeatherIcon(pmWeather) : '';

  if (amIcon && pmIcon) {
    return {
      text: '午前→午後',
      icon: `${amIcon} → ${pmIcon}`
    };
  } else if (amIcon) {
    return {
      text: '午前',
      icon: amIcon
    };
  } else if (pmIcon) {
    return {
      text: '午後',
      icon: pmIcon
    };
  }

  return { text: '', icon: '❓' };
};
