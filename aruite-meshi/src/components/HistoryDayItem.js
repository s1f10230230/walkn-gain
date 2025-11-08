import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { getTheme } from "../utils/theme";
import { getEventsForDate, getEventsSummary } from "../utils/calendar";
import { getDayNote } from "../utils/dayNotes";

const { width } = Dimensions.get("window");

export default function HistoryDayItem({
  dayData,
  getWeekdayShort,
  formatNumber,
  onDatePress,
}) {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
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
  }, [dayData.date]);

  const progressPercentage = Math.min(
    (dayData.steps / dayData.goal) * 100,
    100
  );
  const barWidth = (width - 100) * (progressPercentage / 100);

  return (
    <TouchableOpacity
      style={styles.dayItem}
      activeOpacity={0.7}
      onPress={() => onDatePress && onDatePress(dayData.date)}
    >
      <View style={styles.dayHeader}>
        <View style={styles.dateContainer}>
          <Text style={[styles.dayDate, { color: theme.textSecondary }]}>
            {dayData.date.slice(5)} ({getWeekdayShort(new Date(dayData.date))})
          </Text>
          {noteText && (
            <View
              style={[styles.commentDot, { backgroundColor: theme.primary }]}
            />
          )}
        </View>
        <Text style={[styles.daySteps, { color: theme.text }]}>
          {formatNumber(dayData.steps)}
        </Text>
      </View>
      <View
        style={[styles.progressBarContainer, { backgroundColor: theme.border }]}
      >
        <View
          style={[
            styles.progressBar,
            { width: barWidth, backgroundColor: theme.primary },
          ]}
        />
      </View>

      {/* コメント情報 */}
      {noteText && (
        <View style={styles.dayInfoRow}>
          <Text style={styles.dayInfoIcon}>💬</Text>
          <Text
            style={[styles.dayInfoText, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {noteText}
          </Text>
        </View>
      )}

      {/* カレンダー情報 */}
      {!loading && events.length > 0 && (
        <View style={styles.dayInfoRow}>
          <Text style={styles.dayInfoIcon}>📅</Text>
          <Text
            style={[styles.dayInfoText, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {getEventsSummary(events)}
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
    marginBottom: 8,
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
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  dayInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  dayInfoIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  dayInfoText: {
    fontSize: 13,
    flex: 1,
  },
});
