import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { useColorScheme, Easing } from 'react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import FoodListScreen from '../screens/FoodListScreen';
import SharePreviewScreen from '../screens/SharePreviewScreen';
import { HomeIcon, HistoryIcon, SettingsIcon } from '../components/TabIcons';
import { useI18n } from '../i18n/I18nProvider';
import { getTheme } from '../utils/theme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// 穏やかなトランジション設定（アプリ全体で使用）
const gentleTransition = {
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 250,
        easing: Easing.out(Easing.ease),
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 200,
        easing: Easing.in(Easing.ease),
      },
    },
  },
  cardStyleInterpolator: ({ current }) => ({
    cardStyle: {
      opacity: current.progress,
    },
  }),
};

// 設定タブのスタックナビゲーター
function SettingsStack() {
  const { t } = useI18n();
  return (
    <Stack.Navigator screenOptions={gentleTransition}>
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          title: t('settings.privacyPolicy'),
          headerStyle: {
            backgroundColor: '#FF7043',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '700',
          },
        }}
      />
      <Stack.Screen
        name="SharePreview"
        component={SharePreviewScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// ホームタブのスタックナビゲーター（FoodListはここから遷移）
function HomeStack() {
  const { t } = useI18n();
  return (
    <Stack.Navigator screenOptions={gentleTransition}>
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FoodList"
        component={FoodListScreen}
        options={{
          title: t('tabs.food'),
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerTintColor: '#212121',
          headerTitleStyle: {
            fontWeight: '700',
          },
        }}
      />
      <Stack.Screen
        name="SharePreview"
        component={require('../screens/SharePreviewScreen').default}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const baseTabBarStyle = {
    height: 60 + insets.bottom,
    paddingBottom: insets.bottom + 8,
    paddingTop: 8,
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarStyle: baseTabBarStyle,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'HomeMain';
          const hide = routeName === 'SharePreview';
          return {
            tabBarLabel: t('tabs.home'),
            tabBarIcon: ({ color, size }) => (
              <HomeIcon color={color} size={size} />
            ),
            tabBarStyle: hide ? { display: 'none' } : baseTabBarStyle,
          };
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: t('tabs.history'),
          tabBarIcon: ({ color, size }) => (
            <HistoryIcon color={color} size={size} />
          ),
        }}
      />
      {/** FoodList は HomeStack 経由に変更（タブからは外す） */}
      <Tab.Screen
        name="Settings"
        component={SettingsStack}
        options={{
          tabBarLabel: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <SettingsIcon color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
