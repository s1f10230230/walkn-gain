import React, { useMemo, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Share as RNShare,
  NativeModules,
  Platform,
  ScrollView,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../i18n/I18nProvider";
import { getTheme } from "../utils/theme";
import { getTodayDateString } from "../utils/calculations";
import { logEvent } from "../utils/analytics";
import {
  getSettings,
  getUserProfile,
  getMultipleDaysData,
  getAllDailyStepsTotal,
} from "../utils/storage";
import {
  calculateCalories,
  calculateDistance,
} from "../utils/calculations";
import { getStepsHybrid, getStepsInRange } from "../utils/healthKit";
import { calculateFoodAmount, getFoodById } from "../data/foodDatabase";
import { getDayNote } from "../utils/dayNotes";

export default function SharePreviewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { t, formatNumber } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const viewRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [canCapture, setCanCapture] = useState(true);

  const captureAndShare = async (target = "share") => {
    if (busy) return;
    setBusy(true);
    try {
      const node = viewRef.current;
      const uri = await captureNodeToFile(node);
      if (!uri) return;
      const title =
        target === "instagram"
          ? "Share to Instagram"
          : target === "x"
          ? "Share to X"
          : "Share";
      await shareFile(uri, title);
    } finally {
      setBusy(false);
    }
  };

  const saveImage = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const node = viewRef.current;
      const uri = await captureNodeToFile(node);
      if (!uri) return;
      try {
        const MediaLibrary = require("expo-media-library");
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission required",
            "Photo library access is needed to save images."
          );
          return;
        }
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert("Saved", "Image saved to your Photos.");
      } catch (e) {
        Alert.alert(
          "Save failed",
          "Install expo-media-library to enable saving."
        );
      }
    } finally {
      setBusy(false);
    }
  };

  // selectedDateは文字列形式（YYYY-MM-DD）で受け取る
  const selectedDateStr = route?.params?.selectedDate;
  const displayDate = selectedDateStr || getTodayDateString();

  // selectedDateをDateオブジェクトに変換（タイムゾーン考慮）
  const selectedDate = useMemo(() => {
    if (selectedDateStr) {
      const [year, month, day] = selectedDateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day, 12, 0, 0, 0); // 正午に設定してタイムゾーン問題回避
      return date;
    }
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    return date;
  }, [selectedDateStr]);
  const steps = route?.params?.steps ?? 0;
  const goal = route?.params?.goal ?? 10000;
  const [streakDays, setStreakDays] = useState(route?.params?.streakDays ?? 0);

  // Fixed to 'Stoic Sport' template
  const [aspect] = useState("9:16");
  const [consistency, setConsistency] = useState(0); // 0-7
  const [foodLine, setFoodLine] = useState(null); // "🍜 0.8杯"（今は未表示）
  const [weekTotal, setWeekTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [allTimeTotal, setAllTimeTotal] = useState(0);
  const [stride, setStride] = useState(72); // cm
  const [dayNote, setDayNote] = useState(""); // その日のひとこと
  const achieved = steps >= goal;

  const badgeText = useMemo(() => {
    if (achieved) return "今日の目標達成";
    const remaining = Math.max(goal - steps, 0);
    return `あと ${formatNumber(remaining)} 歩で目標`;
  }, [achieved, steps, goal]);

  useEffect(() => {
    try {
      logEvent("share_card_generated", {
        template: "stoic",
        aspect,
        saved: false,
      });
    } catch (_) {}
  }, [aspect]);

  useEffect(() => {
    // Detect if view capture is available (Expo Go/web won't have RNViewShot)
    try {
      if (Platform.OS === "web" || !NativeModules?.RNViewShot) {
        setCanCapture(false);
      }
    } catch (_) {
      setCanCapture(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Consistency（直近7日間の目標達成日数） & 週合計（シェア画面の選択日から直近）
      try {
        const s = await getSettings();
        const base = new Date(selectedDate);
        base.setHours(12, 0, 0, 0);

        // 選択日から遡る直近7日（選択日を含む）
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(base);
          d.setDate(base.getDate() - i);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          weekDates.push(`${y}-${m}-${dd}`);
        }

        let wTotal = 0;
        let count = 0;
        console.log('📊 WEEK calculation - dates (from selectedDate):', weekDates);
        for (const dateStr of weekDates) {
          const [year, month, day] = dateStr.split('-').map(Number);
          const date = new Date(year, month - 1, day);
          const start = new Date(date);
          start.setHours(0, 0, 0, 0);
          const end = new Date(date);
          end.setHours(23, 59, 59, 999);
          // 端末の“今日”に該当する場合のみ現在時刻まで
          if (date.toDateString() === new Date().toDateString()) {
            end.setTime(Date.now());
          }
          try {
            const result = await getStepsHybrid(start, end);
            const daySteps = result.steps || 0;
            console.log(`📊 ${dateStr}: ${daySteps} steps`);
            wTotal += daySteps;
            if (daySteps >= (s?.dailyGoal || 10000)) count++;
          } catch (error) {
            console.error(`Error getting steps for ${dateStr}:`, error);
          }
        }
        console.log('📊 WEEK total:', wTotal);
        setConsistency(count);
        setWeekTotal(wTotal);

        // その日時点のストリーク（選択日までの連続達成日数）
        const streak = await calculateStreakUpToDate(displayDate, s?.dailyGoal || 10000);
        setStreakDays(streak);
      } catch (_) {}

      // Month (その日から過去30日) - HealthKit/Pedometerから取得
      try {
        const targetDate = new Date(selectedDate);
        targetDate.setHours(12, 0, 0, 0);
        let mTotal = 0;
        for (let i = 0; i < 30; i++) {
          const date = new Date(targetDate);
          date.setDate(targetDate.getDate() - i);
          const start = new Date(date);
          start.setHours(0, 0, 0, 0);
          const end = new Date(date);
          end.setHours(23, 59, 59, 999);
          if (date.toDateString() === new Date().toDateString()) {
            end.setTime(Date.now());
          }
          try {
            const { steps: daySteps } = await getStepsHybrid(start, end);
            mTotal += (daySteps || 0);
          } catch (_) {}
        }
        console.log('📊 MONTH total:', mTotal);
        setMonthTotal(mTotal);
      } catch (_) {}

      // All-time（全期間）: HealthKit/Google Fitから選択日までの全期間合計（フォールバックでローカル保存分）
      try {
        const end = new Date(selectedDate);
        // 選択日が“今日”なら現在時刻まで、それ以外はその日の23:59:59まで
        if (end.toDateString() === new Date().toDateString()) {
          // keep end as now
        } else {
          end.setHours(23, 59, 59, 999);
        }
        // 十分古い開始日に設定（10年分）
        const start = new Date(end);
        start.setFullYear(end.getFullYear() - 10);
        start.setHours(0, 0, 0, 0);

        let allTotal = 0;
        try {
          const daily = await getStepsInRange(start, end);
          if (Array.isArray(daily) && daily.length > 0) {
            allTotal = daily.reduce((acc, d) => acc + (Number(d?.steps) || 0), 0);
          }
        } catch (_) {}

        // フォールバック: ローカル保存分の合計
        if (!allTotal || allTotal <= 0) {
          try {
            const storedSum = await getAllDailyStepsTotal();
            if (Number.isFinite(storedSum)) allTotal = storedSum;
          } catch (_) {}
        }

        console.log('📊 ALL total (all-time):', allTotal);
        setAllTimeTotal(allTotal);
      } catch (_) {}

      // Meshi行は現在非表示（将来用に計算のみ保持）
      try {
        const s = await getSettings();
        const p = await getUserProfile();
        if (p?.stride) setStride(p.stride);
        const cal = calculateCalories(steps, p?.weight || 65);
        const fid = s?.defaultFood || "ramen";
        const item = getFoodById(fid);
        if (item) {
          const amount = calculateFoodAmount(cal, fid);
          setFoodLine(`${item.emoji} ${amount}${item.unit}`);
        }
      } catch (_) {}

      // その日のひとことを取得
      try {
        const note = await getDayNote(displayDate);
        setDayNote(note);
      } catch (_) {}
    })();
  }, [displayDate]);

  return (
    <View
      style={[
        styles.outerContainer,
        {
          paddingTop: insets.top + 6,
          paddingBottom: insets.bottom + 12,
          backgroundColor: theme.background,
        },
      ]}
    >
      <Text style={[styles.header, { color: theme.text }]}>
        {t("settings.share.previewTitle") || "記録カード"}
      </Text>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Share Card Preview */}
      <View
        ref={viewRef}
        collapsable={false}
        style={[
          styles.preview,
          {
            backgroundColor:
              steps / goal > 0.5
                ? "#FFF9F0" // 薄いオレンジ（目標50%以上）
                : theme.card, // 通常の背景
          },
        ]}
      >
        {/* Bold diagonal stripes - stronger sport vibe */}
        <View
          style={[styles.diagStripe, { backgroundColor: theme.accent + "15" }]}
        />
        <View
          style={[styles.diagStripe2, { backgroundColor: theme.accent + "08" }]}
        />
        <View
          style={[styles.diagStripe3, { backgroundColor: theme.accent + "05" }]}
        />

        {/* Small logo (monogram) */}
        <View style={[styles.logoMonogram, { backgroundColor: "transparent" }]}>
          <Image
            source={require("../../assets/logo-small.png")}
            style={{ width: 32, height: 32, borderRadius: 8 }}
            resizeMode="contain"
          />
        </View>

        {/* Date badge with highlight */}
        <View
          style={[
            styles.dateBadge,
            { backgroundColor: theme.accent + "20", borderColor: theme.accent },
          ]}
        >
          <Text style={[styles.dateText, { color: theme.accent }]}>
            {displayDate}
          </Text>
        </View>

        {/* TODAY label above steps */}
        <Text style={[styles.todayLabel, { color: theme.textSecondary }]}>
          TODAY'S STEPS
        </Text>

        {/* Main steps - BIGGER & BOLDER with ORANGE */}
        <View style={styles.stepsContainer}>
          <Text style={[styles.steps, { color: theme.primary }]}>
            {formatNumber(steps)}
          </Text>
          <Text style={[styles.achievementRate, { color: theme.textSecondary }]}>
            {goal > 0 ? Math.round((steps / goal) * 100) : 0}%
          </Text>
          <View
            style={[styles.glowEffect, { backgroundColor: theme.primary }]}
          />
        </View>

        {/* Goal progress bar with gradient effect */}
        <View
          style={[
            styles.progressBarContainer,
            { backgroundColor: theme.border },
          ]}
        >
          <View
            style={[
              styles.progressBar,
              {
                width: `${goal > 0 ? Math.min((steps / goal) * 100, 100) : 0}%`,
                backgroundColor: theme.primary,
              },
            ]}
          >
            <View style={[styles.progressShine, { backgroundColor: "#FFF" }]} />
          </View>
        </View>

        {/* Subline: STREAK with FIRE • CONSISTENCY */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <View style={styles.metricWithIcon}>
              <Text style={[styles.fireIcon]}>🔥</Text>
              <Text style={[styles.metricValue, { color: theme.primary }]}>
                {streakDays}
              </Text>
            </View>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
              STREAK
            </Text>
          </View>
          <View
            style={[styles.metricDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: theme.text }]}>
              {consistency}/7
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
              CONSISTENCY
            </Text>
          </View>
          <View
            style={[styles.metricDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: theme.text }]}>
              {formatNumber(goal)}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
              GOAL
            </Text>
          </View>
        </View>

        {/* Stats grid: WEEK / MONTH / ALL-TIME - Vertical stack */}
        <View style={styles.statsGrid}>
          <View style={styles.statRow}>
            <View
              style={[
                styles.statIconCircle,
                { backgroundColor: theme.accent + "20" },
              ]}
            >
              <Text style={[styles.statIcon, { color: theme.accent }]}>W</Text>
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                WEEK
              </Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatNumberCompact(weekTotal)}
              </Text>
            </View>
            <Text style={[styles.statDistance, { color: theme.textSecondary }]}>
              {formatKm(calculateDistance(weekTotal, stride))}
            </Text>
          </View>

          <View
            style={[styles.statDivider, { backgroundColor: theme.border }]}
          />

          <View style={styles.statRow}>
            <View
              style={[
                styles.statIconCircle,
                { backgroundColor: theme.accent + "20" },
              ]}
            >
              <Text style={[styles.statIcon, { color: theme.accent }]}>M</Text>
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                MONTH
              </Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatNumberCompact(monthTotal)}
              </Text>
            </View>
            <Text style={[styles.statDistance, { color: theme.textSecondary }]}>
              {formatKm(calculateDistance(monthTotal, stride))}
            </Text>
          </View>

          <View
            style={[styles.statDivider, { backgroundColor: theme.border }]}
          />

          <View style={styles.statRow}>
            <View
              style={[
                styles.statIconCircle,
                { backgroundColor: theme.accent + "20" },
              ]}
            >
              <Text style={[styles.statIcon, { color: theme.accent }]}>∞</Text>
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                ALL TIME
              </Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatNumberCompact(allTimeTotal)}
              </Text>
            </View>
            <Text style={[styles.statDistance, { color: theme.textSecondary }]}>
              {formatKm(calculateDistance(allTimeTotal, stride))}
            </Text>
          </View>
        </View>

        {/* 今日のひとこと */}
        {dayNote ? (
          <View style={styles.dayNoteContainer}>
            <Text style={[styles.dayNoteLabel, { color: theme.textSecondary }]}>
              💬 {t('todayNote.titleToday') || '今日のひとこと'}
            </Text>
            <Text style={[styles.dayNoteText, { color: theme.text }]}>
              「{dayNote}」
            </Text>
          </View>
        ) : null}

        {/* Modern footer with subtle branding */}
        <View style={styles.footer}>
          <View style={styles.footerDivider}>
            <View
              style={[styles.footerLine, { backgroundColor: theme.border }]}
            />
          </View>
          <View style={styles.footerContent}>
            <Text style={[styles.footerBrand, { color: theme.textSecondary }]}>
              WALK'N GAIN
            </Text>
            <Text style={[styles.footerTagline, { color: theme.textSecondary }]}>
              その一歩が、思い出になる。
            </Text>
            {achieved && (
              <View style={styles.achievementBadge}>
                <Text
                  style={[styles.achievementIcon, { color: theme.primary }]}
                >
                  ✓
                </Text>
                <Text
                  style={[styles.achievementText, { color: theme.primary }]}
                >
                  GOAL ACHIEVED
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      </ScrollView>

      {/* Action buttons - outside card (not included in screenshot) */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
          onPress={() => navigation.goBack()}
          disabled={busy}
        >
          <Text style={[styles.buttonText, { color: theme.text }]}>
            ← {t("common.back") || "戻る"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.buttonPrimary,
            { backgroundColor: theme.accent, opacity: busy || !canCapture ? 0.5 : 1 },
          ]}
          disabled={busy || !canCapture}
          onPress={canCapture ? saveImage : () => {
            Alert.alert(
              "キャプチャは未対応",
              Platform.select({
                web: "Webではスクリーンキャプチャに対応していません。",
                default:
                  "Expo Goでは画像保存ができません。開発クライアント（expo run / EAS dev）でお試しください。",
              })
            );
          }}
        >
          <Text style={styles.buttonPrimaryText}>
            💾 {t("settings.share.saveImage") || "画像を保存"}
          </Text>
        </TouchableOpacity>
      </View>
      {!canCapture && (
        <Text style={[styles.disabledHint, { color: theme.textSecondary }]}>
          画像の保存/共有はExpo GoやWebでは利用できません。
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, paddingHorizontal: 20 },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  header: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  preview: {
    borderRadius: 24,
    paddingTop: 48,
    paddingBottom: 36,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  dateBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  dateText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  todayLabel: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 24,
  },
  stepsContainer: {
    position: "relative",
    marginBottom: 16,
    alignItems: "center",
  },
  steps: {
    fontSize: 72,
    fontWeight: "900",
    letterSpacing: -2,
  },
  achievementRate: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
    opacity: 0.6,
  },
  glowEffect: {
    position: "absolute",
    bottom: -8,
    left: "25%",
    right: "25%",
    height: 6,
    borderRadius: 3,
    opacity: 0.4,
    shadowColor: "#FF7043",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
  },
  progressBarContainer: {
    width: "100%",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  progressBar: {
    height: "100%",
    borderRadius: 5,
    position: "relative",
    overflow: "hidden",
  },
  progressShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    opacity: 0.2,
    borderRadius: 5,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 16,
    paddingVertical: 12,
  },
  metricItem: {
    alignItems: "center",
    flex: 1,
  },
  metricWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  fireIcon: {
    fontSize: 20,
    marginTop: -2,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  metricDivider: {
    width: 1,
    height: 40,
    opacity: 0.2,
  },
  statsGrid: {
    width: "100%",
    marginTop: 8,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  statIcon: {
    fontSize: 18,
    fontWeight: "900",
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statDistance: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 8,
  },
  statDivider: {
    width: "100%",
    height: 1,
    opacity: 0.1,
  },
  footer: {
    width: "100%",
    marginTop: 16,
    paddingTop: 16,
  },
  footerDivider: {
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  footerLine: {
    width: "50%",
    height: 1,
    opacity: 0.12,
  },
  footerContent: {
    alignItems: "center",
    gap: 8,
  },
  footerBrand: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.5,
    opacity: 0.3,
  },
  footerTagline: {
    fontSize: 11,
    fontWeight: "400",
    marginTop: 4,
    opacity: 0.5,
    textAlign: "center",
  },
  achievementBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  achievementIcon: {
    fontSize: 14,
    fontWeight: "900",
  },
  achievementText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
    marginTop: 8,
  },
  badgeIcon: {
    fontSize: 18,
    fontWeight: "900",
  },
  badge: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  brandContainer: {
    marginTop: 16,
    alignSelf: "center",
  },
  watermark: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    opacity: 0.4,
  },
  logoMonogram: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  diagStripe: {
    position: "absolute",
    top: -80,
    left: -120,
    width: 500,
    height: 12,
    transform: [{ rotate: "-15deg" }],
    opacity: 0.8,
  },
  diagStripe2: {
    position: "absolute",
    top: -50,
    left: -120,
    width: 500,
    height: 8,
    transform: [{ rotate: "-15deg" }],
    opacity: 0.5,
  },
  diagStripe3: {
    position: "absolute",
    top: -25,
    left: -120,
    width: 500,
    height: 6,
    transform: [{ rotate: "-15deg" }],
    opacity: 0.3,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    paddingBottom: 8,
  },
  button: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
  },
  buttonText: { fontSize: 14, fontWeight: "700" },
  buttonPrimary: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  circleBtnText: { color: "#fff", fontWeight: "900", letterSpacing: 0.5 },
  disabledHint: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 8,
    opacity: 0.7,
  },
  dayNoteContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  dayNoteLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 8,
    opacity: 0.6,
  },
  dayNoteText: {
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
  },
});

// km display with one decimal (>=100km no decimals)
function formatKm(km) {
  const n = Number(km || 0);
  if (!Number.isFinite(n)) return "0 km";
  const digits = n >= 100 ? 0 : 1;
  return `${n.toFixed(digits)} km`;
}

// Simple number format with commas (e.g., 10,000, 123,456)
function formatNumberCompact(num) {
  const n = Number(num || 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ja-JP");
}

// その日時点のストリークを計算（その日までのデータのみ使用）
async function calculateStreakUpToDate(targetDateStr, goalSteps) {
  try {
    const targetDate = new Date(targetDateStr + 'T00:00:00');
    targetDate.setHours(0, 0, 0, 0);

    let streak = 0;
    let currentDate = new Date(targetDate);

    // targetDateから過去に遡って連続達成日数をカウント（ローカル日付で評価）
    for (let i = 0; i < 365; i++) {
      const y = currentDate.getFullYear();
      const m = String(currentDate.getMonth() + 1).padStart(2, '0');
      const d = String(currentDate.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`; // ローカル日付のキー

      const dayData = await getMultipleDaysData([dateKey]);
      const steps = Number(dayData?.[0]?.steps || 0);
      if (steps >= goalSteps) {
        streak++;
        // 前日に移動
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    console.error('Streak calculation error:', error);
    return 0;
  }
}


async function captureNodeToFile(nodeRef) {
  try {
    // Prevent RedBox: check native module presence before requiring the JS wrapper
    if (!NativeModules || !NativeModules.RNViewShot) {
      // In Expo Go or without a dev/bare build, RNViewShot won't exist
      Alert.alert(
        "Capture unavailable",
        Platform.select({
          web: "Capturing is not supported on web.",
          default:
            "Install and rebuild with react-native-view-shot (dev client or bare).",
        })
      );
      return null;
    }

    const { captureRef } = require("react-native-view-shot");
    const uri = await captureRef(nodeRef, {
      format: "png",
      quality: 1,
      result: "tmpfile",
    });
    return uri;
  } catch (e) {
    Alert.alert("Capture failed", "view-shot is not available.");
    return null;
  }
}

async function shareFile(uri, dialogTitle = "Share") {
  try {
    const Sharing = require("expo-sharing");
    if (Sharing && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, {
        dialogTitle,
        mimeType: "image/png",
        UTI: "public.png",
      });
      return true;
    }
  } catch (_) {}
  try {
    await RNShare.share({ url: uri, message: "" });
    return true;
  } catch (_) {}
  Alert.alert("Share not available");
  return false;
}
