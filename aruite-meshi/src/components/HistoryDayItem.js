import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Platform,
  useWindowDimensions,
} from "react-native";
import { getTheme } from "../utils/theme";
import { getEventsForDate, getEventsSummary } from "../utils/calendar";
import { getDayNote } from "../utils/dayNotes";
import { getWeatherIconName } from "../utils/weather";
import { AppIcon } from "./AppIcon";

export default function HistoryDayItem({
  dayData,
  getWeekdayShort,
  formatNumber,
  onDatePress,
  t, // 翻訳関数（未来日表示用）
  contentWidth,
}) {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { width: screenWidth } = useWindowDimensions();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");

  // 未来日かどうか
  const isFuture = dayData.isFuture || false;

  useEffect(() => {
    // 未来日の場合はロードをスキップ
    if (isFuture) {
      setLoading(false);
      return;
    }

    const loadDayInfo = async () => {
      try {
        // カレンダーイベントを取得（development buildが必要）
        try {
          const date = new Date(dayData.date);
          const dayEvents = await getEventsForDate(date);
          setEvents(dayEvents);
        } catch (calendarError) {
          console.log("Calendar not available (needs development build)");
          // カレンダーが使えない場合はスキップ
        }

        // コメントを取得
        const note = await getDayNote(dayData.date);
        setNoteText(note || "");
      } catch (error) {
        console.error("Error loading day info:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDayInfo();
  }, [dayData.date, isFuture]);

  const progressPercentage = isFuture ? 0 : Math.min(
    (dayData.steps / dayData.goal) * 100,
    100
  );
  const maxWidth = typeof contentWidth === "number" ? contentWidth : screenWidth;
  const barMaxWidth = Math.max(0, maxWidth - 80);
  const barWidth = barMaxWidth * (progressPercentage / 100);
  const isGoalAchieved = !isFuture && dayData.steps >= dayData.goal;

  // Progress bar color based on achievement
  const getProgressBarColor = () => {
    if (isGoalAchieved) return '#00A896'; // teal for achieved
    if (progressPercentage >= 70) return '#FFD93D'; // yellow for close
    return '#FFDDC1'; // light beige for in progress
  };

  // 未来日のスタイル
  const futureOpacity = isFuture ? 0.4 : 1;

  return (
    <TouchableOpacity
      style={[
        styles.dayItem,
        isGoalAchieved && { backgroundColor: '#00A89608', borderRadius: 8, marginHorizontal: -8, paddingHorizontal: 8, paddingVertical: 8 },
        isFuture && styles.futureItem,
      ]}
      activeOpacity={isFuture ? 1 : 0.7}
      onPress={() => !isFuture && onDatePress && onDatePress(dayData.date)}
      disabled={isFuture}
    >
      <View style={styles.dayHeader}>
        <View style={styles.dateContainer}>
          {isGoalAchieved && (
            <Text style={{ fontSize: 14, marginRight: 4 }}>🏆</Text>
          )}
          <Text style={[styles.dayDate, { color: theme.textSecondary, opacity: futureOpacity }]}>
            {dayData.date.slice(5)} ({getWeekdayShort(new Date(dayData.date))})
          </Text>
          {noteText && !isFuture && (
            <View
              style={[styles.commentDot, { backgroundColor: theme.primary }]}
            />
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isFuture ? (
            <Text style={[styles.futureText, { color: theme.textSecondary }]}>
              {t ? t('history.future.noData') : '—'}
            </Text>
          ) : (
            <>
              <Text style={[styles.daySteps, { color: isGoalAchieved ? '#00A896' : theme.text, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) }]}>
                {formatNumber(dayData.steps)}
              </Text>
              {isGoalAchieved && (
                <Text style={{ fontSize: 10, color: '#00A896', fontWeight: '600', marginLeft: 4 }}>✓</Text>
              )}
            </>
          )}
        </View>
      </View>
      <View
        style={[styles.progressBarContainer, { backgroundColor: theme.border, opacity: futureOpacity }]}
      >
        {!isFuture && (
          <View
            style={[
              styles.progressBar,
              { width: barWidth, backgroundColor: getProgressBarColor(), opacity: isGoalAchieved ? 1 : 0.7 },
            ]}
          />
        )}
      </View>

      {/* コメント情報 */}
      {noteText && (
        <View style={styles.dayInfoRow}>
          <AppIcon name="comment" size={12} color="#9CA5B5" style={{ marginRight: 6 }} />
          <Text
            style={[styles.dayInfoText, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {noteText}
          </Text>
        </View>
      )}

      {!loading && events.length > 0 && (
        <View style={styles.dayInfoRow}>
          <AppIcon name="calendar" size={12} color="#9CA5B5" style={{ marginRight: 6 }} />
          <Text
            style={[styles.dayInfoText, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {getEventsSummary(events)}
          </Text>
        </View>
      )}

      {/* Weather Info */}
      {dayData.weather && (
        <View style={styles.dayInfoRow}>
          <AppIcon 
            name={getWeatherIconName(dayData.weather.code)} 
            size={12} 
            color={theme.textSecondary} 
            style={{ marginRight: 6 }} 
          />
          <Text style={[styles.dayInfoText, { color: theme.textSecondary }]}>
            {Math.round(dayData.weather.maxTemp)}° / {Math.round(dayData.weather.minTemp)}°
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dayItem: {
    marginBottom: 15,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dayDate: {
    fontSize: 14,
    color: "#616161",
  },
  commentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF7043",
  },
  daySteps: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
  },
  progressBarContainer: {
    height: 4,  // Thinner bar (was 8)
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
    opacity: 0.7,  // Muted color
  },
  dayInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginLeft: 2,
  },
  dayInfoIcon: {
    fontSize: 12,  // Smaller icon
    marginRight: 6,
  },
  dayInfoText: {
    fontSize: 11,  // Smaller text (was 13)
    flex: 1,
  },
  // 未来日スタイル
  futureItem: {
    opacity: 0.6,
  },
  futureText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
