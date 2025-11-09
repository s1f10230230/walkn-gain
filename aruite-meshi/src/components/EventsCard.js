import React from 'react';
import { View, Text } from 'react-native';

export default function EventsCard({ styles, theme, t, todayEvents = [] }) {
  return (
    <View
      style={[
        styles.eventsCard,
        { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, minHeight: 72 },
      ]}
    >
      <Text style={[styles.eventsTitle, { color: theme.text }]}>📅 {t('home.events.today') || '今日の予定'}</Text>
      {todayEvents.length > 0 ? (
        <>
          {todayEvents.slice(0, 3).map((event, index) => (
            <View key={index} style={[styles.eventItem, { borderBottomColor: theme.border }]}>
              <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={1}>
                {event.title}
              </Text>
              {event.startDate && (
                <Text style={[styles.eventTime, { color: theme.textSecondary }]}>
                  {new Date(event.startDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
          ))}
          {todayEvents.length > 3 && (
            <Text style={[styles.moreEvents, { color: theme.textSecondary }]}>
              {t('home.events.moreCount', { count: todayEvents.length - 3 }) || `他 ${todayEvents.length - 3} 件`}
            </Text>
          )}
        </>
      ) : (
        <Text style={[styles.noEventsText, { color: theme.textSecondary }]}>
          {t('home.events.none') || '予定なし'}
        </Text>
      )}
    </View>
  );
}
