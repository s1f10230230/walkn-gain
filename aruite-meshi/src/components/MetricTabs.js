import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { AppIcon } from './AppIcon';

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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppIcon name="footsteps" size={16} color={activeTab === 'steps' ? theme.primary : theme.textSecondary} style={{ marginRight: 6 }} />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'steps' ? theme.primary : theme.textSecondary },
            ]}
          >
            {t('home.tabs.steps')}
          </Text>
        </View>
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppIcon name="fire" size={16} color={activeTab === 'calories' ? theme.accent : theme.textSecondary} style={{ marginRight: 6 }} />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'calories' ? theme.accent : theme.textSecondary },
            ]}
          >
            {t('home.tabs.calories')}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

