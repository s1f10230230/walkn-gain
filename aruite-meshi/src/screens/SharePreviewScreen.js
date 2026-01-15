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
  ActivityIndicator,
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
  getTodayData,
  getDailyData,
} from "../utils/storage";
import { getCachedTodayData } from "../utils/cache";
import {
  calculateCalories,
  calculateDistance,
} from "../utils/calculations";
import { calculateFoodAmount, getFoodById } from "../data/foodDatabase";
import { getDayNote } from "../utils/dayNotes";
import { Pedometer } from "expo-sensors";
import { saveTodayData } from "../utils/storage";
import { cacheTodayData } from "../utils/cache";

export default function SharePreviewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { t, formatNumber } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const viewRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [canCapture, setCanCapture] = useState(true);
  const [isFetchingSteps, setIsFetchingSteps] = useState(false);

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
  // データをstateで管理（起動時は0、ロード後に更新）
  const [steps, setSteps] = useState(route?.params?.steps ?? 0);
  const [goal, setGoal] = useState(route?.params?.goal ?? 10000);
  const [isLoading, setIsLoading] = useState(true);
  const streakDays = route?.params?.streakDays ?? 0;
  const totalTrophies = route?.params?.totalTrophies ?? 0;
  const maxStreak = route?.params?.maxStreak ?? 0;
  const weekTotal = route?.params?.weekTotal ?? 0;
  const monthTotal = route?.params?.monthTotal ?? 0;
  const allTimeTotal = route?.params?.allTimeTotal ?? 0;

  // Fixed to 'Stoic Sport' template
  const [aspect] = useState("9:16");
  const [foodLine, setFoodLine] = useState(null); // "🍜 0.8杯"（今は未表示）
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

  // 歩数データを取得（paramsが0の場合はキャッシュから取得）
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const isToday = displayDate === getTodayDateString();

        // route paramsにデータがあればそれを使う
        if (route?.params?.steps && route.params.steps > 0) {
          setSteps(route.params.steps);
          setGoal(route.params.goal || 10000);
          setIsLoading(false);
          return;
        }

        // 今日の場合はキャッシュから即座に取得
        if (isToday) {
          const cached = await getCachedTodayData();
          if (cached && cached.steps > 0) {
            setSteps(cached.steps);
            setGoal(cached.goal || 10000);
          } else {
            // キャッシュがなければストレージから取得
            const data = await getTodayData();
            if (data && data.steps > 0) {
              setSteps(data.steps);
              setGoal(data.goal || 10000);
            }
          }
          // バックグラウンドで最新のPedometer値を取りに行く（小さなスピナー表示）
          try {
            setIsFetchingSteps(true);
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            const available = await Pedometer.isAvailableAsync();
            if (available) {
              const res = await Pedometer.getStepCountAsync(start, end);
              if (typeof res?.steps === "number" && res.steps >= 0) {
                setSteps(res.steps);
                // ついでに保存とキャッシュも更新
                try {
                  const prof = await getUserProfile();
                  const cal = calculateCalories(res.steps, prof?.weight || 65);
                  const stride = prof?.stride || 72;
                  const dist = calculateDistance(res.steps, stride);
                  const todayObj = { date: getTodayDateString(), steps: res.steps, calories: cal, distance: dist, hourlySteps: [], goal };
                  await saveTodayData(todayObj);
                  await cacheTodayData(todayObj);
                } catch (_) {}
              }
            }
          } catch (_) {
          } finally {
            setIsFetchingSteps(false);
          }
        } else {
          // 過去の日付はストレージから取得（AsyncStorage経由で高速）
          const s = await getSettings();
          const dateKey = displayDate;
          const dayData = await getDailyData(dateKey);
          if (dayData && dayData.steps > 0) {
            setSteps(dayData.steps);
            setGoal(dayData.goal || s?.dailyGoal || 10000);
          }
        }
      } catch (error) {
        console.error('Failed to load steps for SharePreview:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [displayDate, selectedDate]);

  useEffect(() => {
    (async () => {
      // WEEK、MONTH、ALL TIME、ストリーク、トロフィー、最大ストリークは
      // route paramsから取得（HomeScreenで計算済み）

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
  }, [displayDate, steps]);

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
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Share Card Preview - 完全な四角形（角丸なし） */}
      <View
        ref={viewRef}
        collapsable={false}
        style={[
          styles.preview,
          {
            backgroundColor:
              steps / goal > 0.5
                ? (theme.isDark ? "#2A1B14" : "#FFF9F0")
                : theme.card,
            borderRadius: 0, // 角丸なしで白い余白を防止
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
          {isLoading ? (
            <>
              <Text style={[styles.steps, { color: theme.textSecondary, fontSize: 32 }]}>
                読み込み中...
              </Text>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[styles.steps, { color: theme.primary }]}>
                  {formatNumber(steps)}
                </Text>
                {isFetchingSteps ? (
                  <ActivityIndicator size="small" color={theme.accent} style={{ marginLeft: 8 }} />
                ) : null}
              </View>
              <Text style={[styles.achievementRate, { color: theme.textSecondary }]}>
                {goal > 0 ? Math.round((steps / goal) * 100) : 0}%
              </Text>
              <View
                style={[styles.glowEffect, { backgroundColor: theme.primary }]}
              />
            </>
          )}
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

        {/* Subline: TROPHIES • STREAK • GOAL */}
        {!isLoading && (
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <View style={styles.metricWithIcon}>
                <Text style={[styles.fireIcon]}>🏆</Text>
                <Text style={[styles.metricValue, { color: theme.primary }]}>
                  {totalTrophies}
                </Text>
            </View>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
              TROPHIES
            </Text>
          </View>
          <View
            style={[styles.metricDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.metricItem}>
            <View style={styles.metricWithIcon}>
              <Text style={[styles.fireIcon]}>🔥</Text>
              <Text style={[styles.metricValue, { color: theme.primary }]}>
                {streakDays}
              </Text>
            </View>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>STREAK</Text>
            {maxStreak > streakDays ? (
              <Text style={[styles.metricSubLabel, { color: theme.textSecondary }]}>MAX STREAK {maxStreak}</Text>
            ) : null}
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
        )}

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
              WALK'N LIFE
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
          onPress={canCapture ? () => captureAndShare('share') : () => {
            Alert.alert(
              "シェア機能は未対応",
              Platform.select({
                web: "Webではスクリーンキャプチャに対応していません。",
                default:
                  "Expo Goではシェアができません。開発クライアント（expo run / EAS dev）でお試しください。",
              })
            );
          }}
        >
          <Text style={styles.buttonPrimaryText}>
            ↗ シェア
          </Text>
        </TouchableOpacity>
      </View>
      {!canCapture && (
        <Text style={[styles.disabledHint, { color: theme.textSecondary }]}>
          シェア機能はExpo GoやWebでは利用できません。
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
    fontWeight: "800",
    letterSpacing: -2,
  },
  achievementRate: {
    fontSize: 16,
    fontWeight: "400",
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
  metricSubLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginTop: 2,
    opacity: 0.8,
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

    const end = new Date(targetDate);
    if (end.toDateString() === new Date().toDateString()) {
      end.setTime(Date.now());
    } else {
      end.setHours(23, 59, 59, 999);
    }
    const start = new Date(end);
    start.setDate(end.getDate() - 364); // 最大1年
    start.setHours(0, 0, 0, 0);

    const list = await getStepsInRange(start, end);
    const map = new Map();
    if (Array.isArray(list)) {
      for (const it of list) {
        if (!it?.date) continue;
        map.set(it.date, Number(it.steps || 0));
      }
    }

    let streak = 0;
    let cur = new Date(targetDate);

    // 選択日が達成済みかチェック
    const targetKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    const targetSteps = Number(map.get(targetKey) || 0);
    const targetAchieved = targetSteps >= (goalSteps || 0);

    // 選択日が未達成なら前日から開始
    if (!targetAchieved) {
      cur.setDate(cur.getDate() - 1);
    }

    // 過去に遡って連続達成日数をカウント
    for (let i = 0; i < 365; i++) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      const steps = Number(map.get(key) || 0);
      if (steps >= (goalSteps || 0)) {
        streak += 1;
        cur.setDate(cur.getDate() - 1);
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

// 全期間（targetDateまで）のトロフィー数（達成日数）を計算
async function calculateTrophiesUpToDate(targetDateStr, goalSteps) {
  try {
    const targetDate = new Date(targetDateStr + 'T00:00:00');
    targetDate.setHours(0, 0, 0, 0);

    const end = new Date(targetDate);
    if (end.toDateString() === new Date().toDateString()) {
      end.setTime(Date.now());
    } else {
      end.setHours(23, 59, 59, 999);
    }
    const start = new Date(end);
    start.setDate(end.getDate() - 364); // 最大1年
    start.setHours(0, 0, 0, 0);

    const list = await getStepsInRange(start, end);
    if (!Array.isArray(list)) return 0;
    const count = list.reduce((acc, it) => acc + (Number(it?.steps || 0) >= (goalSteps || 0) ? 1 : 0), 0);
    return count;
  } catch (e) {
    console.error('Trophies calculation error:', e);
    return 0;
  }
}

// 全期間の最大ストリーク（targetDateまで）を計算
async function calculateMaxStreakUpToDate(targetDateStr, goalSteps) {
  try {
    const targetDate = new Date(targetDateStr + 'T00:00:00');
    targetDate.setHours(0, 0, 0, 0);

    const end = new Date(targetDate);
    // 今日なら現在時刻まで、それ以外はその日の終わり
    if (end.toDateString() === new Date().toDateString()) {
      end.setTime(Date.now());
    } else {
      end.setHours(23, 59, 59, 999);
    }
    const start = new Date(end);
    start.setDate(end.getDate() - 364); // 最大1年分
    start.setHours(0, 0, 0, 0);

    const list = await getStepsInRange(start, end);
    if (!Array.isArray(list) || list.length === 0) return 0;

    // 日付->歩数マップ
    const map = new Map();
    for (const d of list) {
      if (!d?.date) continue;
      map.set(d.date, Number(d.steps || 0));
    }

    let maxStreak = 0;
    let current = 0;
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const da = String(cur.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${da}`;
      const steps = Number(map.get(key) || 0);
      if (steps >= (goalSteps || 0)) {
        current += 1;
        if (current > maxStreak) maxStreak = current;
      } else {
        current = 0;
      }
      cur.setDate(cur.getDate() + 1);
      cur.setHours(0, 0, 0, 0);
    }

    return maxStreak;
  } catch (e) {
    console.error('Max streak calculation error:', e);
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
