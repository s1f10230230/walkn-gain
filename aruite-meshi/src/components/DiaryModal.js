import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  StyleSheet, 
  TextInput, 
  Animated,
  PanResponder,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTheme } from '../utils/theme';
import { useI18n } from '../i18n/I18nProvider';
import { getDailyData } from '../utils/storage';
import { getDayNote, setDayNote } from '../utils/dayNotes';
import { toDateKeyLocal, getDayOfWeek } from '../utils/calculations';
import { AppIcon } from './AppIcon';
import { getWeatherIconName } from '../utils/weather';

// Helper for editorial weather text
const getEditorialWeather = (code) => {
  if (code === undefined) return '---';
  if (code <= 1) return 'Clear';
  if (code <= 3) return 'Cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain';
  if (code <= 86) return 'Snow';
  return 'Storm';
};

export default function DiaryModal({ visible, onClose, initialDate }) {
  const insets = useSafeAreaInsets();
  const theme = getTheme();
  const { t, locale } = useI18n();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const paperWidth = Math.min(screenWidth - 40, 380);
  const paperHeight = Math.min(screenHeight - 100, 600);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyData, setDailyData] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Animation for page turn effect
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Ref to keep track of current date for PanResponder
  const currentDateRef = useRef(currentDate);

  useEffect(() => {
    currentDateRef.current = currentDate;
  }, [currentDate]);

  useEffect(() => {
    if (visible && initialDate) {
      const d = new Date(initialDate);
      setCurrentDate(d);
      currentDateRef.current = d;
    }
  }, [visible, initialDate]);

  useEffect(() => {
    if (visible) {
      loadData(currentDate);
    }
  }, [currentDate, visible]);

  const loadData = async (date) => {
    const dateKey = toDateKeyLocal(date);
    const data = await getDailyData(dateKey);
    const note = await getDayNote(dateKey);
    
    setDailyData(data);
    setNoteText(note || "");
  };

  const handleSaveNote = async () => {
    const dateKey = toDateKeyLocal(currentDate);
    await setDayNote(dateKey, noteText);
    setIsEditing(false);
  };

  const changeDate = (days) => {
    const baseDate = currentDateRef.current;
    
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: days * -50, duration: 100, useNativeDriver: true })
    ]).start(() => {
      const newDate = new Date(baseDate);
      newDate.setDate(newDate.getDate() + days);
      setCurrentDate(newDate);
      
      slideAnim.setValue(days * 50);
      
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      ]).start();
    });
  };

  // Swipe Logic
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50) {
          changeDate(-1);
        } else if (gestureState.dx < -50) {
          changeDate(1);
        }
      },
    })
  ).current;

  const renderPaperStack = () => {
    return (
      <View
        style={[styles.stackContainer, { width: paperWidth, height: paperHeight }]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.paperLayer, styles.layer5]} />
        <View style={[styles.paperLayer, styles.layer4]} />
        <View style={[styles.paperLayer, styles.layer3]} />
        <View style={[styles.paperLayer, styles.layer2]} />
        
        <Animated.View 
          style={[
            styles.paperLayer, 
            styles.mainPage,
            { 
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={['#ffffff', '#fffefa', '#fefcf0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: 4, overflow: 'hidden' }}
          >
            <View style={styles.textureOverlay} />
            {renderPageContent()}
            <LinearGradient
              colors={['rgba(212,175,55,0.1)', 'transparent']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 0 }}
              style={styles.rightEdgeShadow}
            />
          </LinearGradient>
        </Animated.View>
      </View>
    );
  };

  const renderPageContent = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    const dayOfWeek = getDayOfWeek(currentDate);
    
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const monthStr = monthNames[currentDate.getMonth()];

    const isAchieved = dailyData?.steps && dailyData.steps >= (dailyData.goal || 8000);

    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.pageContent}>
          {/* Header: Date */}
          <View style={[styles.headerRow, isAchieved && styles.headerRowAchieved]}>
            <View style={styles.dateGroup}>
              <Text style={[styles.dateMonth, isAchieved && { color: theme.primary }]}>{monthStr}</Text>
              <Text style={styles.dateDay}>{day}</Text>
            </View>
            <View style={[styles.weatherGroup, isAchieved && { backgroundColor: 'rgba(255, 107, 53, 0.1)' }]}>
              {dailyData?.weather?.code !== undefined ? (
                <AppIcon 
                  name={getWeatherIconName(dailyData.weather.code)} 
                  size={20} 
                  color={isAchieved ? theme.primary : '#9CA5B5'} 
                />
              ) : (
                <Text style={styles.weatherText}>---</Text>
              )}
            </View>
          </View>

          {/* Photo Area */}
          <TouchableOpacity 
            activeOpacity={0.9}
            style={styles.photoFrame}
          >
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>CAPTURE</Text>
              <View style={styles.proBadge}>
                <Text style={styles.proText}>PRO</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{dailyData?.steps ? dailyData.steps.toLocaleString() : '0'}</Text>
              <Text style={styles.statLabel}>STEPS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{dailyData?.distance ? (dailyData.distance / 1000).toFixed(1) : '0.0'}</Text>
              <Text style={styles.statLabel}>KM</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{dailyData?.calories ? Math.round(dailyData.calories) : '0'}</Text>
              <Text style={styles.statLabel}>KCAL</Text>
            </View>
          </View>

          {/* Lined Text Area */}
          <View style={styles.linesContainer}>
            {[...Array(6)].map((_, i) => (
              <View key={i} style={styles.lineRow}>
                <View style={styles.line} />
              </View>
            ))}
            
            <TextInput
              style={styles.textInput}
              multiline
              value={noteText}
              onChangeText={setNoteText}
              onBlur={handleSaveNote}
              placeholder="Write your day..."
              placeholderTextColor="#9CA3AF"
              returnKeyType="default"
              blurOnSubmit={true}
            />
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => changeDate(-1)} style={styles.navButton}>
              <Text style={styles.navButtonText}>PREV</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>CLOSE</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => changeDate(1)} style={styles.navButton}>
              <Text style={styles.navButtonText}>NEXT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={[styles.container, { width: paperWidth + 20, height: paperHeight + 20 }]}>
              {renderPaperStack()}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const serifFont = Platform.select({ ios: 'Georgia', android: 'serif' });

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stackContainer: {
    position: 'relative',
  },
  paperLayer: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: '#fffef7',
  },
  layer5: {
    top: 8, left: 8, right: -8, bottom: -8,
    backgroundColor: '#fef9e7',
    shadowColor: "#000", shadowOffset: { width: 2, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6,
  },
  layer4: {
    top: 6, left: 6, right: -6, bottom: -6,
    backgroundColor: '#fef9e8',
    shadowColor: "#000", shadowOffset: { width: 2, height: 4 }, shadowOpacity: 0.08, shadowRadius: 5,
  },
  layer3: {
    top: 4, left: 4, right: -4, bottom: -4,
    backgroundColor: '#fefae9',
    shadowColor: "#000", shadowOffset: { width: 2, height: 4 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  layer2: {
    top: 2, left: 2, right: -2, bottom: -2,
    backgroundColor: '#fefbea',
    shadowColor: "#000", shadowOffset: { width: 1, height: 2 }, shadowOpacity: 0.04, shadowRadius: 2,
  },
  mainPage: {
    top: 0, left: 0, right: 0, bottom: 0,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16,
    elevation: 8,
  },
  textureOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    backgroundColor: 'transparent', 
  },
  rightEdgeShadow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 12,
  },
  pageContent: {
    flex: 1,
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerRowAchieved: {
    borderBottomColor: '#FF6B35', // theme.primary
  },
  dateGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  dateMonth: {
    fontSize: 14,
    fontFamily: serifFont,
    color: '#666',
    marginRight: 8,
    letterSpacing: 1,
  },
  dateDay: {
    fontSize: 32,
    fontFamily: serifFont,
    color: '#1a1a1a',
  },
  weatherGroup: {
    backgroundColor: '#f4f4f4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  weatherText: {
    fontSize: 10,
    fontFamily: serifFont,
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  photoFrame: {
    width: '100%',
    aspectRatio: 4/3,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholder: {
    alignItems: 'center',
  },
  photoPlaceholderText: {
    color: '#ccc',
    fontSize: 12,
    fontFamily: serifFont,
    letterSpacing: 2,
    marginBottom: 6,
  },
  proBadge: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  proText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 8,
  },
  statItem: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statValue: {
    fontSize: 18,
    fontFamily: serifFont,
    color: '#1a1a1a',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 8,
    fontFamily: serifFont,
    color: '#999',
    letterSpacing: 1,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#eee',
  },
  linesContainer: {
    flex: 1,
    position: 'relative',
  },
  lineRow: {
    height: 32,
    justifyContent: 'flex-end',
  },
  line: {
    height: 1,
    backgroundColor: '#eee',
  },
  textInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    fontSize: 14,
    fontFamily: serifFont,
    lineHeight: 32,
    color: '#333',
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  navButton: {
    padding: 10,
  },
  navButtonText: {
    fontSize: 10,
    fontFamily: serifFont,
    color: '#999',
    letterSpacing: 1,
  },
  closeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#1a1a1a',
    fontSize: 10,
    fontFamily: serifFont,
    letterSpacing: 2,
  },
});
