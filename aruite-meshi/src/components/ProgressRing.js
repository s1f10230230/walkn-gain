import React from 'react';
import { Animated } from 'react-native';
import * as Progress from 'react-native-progress';

export default function ProgressRing({
  size = 200,
  progress = 0,
  color = '#14B8A6',
  unfilledColor = '#EDF2F7',
  thickness = 12,
  bumpAnim,
  pulseAnim,
}) {
  return (
    <Animated.View style={{ transform: [{ scale: bumpAnim || new Animated.Value(1) }] }}>
      <Animated.View
        style={{
          transform: [{ scale: pulseAnim || new Animated.Value(1) }],
          position: 'relative',
        }}
      >
        <Progress.Circle
          size={size}
          progress={progress}
          showsText={false}
          animated={true}
          color={color}
          unfilledColor={unfilledColor}
          borderWidth={0}
          thickness={thickness}
        />
      </Animated.View>
    </Animated.View>
  );
}

