import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';

const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

export default function AchievementStamp({ visible, theme }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // リセット
      scaleAnim.setValue(2);
      rotateAnim.setValue(-0.3);
      opacityAnim.setValue(0);

      // スタンプを押すアニメーション
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const rotation = rotateAnim.interpolate({
    inputRange: [-0.3, 0],
    outputRange: ['-15deg', '-5deg'],
  });

  return (
    <Animated.View
      style={[
        styles.stampContainer,
        {
          transform: [
            { scale: scaleAnim },
            { rotate: rotation },
          ],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={[styles.stamp, { borderColor: theme.success }]}>
        <Text style={[styles.stampText, { color: theme.success }]}>
          GOAL
        </Text>
        <Text style={[styles.stampTextSmall, { color: theme.success }]}>
          ACHIEVED!
        </Text>
        <View style={[styles.stampStar, { borderColor: theme.success }]}>
          <Text style={styles.starEmoji}>⭐</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stampContainer: {
    position: 'absolute',
    top: 30,
    right: -10,
    zIndex: 10,
  },
  stamp: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 168, 150, 0.08)',
  },
  stampText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: serifFont,
    letterSpacing: 2,
  },
  stampTextSmall: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: serifFont,
    letterSpacing: 1,
    marginTop: 2,
  },
  stampStar: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starEmoji: {
    fontSize: 14,
  },
});
