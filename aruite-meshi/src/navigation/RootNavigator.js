import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image, useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { getOnboardingComplete } from '../utils/storage';
import { getTheme } from '../utils/theme';

// オンボーディングスクリーン
import SplashScreen from '../screens/onboarding/SplashScreen';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import ProfileInputScreen from '../screens/onboarding/ProfileInputScreen';
import GoalStepsScreen from '../screens/onboarding/GoalStepsScreen';
import PermissionsScreen from '../screens/onboarding/PermissionsScreen';
import HealthKitPermissionScreen from '../screens/onboarding/HealthKitPermissionScreen';
import CalorieGoalScreen from '../screens/onboarding/CalorieGoalScreen';
import LanguageSelectScreen from '../screens/onboarding/LanguageSelectScreen';

// メインアプリ
import AppNavigator from './AppNavigator';
import AppSplashScreen from '../screens/AppSplashScreen';

const Stack = createStackNavigator();

function OnboardingStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
        detachPreviousScreen: false,
      }}
    >
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
        options={{ detachPreviousScreen: false }}
      />
      <Stack.Screen
        name="LanguageSelect"
        component={LanguageSelectScreen}
        options={{ detachPreviousScreen: false }}
      />
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ detachPreviousScreen: false }}
      />
      <Stack.Screen
        name="ProfileInput"
        component={ProfileInputScreen}
        options={{ detachPreviousScreen: false }}
      />
      <Stack.Screen
        name="GoalSteps"
        component={GoalStepsScreen}
        options={{ detachPreviousScreen: false }}
      />
      <Stack.Screen
        name="Permissions"
        component={PermissionsScreen}
        options={{ detachPreviousScreen: false }}
      />
      <Stack.Screen
        name="HealthKitPermission"
        component={HealthKitPermissionScreen}
        options={{ detachPreviousScreen: false }}
      />
      <Stack.Screen
        name="CalorieGoal"
        component={CalorieGoalScreen}
        options={{ detachPreviousScreen: false }}
      />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const completed = await getOnboardingComplete();
        setHasCompletedOnboarding(completed);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        // オンボーディング済みの場合のみスプラッシュを表示
        if (completed) {
          setTimeout(() => {
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start(() => {
              setShowSplash(false);
              setIsLoading(false);
            });
          }, 1200);
        } else {
          setShowSplash(false);
          setIsLoading(false);
        }
      }
    };

    // 初回マウント時に一度だけ状態を取得して初期ルートを決める
    checkOnboardingStatus();
  }, []);

  // スプラッシュ表示中は他の画面を完全に隠す
  if (showSplash) {
    return (
      <Animated.View style={[styles.splashContainer, { backgroundColor: theme.background, opacity: fadeAnim }]}>
        <Image
          source={require('../../assets/splash-icon.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
      </Animated.View>
    );
  }

  if (isLoading) {
    return null; // スプラッシュ後のローディングは不要
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
          detachPreviousScreen: false,
        }}
        initialRouteName={hasCompletedOnboarding ? 'MainApp' : 'Onboarding'}
      >
        <Stack.Screen
          name="MainApp"
          component={AppNavigator}
          options={{ detachPreviousScreen: false }}
        />
        <Stack.Screen
          name="Onboarding"
          component={OnboardingStack}
          options={{ detachPreviousScreen: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    width: 500,
    height: 500,
  },
});
