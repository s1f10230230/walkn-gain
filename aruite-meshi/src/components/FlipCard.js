import React, { useRef, useEffect } from 'react';
import {
  View,
  Animated,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';

export default function FlipCard({
  front,
  back,
  style,
  isFlipped = false,
  onFlipChange,
}) {
  const flipAnim = useRef(new Animated.Value(isFlipped ? 1 : 0)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    // 初回マウント後は常にアニメーション
    if (hasAnimated.current) {
      Animated.spring(flipAnim, {
        toValue: isFlipped ? 1 : 0,
        friction: 8,
        tension: 10,
        useNativeDriver: true,
      }).start();
    } else {
      // 初回のみ即座に設定（アニメーションなし）
      flipAnim.setValue(isFlipped ? 1 : 0);
      hasAnimated.current = true;
    }
  }, [isFlipped]);

  const flipCard = () => {
    if (onFlipChange) {
      onFlipChange(!isFlipped);
    }
  };

  // 表面の回転（0度 → 180度）
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '180deg'],
  });

  // 裏面の回転（180度 → 0度）
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['180deg', '90deg', '0deg'],
  });

  // 表面の透明度（0.5を超えたら非表示）
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  // 裏面の透明度（0.5を超えたら表示）
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const frontAnimatedStyle = {
    transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }],
    opacity: frontOpacity,
  };

  const backAnimatedStyle = {
    transform: [{ perspective: 1000 }, { rotateY: backInterpolate }],
    opacity: backOpacity,
  };

  return (
    <TouchableWithoutFeedback onLongPress={flipCard} delayLongPress={300}>
      <View style={[styles.container, style]}>
        {/* 表面 */}
        <Animated.View style={[styles.card, styles.front, frontAnimatedStyle]}>
          {front}
        </Animated.View>

        {/* 裏面 */}
        <Animated.View style={[styles.card, styles.back, backAnimatedStyle]}>
          {back}
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  card: {
    backfaceVisibility: 'hidden',
  },
  front: {
    position: 'relative',
  },
  back: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
  },
});
