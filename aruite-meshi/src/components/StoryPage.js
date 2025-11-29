import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getDailyData, saveDailyData } from '../utils/storage';
import { toDateKeyLocal } from '../utils/calculations';
import { getWeatherIcon } from '../utils/weather';
import { useI18n } from '../i18n/I18nProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// カラーパレット
// ============================================
const COLORS = {
  cardBg: '#FFFDF9',
  teal: '#00A896',
  orange: '#FF6B35',
  textDark: '#2D3142',
  textGray: '#9CA5B5',
  lineGray: '#E0E0E0',
};

export default function StoryPage({
  theme,
  selectedDate,
  weather,
  onUpgrade,
  isPremium,
  steps = 0,
  calories = 0,
  distance = 0,
  todayEvents = [],
}) {
  const { t } = useI18n();
  const [memo, setMemo] = useState('');
  const [photos, setPhotos] = useState([]);
  const dateKey = toDateKeyLocal(selectedDate);

  // ============================================
  // データ読み込み
  // ============================================
  useEffect(() => {
    loadDayData();
  }, [dateKey]);

  const loadDayData = async () => {
    const data = await getDailyData(dateKey);
    setMemo(data?.dailyMemo || '');
    setPhotos(data?.photos || []);
  };

  const saveMemo = async (text) => {
    setMemo(text);
    const data = await getDailyData(dateKey);
    await saveDailyData(dateKey, { ...data, dailyMemo: text });
  };

  // 距離計算
  const km = distance > 0 ? distance.toFixed(1) : ((steps || 0) * 0.0007).toFixed(1);
  const kcal = calories || Math.floor((steps || 0) * 0.04);
  const maxPhotos = isPremium ? 4 : 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================
          メインカード
          ============================================ */}
      <View style={[styles.cardPaper, { backgroundColor: theme.isDark ? theme.card : COLORS.cardBg }]}>

        {/* ============================================
            📷 写真エリア (16:9)
            ============================================ */}
        <View style={[styles.photoArea, { borderColor: COLORS.teal }]}>
          {photos.length > 0 ? (
            <Image source={{ uri: photos[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <TouchableOpacity
              style={styles.photoButton}
              onPress={() => {
                // TODO: 写真機能
                console.log('Add photo');
              }}
            >
              <MaterialCommunityIcons name="camera" size={40} color={COLORS.orange} />
              <Text style={styles.photoButtonText}>CAPTURE TODAY</Text>
            </TouchableOpacity>
          )}

          {/* 天気バッジ */}
          {weather && (
            <View style={styles.weatherBadge}>
              <Text style={styles.weatherIcon}>{getWeatherIcon(weather.code)}</Text>
            </View>
          )}
        </View>

        {/* ============================================
            📊 統計エリア
            ============================================ */}
        <View style={styles.statsSection}>
          <Text style={styles.stepsText}>
            {(steps || 0).toLocaleString()} STEPS
          </Text>
          <View style={styles.subStats}>
            <View style={styles.subStatItem}>
              <MaterialCommunityIcons name="map-marker-distance" size={16} color={COLORS.teal} />
              <Text style={[styles.subStatText, { color: theme.isDark ? theme.text : COLORS.textDark }]}>
                {km} km
              </Text>
            </View>
            <View style={styles.subStatItem}>
              <MaterialCommunityIcons name="fire" size={16} color={COLORS.teal} />
              <Text style={[styles.subStatText, { color: theme.isDark ? theme.text : COLORS.textDark }]}>
                {kcal} kcal
              </Text>
            </View>
          </View>
        </View>

        {/* ============================================
            📝 日記エリア
            ============================================ */}
        <View style={styles.journalSection}>
          <View style={styles.journalInputRow}>
            <MaterialCommunityIcons
              name="pencil-outline"
              size={18}
              color={theme.isDark ? theme.textSecondary : COLORS.textDark}
              style={{ marginRight: 8 }}
            />
            <TextInput
              placeholder="今日のハイライトは？"
              placeholderTextColor={theme.isDark ? theme.textTertiary : COLORS.textGray}
              style={[styles.journalInput, { color: theme.isDark ? theme.text : COLORS.textDark }]}
              value={memo}
              onChangeText={saveMemo}
              multiline
            />
          </View>
          {/* 罫線 */}
          <View style={[styles.ruledLine, { backgroundColor: theme.isDark ? theme.border : COLORS.lineGray }]} />
          <View style={[styles.ruledLine, { backgroundColor: theme.isDark ? theme.border : COLORS.lineGray }]} />
        </View>

        {/* ============================================
            📅 今日の予定
            ============================================ */}
        <View style={[styles.eventsSection, { borderColor: theme.isDark ? theme.border : COLORS.lineGray }]}>
          <View style={styles.eventsHeader}>
            <MaterialCommunityIcons name="calendar-outline" size={16} color={COLORS.teal} />
            <Text style={[styles.eventsTitle, { color: theme.isDark ? theme.text : COLORS.textDark }]}>
              今日の予定
            </Text>
          </View>
          {todayEvents && todayEvents.length > 0 ? (
            todayEvents.slice(0, 3).map((event, index) => (
              <View key={index} style={styles.eventItem}>
                <Text style={[styles.eventTime, { color: theme.isDark ? theme.textSecondary : COLORS.textGray }]}>
                  {event.time || ''}
                </Text>
                <Text style={[styles.eventTitle, { color: theme.isDark ? theme.text : COLORS.textDark }]} numberOfLines={1}>
                  {event.title}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.noEventsText, { color: theme.isDark ? theme.textTertiary : COLORS.textGray }]}>
              予定なし
            </Text>
          )}
        </View>

        {/* ============================================
            🔒 PROバナー
            ============================================ */}
        {!isPremium && (
          <TouchableOpacity style={styles.proBanner} onPress={onUpgrade}>
            <Text style={styles.proBannerText}>🔓 PRO: 写真を追加 & 過去のストーリーを見る</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

// ============================================
// スタイル
// ============================================
const styles = StyleSheet.create({
  // コンテナ
  container: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },

  // カード本体
  cardPaper: {
    borderRadius: 20,
    padding: 16,
    shadowColor: '#1B1F23',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },

  // 写真エリア (16:9)
  photoArea: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  photoButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.orange,
    letterSpacing: 1,
  },
  weatherBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherIcon: {
    fontSize: 18,
  },

  // 統計エリア
  statsSection: {
    marginBottom: 16,
  },
  stepsText: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.orange,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  subStatText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },

  // 日記エリア
  journalSection: {
    marginBottom: 16,
  },
  journalInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lineGray,
    paddingBottom: 8,
  },
  journalInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 40,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  ruledLine: {
    height: 1,
    marginTop: 28,
  },

  // 予定エリア
  eventsSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginBottom: 12,
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventsTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 6,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  eventTime: {
    fontSize: 12,
    fontWeight: '600',
    width: 50,
  },
  eventTitle: {
    fontSize: 13,
    flex: 1,
  },
  noEventsText: {
    fontSize: 13,
    paddingVertical: 4,
  },

  // PROバナー
  proBanner: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 168, 150, 0.1)',
    borderRadius: 10,
    alignItems: 'center',
  },
  proBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.teal,
  },
});
