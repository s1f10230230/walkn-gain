import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Image, useColorScheme } from "react-native";
import { getTheme } from "../../utils/theme";

export default function SplashScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  useEffect(() => {
    // フェードイン＆スケールアニメーション
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // 2秒後に言語選択画面へ遷移
    const timer = setTimeout(() => {
      navigation.replace("LanguageSelect");
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require("../../../assets/splash-icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  logoContainer: {
    alignItems: "center",
  },
  logo: {
    width: 500,
    height: 500,
    marginBottom: 20,
  },
  appName: {
    fontSize: 48,
    fontWeight: "800",
    marginBottom: 10,
  },
  tagline: {
    fontSize: 18,
    opacity: 0.9,
    fontWeight: "500",
  },
});
