import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { getAllDailyData, getDailyData } from '../utils/storage';
import { getTodayDateString, toDateKeyLocal } from '../utils/calculations';
import { computeTrophiesStreak, computeShareStreak } from '../utils/stats';

export default function ShareCTA({ selectedDate, steps, goal, navigation, theme, t, formatNumber }) {
  return (
    <TouchableOpacity
      onPress={async () => {
        const dateStr = toDateKeyLocal(selectedDate);
        const today = getTodayDateString();

        // 選択日の歩数/目標
        let dateSteps = steps;
        let dateGoal = goal;
        if (dateStr !== today) {
          const dayData = await getDailyData(dateStr);
          if (dayData) {
            dateSteps = dayData.steps || 0;
            dateGoal = dayData.goal || goal;
          }
        }

        // 全データを取得して集計
        const allData = await getAllDailyData();
        const DEFAULT_GOAL = 10000;
        const { totalTrophies: trophyCount, maxStreak } = computeTrophiesStreak(allData, DEFAULT_GOAL, new Date());
        const streak = computeShareStreak(allData, DEFAULT_GOAL, dateStr);

        // WEEK/MONTH/ALL
        const selected = new Date(selectedDate); selected.setHours(0,0,0,0);
        let weekTotal = 0;
        for (let i=1;i<=7;i++){
          const d = new Date(selected); d.setDate(selected.getDate()-i);
          const key = toDateKeyLocal(d);
          weekTotal += allData[key]?.steps || 0;
        }
        let monthTotal = 0;
        for (let i=0;i<30;i++){
          const d = new Date(selected); d.setDate(selected.getDate()-i);
          const key = toDateKeyLocal(d);
          monthTotal += allData[key]?.steps || 0;
        }
        const allTotal = Object.values(allData).reduce((sum, data) => sum + (data?.steps || 0), 0);

        navigation.navigate('SharePreview', {
          steps: dateSteps,
          goal: dateGoal,
          selectedDate: dateStr,
          totalTrophies: trophyCount,
          streakDays: streak,
          maxStreak,
          weekTotal,
          monthTotal,
          allTimeTotal: allTotal,
        });
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.accent,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        zIndex: 10,
      }}
    >
      <Text
        style={{
          color: '#FFF',
          fontWeight: '800',
          letterSpacing: 1,
          marginRight: 6,
        }}
      >
        {t('common.share')}
      </Text>
      <Text style={{ color: '#FFF', fontSize: 16 }}>↗</Text>
    </TouchableOpacity>
  );
}
