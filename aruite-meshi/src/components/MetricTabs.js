import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function MetricTabs({ theme, styles, activeTab, setActiveTab, t }) {
  return (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'steps' && styles.tabActive,
          {
            borderColor: activeTab === 'steps' ? theme.primary : 'transparent',
            backgroundColor: theme.card,
          },
        ]}
        onPress={() => setActiveTab('steps')}
      >
        <Text
          style={[
            styles.tabText,
            { color: activeTab === 'steps' ? theme.primary : theme.textSecondary },
          ]}
        >
          🦶 {t('home.tabs.steps')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'calories' && styles.tabActive,
          {
            borderColor: activeTab === 'calories' ? theme.accent : 'transparent',
            backgroundColor: theme.card,
          },
        ]}
        onPress={() => setActiveTab('calories')}
      >
        <Text
          style={[
            styles.tabText,
            { color: activeTab === 'calories' ? theme.accent : theme.textSecondary },
          ]}
        >
          🔥 {t('home.tabs.calories')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

