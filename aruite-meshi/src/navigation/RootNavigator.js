import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image, useColorScheme, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { getOnboardingComplete } from '../utils/storage';
import { getTheme } from '../utils/theme';

// オンボーディングスクリーン
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import ProfileInputScreen from '../screens/onboarding/ProfileInputScreen';
import GoalStepsScreen from '../screens/onboarding/GoalStepsScreen';
import PermissionsScreen from '../screens/onboarding/PermissionsScreen';
import HealthKitPermissionScreen from '../screens/onboarding/HealthKitPermissionScreen';
import CalorieGoalScreen from '../screens/onboarding/CalorieGoalScreen';
import ProIntroScreen from '../screens/onboarding/ProIntroScreen';
import LanguageSelectScreen from '../screens/onboarding/LanguageSelectScreen';

// メインアプリ
import AppNavigator from './AppNavigator';
import UpgradeScreen from '../screens/UpgradeScreen';

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
      <Stack.Screen
        name="ProIntro"
        component={ProIntroScreen}
        options={{ detachPreviousScreen: false }}
      />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const completed = await getOnboardingComplete();
        setHasCompletedOnboarding(completed);

        setIsLoading(false);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

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
        {Platform.OS !== 'ios' && (
          <Stack.Screen
            name="Upgrade"
            component={UpgradeScreen}
            options={{
              presentation: 'modal',
              cardStyleInterpolator: CardStyleInterpolators.forModalPresentationIOS,
              detachPreviousScreen: false,
            }}
          />
        )}
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
