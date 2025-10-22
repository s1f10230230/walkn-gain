import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import FoodListScreen from '../screens/FoodListScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#FF8C42',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: {
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          headerStyle: {
            backgroundColor: '#FF8C42',
          },
          headerTintColor: '#FFF',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 20,
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarLabel: 'ホーム',
            title: '歩いてメシ',
            tabBarIcon: ({ color, size }) => (
              <TabIcon emoji="🏠" size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{
            tabBarLabel: '履歴',
            title: '履歴',
            tabBarIcon: ({ color, size }) => (
              <TabIcon emoji="📊" size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="FoodList"
          component={FoodListScreen}
          options={{
            tabBarLabel: '食べ物',
            title: '食べ物一覧',
            tabBarIcon: ({ color, size }) => (
              <TabIcon emoji="🍜" size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: '設定',
            title: '設定',
            tabBarIcon: ({ color, size }) => (
              <TabIcon emoji="⚙️" size={size} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// シンプルな絵文字アイコンコンポーネント
const TabIcon = ({ emoji, size }) => {
  return (
    <Text style={{ fontSize: size }}>
      {emoji}
    </Text>
  );
};

// react-nativeのTextコンポーネントをインポート
import { Text } from 'react-native';
