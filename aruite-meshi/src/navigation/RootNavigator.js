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

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const completed = await getOnboardingComplete();
        setHasCompletedOnboarding(completed);

        // オンボーディング済みの場合のみアニメーション付きスプラッシュを表示
        if (completed) {
          setTimeout(() => {
            setShowSplash(false);
            setIsLoading(false);
          }, 1200);
        } else {
          setShowSplash(false);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setShowSplash(false);
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  // アニメーション付きスプラッシュ表示中
  if (showSplash && hasCompletedOnboarding) {
    return <AppSplashScreen navigation={{ replace: () => {} }} />;
  }

  if (isLoading) {
    return null;
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
