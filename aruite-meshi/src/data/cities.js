// 日本の主要都市リスト（天気情報取得用）

export const CITIES = [
  { id: 'tokyo', name: '東京', nameEn: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { id: 'osaka', name: '大阪', nameEn: 'Osaka', lat: 34.6937, lon: 135.5023 },
  { id: 'nagoya', name: '名古屋', nameEn: 'Nagoya', lat: 35.1815, lon: 136.9066 },
  { id: 'fukuoka', name: '福岡', nameEn: 'Fukuoka', lat: 33.5904, lon: 130.4017 },
  { id: 'sapporo', name: '札幌', nameEn: 'Sapporo', lat: 43.0642, lon: 141.3469 },
  { id: 'sendai', name: '仙台', nameEn: 'Sendai', lat: 38.2682, lon: 140.8694 },
  { id: 'hiroshima', name: '広島', nameEn: 'Hiroshima', lat: 34.3853, lon: 132.4553 },
  { id: 'kyoto', name: '京都', nameEn: 'Kyoto', lat: 35.0116, lon: 135.7681 },
  { id: 'kobe', name: '神戸', nameEn: 'Kobe', lat: 34.6901, lon: 135.1955 },
  { id: 'yokohama', name: '横浜', nameEn: 'Yokohama', lat: 35.4437, lon: 139.6380 },
  { id: 'kawasaki', name: '川崎', nameEn: 'Kawasaki', lat: 35.5309, lon: 139.7028 },
  { id: 'saitama', name: 'さいたま', nameEn: 'Saitama', lat: 35.8617, lon: 139.6455 },
  { id: 'chiba', name: '千葉', nameEn: 'Chiba', lat: 35.6074, lon: 140.1065 },
  { id: 'kitakyushu', name: '北九州', nameEn: 'Kitakyushu', lat: 33.8834, lon: 130.8751 },
  { id: 'kumamoto', name: '熊本', nameEn: 'Kumamoto', lat: 32.8031, lon: 130.7079 },
  { id: 'okayama', name: '岡山', nameEn: 'Okayama', lat: 34.6553, lon: 133.9195 },
  { id: 'niigata', name: '新潟', nameEn: 'Niigata', lat: 37.9161, lon: 139.0364 },
  { id: 'hamamatsu', name: '浜松', nameEn: 'Hamamatsu', lat: 34.7108, lon: 137.7261 },
  { id: 'shizuoka', name: '静岡', nameEn: 'Shizuoka', lat: 34.9769, lon: 138.3831 },
  { id: 'sagamihara', name: '相模原', nameEn: 'Sagamihara', lat: 35.5531, lon: 139.3741 },
  { id: 'kagoshima', name: '鹿児島', nameEn: 'Kagoshima', lat: 31.5966, lon: 130.5571 },
  { id: 'naha', name: '那覇', nameEn: 'Naha', lat: 26.2124, lon: 127.6809 },
];

export const getCityById = (id) => {
  return CITIES.find(city => city.id === id);
};

export const getCityByName = (name) => {
  return CITIES.find(city => city.name === name || city.nameEn === name);
};

export const DEFAULT_CITY = 'tokyo';
