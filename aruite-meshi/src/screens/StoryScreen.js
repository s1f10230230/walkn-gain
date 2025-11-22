import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  FlatList,
  Dimensions,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getMultipleDaysData, getDailyData, saveDailyData } from '../utils/storage';
import { toDateKeyLocal } from '../utils/calculations';
import DiaryModal from '../components/DiaryModal';

// --- Constants & Theme Colors ---
const { width: SCREEN_WIDTH } = Dimensions.get('window');
// カードの横幅（画面幅から少し余白を引く）
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
// カード間のスペース
const CARD_SPACING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

const COLORS = {
  bgMain: '#F8F4E3', // 全体の背景（少し温かみのあるオフホワイト）
  cardBg: '#FFFDF9', // カードの背景（ほぼ白に近い紙色）
  teal: '#00A896',   // ブランドカラー：ティールグリーン
  orange: '#FF6B35', // アクセントカラー：オレンジ
  textDark: '#2D3142', // 濃い文字色
  textGray: '#9CA5B5', // 薄い文字色
  lineGray: '#E0E0E0', // ノートの罫線色
  shadow: '#1B1F23',   // 影の色
};

// ==========================================
// Component: 上部のカレンダーバー
// ==========================================
const CalendarStrip = ({ data, selectedIndex, onDateSelect }) => {
  const flatListRef = useRef(null);

  // 選択された日付が常に中央に来るようにスクロール制御
  useEffect(() => {
    if (flatListRef.current && data.length > 0) {
      const offset = selectedIndex * 60 - (SCREEN_WIDTH / 2) + 30;
      flatListRef.current.scrollToOffset({ offset, animated: true });
    }
  }, [selectedIndex]);

  const renderItem = ({ item, index }) => {
    const isSelected = index === selectedIndex;
    return (
      <TouchableOpacity 
        style={styles.calendarItemContainer}
        onPress={() => onDateSelect(index)}
      >
        <Text style={[styles.calendarDayName, isSelected && styles.textOrangeBold]}>
          {item.dayName}
        </Text>
        <View style={[styles.calendarNumCircle, isSelected && styles.calendarCircleSelected]}>
          <Text style={[styles.calendarDayNum, isSelected && styles.textWhite]}>
            {item.dayNum}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.calendarStripContainer}>
      <FlatList
        ref={flatListRef}
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.calendarContentContainer}
      />
    </View>
  );
};

// ==========================================
// Component: メインのストーリーカード
// ==========================================
const StoryCard = ({ item, onJournalChange }) => {
  const [journalText, setJournalText] = useState(item.memo || '');

  const handleTextChange = (text) => {
    setJournalText(text);
    onJournalChange(item.date, text);
  };

  return (
    <View style={styles.cardContainerOuter}>
      <View style={styles.cardPaper}>
        {/* --- Photo Area --- */}
        <View style={styles.photoPlaceholder}>
          {item.hasPhoto ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#E1E8ED', justifyContent:'center', alignItems:'center' }]}>
              <MaterialCommunityIcons name="image-outline" size={64} color={COLORS.teal} />
            </View>
          ) : (
            <MaterialCommunityIcons name="camera" size={64} color={COLORS.orange} />
          )}
        </View>

        {/* --- Stats Row --- */}
        <View style={styles.statsRow}>
          <Text style={styles.stepsBigText}>
            {item.steps.toLocaleString()} STEPS
          </Text>
          <View style={styles.subStatsContainer}>
            <View style={styles.subStatItem}>
              <MaterialCommunityIcons name="map-marker-distance" size={18} color={COLORS.teal} />
              <Text style={styles.subStatText}>{item.km} km</Text>
            </View>
            <View style={styles.subStatItem}>
              <MaterialCommunityIcons name="fire" size={18} color={COLORS.teal} />
              <Text style={styles.subStatText}>{item.kcal}</Text>
            </View>
          </View>
        </View>

        {/* --- Journal Entry Area (Ruled Paper Style) --- */}
        <View style={styles.journalArea}>
          <View style={styles.journalInputRow}>
            <MaterialCommunityIcons name="pencil-outline" size={20} color={COLORS.textDark} style={{marginRight: 8}}/>
            <TextInput
              placeholder="What was today's highlight?"
              placeholderTextColor={COLORS.textGray}
              style={styles.journalInput}
              value={journalText}
              onChangeText={handleTextChange}
              multiline
            />
          </View>
          {/* 罫線の表現 */}
          <View style={styles.ruledLine} />
          <View style={styles.ruledLine} />
          <View style={styles.ruledLine} />
        </View>
      </View>
    </View>
  );
};

// ==========================================
// Main Screen: 全体の組み立て
// ==========================================
export default function StoryScreen() {
  const [data, setData] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    // 過去7日分のデータを取得
    const dates = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(toDateKeyLocal(d));
    }

    const historyData = await getMultipleDaysData(dates);
    
    // データを整形
    const formattedData = historyData.map((day, index) => {
      const date = new Date(day.date);
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      
      return {
        id: index.toString(),
        date: day.date,
        dayNum: date.getDate().toString(),
        dayName: dayNames[date.getDay()],
        steps: day.steps || 0,
        km: ((day.steps || 0) * 0.0007).toFixed(1),
        kcal: Math.floor((day.steps || 0) * 0.04),
        hasPhoto: false, // TODO: 写真機能実装時に対応
        memo: day.dailyMemo || '',
      };
    });

    setData(formattedData);
    // 今日（最後の日）を初期選択
    setSelectedIndex(formattedData.length - 1);
  };

  // スクロールが終わった時に現在地のインデックスを計算する
  const onMomentumScrollEnd = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + 20));
    setSelectedIndex(index);
  };

  const handleDateSelect = (index) => {
    setSelectedIndex(index);
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({
        offset: index * (CARD_WIDTH + 20),
        animated: true
      });
    }
  };

  const handleJournalChange = async (dateString, text) => {
    // メモを保存
    const dayData = await getDailyData(dateString);
    await saveDailyData(dateString, { ...dayData, dailyMemo: text });
    
    // ローカルステートを更新
    setData(prevData => prevData.map(item => 
      item.date === dateString ? { ...item, memo: text } : item
    ));
  };

  const renderCardItem = ({ item }) => {
    return <StoryCard item={item} onJournalChange={handleJournalChange} />;
  };

  if (data.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.headerTitle}>MY JOURNEY</Text>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: COLORS.textGray }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header Title */}
      <Text style={styles.headerTitle}>MY JOURNEY</Text>

      {/* Calendar Strip */}
      <CalendarStrip 
        data={data} 
        selectedIndex={selectedIndex}
        onDateSelect={handleDateSelect}
      />

      {/* Main Swipeable Cards */}
      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={data}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={renderCardItem}
          snapToInterval={CARD_WIDTH + 20}
          decelerationRate="fast"
          pagingEnabled={false}
          contentContainerStyle={styles.carouselContentContainer}
          onMomentumScrollEnd={onMomentumScrollEnd}
          initialScrollIndex={selectedIndex}
          getItemLayout={(data, index) => (
            { length: CARD_WIDTH + 20, offset: (CARD_WIDTH + 20) * index, index }
          )}
        />
      </View>

      {/* Diary Modal */}
      <DiaryModal
        visible={showDiaryModal}
        initialDate={data[selectedIndex]?.date}
        onClose={() => setShowDiaryModal(false)}
      />
    </SafeAreaView>
  );
}

// ==========================================
// Styles
// ==========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 10,
  },
  // --- Header & Calendar ---
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.teal,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'Roboto',
  },
  calendarStripContainer: {
    height: 80,
    marginBottom: 10,
  },
  calendarContentContainer: {
    paddingHorizontal: SCREEN_WIDTH / 2 - 30,
    alignItems: 'center',
  },
  calendarItemContainer: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textGray,
    marginBottom: 4,
  },
  calendarNumCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCircleSelected: {
    backgroundColor: COLORS.orange,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  calendarDayNum: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  // --- Carousel & Card ---
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  carouselContentContainer: {
    paddingHorizontal: CARD_SPACING,
    alignItems: 'center',
  },
  cardContainerOuter: {
    width: CARD_WIDTH,
    marginHorizontal: 10,
    paddingVertical: 20,
    alignItems: 'center',
  },
  cardPaper: {
    width: '100%',
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  // --- Inside Card Content ---
  photoPlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    borderWidth: 4,
    borderColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  statsRow: {
    marginBottom: 24,
  },
  stepsBigText: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.orange,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  subStatText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textDark,
    marginLeft: 4,
  },
  // --- Journal Area (Ruled Lines) ---
  journalArea: {
    marginTop: 8,
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
    fontSize: 16,
    color: COLORS.textDark,
    fontWeight: '500',
    minHeight: 24,
  },
  ruledLine: {
    height: 1,
    backgroundColor: COLORS.lineGray,
    marginTop: 32,
  },
  // --- Utils ---
  textOrangeBold: { color: COLORS.orange, fontWeight: 'bold' },
  textWhite: { color: 'white' },
});
