import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  Alert,
  ActionSheetIOS,
  Modal,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ImagePicker from 'react-native-image-crop-picker';
import PaperTexture from './PaperTexture';
import PhotoLightbox from './PhotoLightbox';
import { MOODS, getMoodByValue } from './MoodSelector';
import { getDailyData, saveDailyData } from '../utils/storage';
import { toDateKeyLocal } from '../utils/calculations';
import { useSubscription, isDateWithinLimit } from '../contexts/SubscriptionContext';

const COLORS = {
  teal: '#00A896',
  orange: '#FF6B35',
  textDark: '#2D3142',
  textGray: '#9CA5B5',
};

export default function DiaryCard({
  theme,
  selectedDate,
  steps = 0,
  calories = 0,
  distance = 0,
  todayEvents = [],
  formatNumber,
  showFlipHint = false,
  flipHintText = '',
}) {
  const { isPremium, limits, presentPaywall } = useSubscription();
  const [memo, setMemo] = useState('');
  const [photos, setPhotos] = useState([]);
  const [mood, setMood] = useState(null); // 気分データ（1-5）
  const [showLightbox, setShowLightbox] = useState(false);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const moodScaleAnim = useRef(new Animated.Value(0)).current;

  const dateKey = toDateKeyLocal(selectedDate);

  // ストーリー（日記・写真）が30日以前でロックされているかチェック
  const isStoryLocked = !isPremium && !isDateWithinLimit(selectedDate, limits.storyDays);

  useEffect(() => {
    loadDayData();
  }, [dateKey]);

  const loadDayData = async () => {
    const data = await getDailyData(dateKey);
    setMemo(data?.dailyMemo || '');
    setPhotos(data?.photos || []);
    setMood(data?.mood || null);
  };

  const saveMemo = async (text) => {
    setMemo(text);
    const data = await getDailyData(dateKey);
    await saveDailyData(dateKey, { ...data, dailyMemo: text });
  };

  const savePhotos = async (newPhotos) => {
    setPhotos(newPhotos);
    const data = await getDailyData(dateKey);
    await saveDailyData(dateKey, { ...data, photos: newPhotos });
  };

  const saveMood = async (moodValue) => {
    // 同じ値をタップしたら選択解除
    const newMood = mood === moodValue ? null : moodValue;
    setMood(newMood);
    const data = await getDailyData(dateKey);
    await saveDailyData(dateKey, { ...data, mood: newMood });
  };

  const openMoodPicker = () => {
    setShowMoodPicker(true);
    Animated.spring(moodScaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const closeMoodPicker = () => {
    Animated.timing(moodScaleAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setShowMoodPicker(false));
  };

  const handleSelectMood = async (moodValue) => {
    await saveMood(moodValue);
    closeMoodPicker();
  };

  const selectedMoodData = getMoodByValue(mood);

  const handleAddPhoto = async () => {
    if (photos.length >= limits.photosPerDay) {
      if (!isPremium) {
        Alert.alert(
          'Pro機能',
          `無料プランでは1日${limits.photosPerDay}枚までです。`,
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: 'Proを見る', onPress: () => presentPaywall() },
          ]
        );
      }
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['キャンセル', 'カメラで撮影', 'ライブラリから選択'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) await pickImage('camera');
          else if (buttonIndex === 2) await pickImage('library');
        }
      );
    } else {
      Alert.alert('写真を追加', '', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'カメラで撮影', onPress: () => pickImage('camera') },
        { text: 'ライブラリから選択', onPress: () => pickImage('library') },
      ]);
    }
  };

  const pickImage = async (source) => {
    try {
      // 16:9のカード比率に合わせたクロップ設定
      const cropOptions = {
        width: 1600,
        height: 900,
        cropping: true,
        cropperToolbarTitle: '写真の位置を調整',
        cropperChooseText: '完了',
        cropperCancelText: 'キャンセル',
        compressImageQuality: 0.8,
        mediaType: 'photo',
      };

      let image;
      if (source === 'camera') {
        image = await ImagePicker.openCamera(cropOptions);
      } else {
        image = await ImagePicker.openPicker(cropOptions);
      }

      if (image && image.path) {
        const newPhotos = [...photos, image.path].slice(0, limits.photosPerDay);
        await savePhotos(newPhotos);
      }
    } catch (error) {
      // ユーザーがキャンセルした場合は何もしない
      if (error.code !== 'E_PICKER_CANCELLED') {
        console.error('Error picking image:', error);
      }
    }
  };

  const handlePhotoTap = () => setShowLightbox(true);

  const handleDeletePhoto = async (index) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    await savePhotos(newPhotos);
  };

  const maxPhotos = limits.photosPerDay;
  const canAddMore = photos.length < maxPhotos;
  const displaySteps = formatNumber ? formatNumber(steps) : steps.toLocaleString();

  return (
    <>
      <View style={[styles.card, { backgroundColor: theme.isDark ? theme.card : '#FFFFFF' }]}>
        <PaperTexture isDark={theme.isDark} />

        {/* タイトル */}
        <Text style={[styles.cardTitle, { color: COLORS.teal }]}>TODAY'S MEMORY</Text>

        {isStoryLocked ? (
          /* ========== ロック状態 ========== */
          <>
            {/* ロックされた写真エリア */}
            <View style={[styles.photoArea, styles.lockedPhotoArea]}>
              <View style={styles.lockedOverlay}>
                <MaterialCommunityIcons name="lock" size={32} color={COLORS.teal} />
              </View>
            </View>

            {/* 統計エリア（常に表示） */}
            <View style={styles.statsSection}>
              <Text style={[styles.stepsText, { color: COLORS.orange }]}>
                {displaySteps} STEPS
              </Text>
              <View style={styles.subStats}>
                <View style={styles.subStatItem}>
                  <MaterialCommunityIcons name="map-marker-distance" size={16} color={COLORS.teal} />
                  <Text style={[styles.subStatText, { color: theme.isDark ? theme.text : COLORS.textDark }]}>
                    {distance.toFixed(1)} km
                  </Text>
                </View>
                <View style={styles.subStatItem}>
                  <MaterialCommunityIcons name="fire" size={16} color={COLORS.orange} />
                  <Text style={[styles.subStatText, { color: theme.isDark ? theme.text : COLORS.textDark }]}>
                    {calories.toFixed(0)} kcal
                  </Text>
                </View>
              </View>
            </View>

            {/* ロックメッセージ */}
            <View style={styles.lockedMessageContainer}>
              <MaterialCommunityIcons name="archive-lock" size={24} color={COLORS.teal} />
              <Text style={[styles.lockedMessageTitle, { color: theme.isDark ? theme.text : COLORS.textDark }]}>
                思い出はアーカイブに保存されています
              </Text>
              <Text style={[styles.lockedMessageSub, { color: theme.isDark ? theme.textSecondary : COLORS.textGray }]}>
                PROにアップグレードすると、すべての日記と写真を振り返ることができます
              </Text>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={presentPaywall}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="crown" size={16} color="#FFF" />
                <Text style={styles.upgradeButtonText}>PROで思い出を解放</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* ========== 通常状態 ========== */
          <>
            {/* 写真エリア */}
            <View style={styles.photoArea}>
              {photos.length > 0 ? (
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  onPress={handlePhotoTap}
                  activeOpacity={0.9}
                >
                  <Image source={{ uri: photos[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  {canAddMore && (
                    <View style={styles.addMoreBadge}>
                      <MaterialCommunityIcons name="plus" size={16} color="#FFF" />
                    </View>
                  )}
                  <View style={styles.photoCountBadge}>
                    <Text style={styles.photoCountText}>{photos.length}/{maxPhotos === Infinity ? '∞' : maxPhotos}</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.photoButton} onPress={handleAddPhoto}>
                  <MaterialCommunityIcons name="camera" size={40} color={COLORS.orange} />
                  <Text style={styles.photoButtonText}>CAPTURE TODAY</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 統計エリア */}
            <View style={styles.statsSection}>
              <View style={styles.statsRow}>
                <View style={styles.statsLeft}>
                  <Text style={[styles.stepsText, { color: COLORS.orange }]}>
                    {displaySteps} STEPS
                  </Text>
                  <View style={styles.subStats}>
                    <View style={styles.subStatItem}>
                      <MaterialCommunityIcons name="map-marker-distance" size={16} color={COLORS.teal} />
                      <Text style={[styles.subStatText, { color: theme.isDark ? theme.text : COLORS.textDark }]}>
                        {distance.toFixed(1)} km
                      </Text>
                    </View>
                    <View style={styles.subStatItem}>
                      <MaterialCommunityIcons name="fire" size={16} color={COLORS.orange} />
                      <Text style={[styles.subStatText, { color: theme.isDark ? theme.text : COLORS.textDark }]}>
                        {calories.toFixed(0)} kcal
                      </Text>
                    </View>
                  </View>
                </View>
                {/* ムードボタン */}
                <TouchableOpacity
                  style={[
                    styles.moodButton,
                    selectedMoodData
                      ? { backgroundColor: `${selectedMoodData.color}20`, borderColor: selectedMoodData.color }
                      : { borderColor: theme.isDark ? theme.border : '#D0D0D0', borderStyle: 'dashed' }
                  ]}
                  onPress={openMoodPicker}
                  activeOpacity={0.7}
                >
                  {selectedMoodData ? (
                    <Text style={styles.moodEmoji}>{selectedMoodData.emoji}</Text>
                  ) : (
                    <MaterialCommunityIcons
                      name="emoticon-outline"
                      size={24}
                      color={theme.isDark ? theme.textSecondary : COLORS.textGray}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* メモエリア */}
            <View style={styles.memoSection}>
              <View style={[styles.marginLine, { backgroundColor: theme.isDark ? 'rgba(245, 169, 169, 0.4)' : '#F5A9A9' }]} />
              <View style={styles.ruledLineContainer}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={[styles.ruledLine, { borderColor: theme.isDark ? 'rgba(208, 208, 208, 0.3)' : '#D0D0D0' }]} />
                ))}
              </View>
              <TextInput
                placeholder="今日のハイライトは？"
                placeholderTextColor={theme.isDark ? theme.textTertiary : COLORS.textGray}
                style={[styles.memoInput, { color: theme.isDark ? theme.text : COLORS.textDark }]}
                value={memo}
                onChangeText={saveMemo}
                multiline
              />
            </View>

            {/* 今日の予定 */}
            <View style={[styles.eventsSection, { borderColor: theme.isDark ? theme.border : '#E0E0E0' }]}>
              <View style={styles.eventsHeader}>
                <MaterialCommunityIcons name="calendar-outline" size={16} color={COLORS.teal} />
                <Text style={[styles.eventsTitle, { color: theme.isDark ? theme.text : COLORS.textDark }]}>
                  今日の予定
                </Text>
              </View>
              {todayEvents && todayEvents.length > 0 ? (
                todayEvents.map((event, index) => (
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
                <View style={styles.noEventsContainer}>
                  <Text style={[styles.noEventsText, { color: theme.isDark ? theme.textTertiary : COLORS.textGray }]}>
                    予定なし
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* フリップヒント */}
        {showFlipHint && (
          <View style={styles.flipHint}>
            <MaterialCommunityIcons name="rotate-3d-variant" size={14} color={COLORS.textGray} />
            <Text style={styles.flipHintText}>{flipHintText}</Text>
          </View>
        )}
      </View>

      <PhotoLightbox
        visible={showLightbox}
        photos={photos}
        initialIndex={0}
        onClose={() => setShowLightbox(false)}
        onDelete={handleDeletePhoto}
        onAddPhoto={handleAddPhoto}
        canAddMore={canAddMore}
      />

      {/* ムードピッカーモーダル */}
      <Modal
        visible={showMoodPicker}
        transparent
        animationType="none"
        onRequestClose={closeMoodPicker}
      >
        <TouchableOpacity
          style={styles.moodPickerOverlay}
          activeOpacity={1}
          onPress={closeMoodPicker}
        >
          <Animated.View
            style={[
              styles.moodPickerContainer,
              {
                backgroundColor: theme.isDark ? theme.card : '#FFFFFF',
                transform: [{ scale: moodScaleAnim }],
                opacity: moodScaleAnim,
              },
            ]}
          >
            <Text style={[styles.moodPickerTitle, { color: theme.isDark ? theme.text : COLORS.textDark }]}>
              今日の気分は？
            </Text>
            <View style={styles.moodPickerRow}>
              {MOODS.map((moodItem) => (
                <TouchableOpacity
                  key={moodItem.value}
                  style={[
                    styles.moodPickerItem,
                    mood === moodItem.value && {
                      backgroundColor: `${moodItem.color}30`,
                      borderColor: moodItem.color,
                    },
                  ]}
                  onPress={() => handleSelectMood(moodItem.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moodPickerEmoji}>{moodItem.emoji}</Text>
                  <Text
                    style={[
                      styles.moodPickerLabel,
                      { color: mood === moodItem.value ? moodItem.color : (theme.isDark ? theme.textSecondary : COLORS.textGray) },
                    ]}
                  >
                    {moodItem.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#8B8178',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E8E4DF',
    borderLeftWidth: 3,
    borderLeftColor: '#E0DCD6',
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'Roboto',
    letterSpacing: 1,
  },
  photoArea: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderStyle: 'dashed',
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
    color: '#FF6B35',
    letterSpacing: 1,
  },
  addMoreBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoCountText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statsSection: {
    marginBottom: 12,
  },
  stepsText: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsLeft: {
    flex: 1,
  },
  moodButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodPickerContainer: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  moodPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  moodPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  moodPickerItem: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 54,
  },
  moodPickerEmoji: {
    fontSize: 32,
  },
  moodPickerLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  memoSection: {
    position: 'relative',
    marginBottom: 8,
  },
  marginLine: {
    position: 'absolute',
    left: 24,
    top: 0,
    bottom: 0,
    width: 1,
  },
  ruledLineContainer: {
    position: 'absolute',
    left: 32,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: -1,
  },
  ruledLine: {
    height: 1,
    marginTop: 28,
    borderStyle: 'dashed',
    borderWidth: 0,
    borderBottomWidth: 1,
  },
  memoInput: {
    paddingLeft: 32,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 163,
    lineHeight: 28,
  },
  eventsSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 4,
    minHeight: 100,
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
    fontSize: 11,
    fontWeight: '600',
    width: 45,
  },
  eventTitle: {
    fontSize: 12,
    flex: 1,
  },
  noEventsContainer: {
    paddingVertical: 8,
  },
  noEventsText: {
    fontSize: 12,
    paddingVertical: 2,
  },
  flipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8E4DF',
  },
  flipHintText: {
    fontSize: 11,
    color: '#9CA5B5',
    marginLeft: 4,
    fontWeight: '500',
  },
  // ロック状態のスタイル
  lockedPhotoArea: {
    backgroundColor: 'rgba(0, 168, 150, 0.08)',
  },
  lockedOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  lockedMessageContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  lockedMessageTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  lockedMessageSub: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00A896',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
});
