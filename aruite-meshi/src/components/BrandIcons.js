import React from 'react';
import Svg, { Circle } from 'react-native-svg';

export const FootprintsIcon = ({ color = '#FFFFFF', size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Left footprint */}
    <Circle cx="7.5" cy="14" r="3" fill={color} />
    <Circle cx="5.6" cy="9.0" r="1" fill={color} />
    <Circle cx="7.5" cy="8.0" r="1.1" fill={color} />
    <Circle cx="9.3" cy="9.2" r="1" fill={color} />

    {/* Right footprint */}
    <Circle cx="16.5" cy="14" r="3" fill={color} />
    <Circle cx="14.7" cy="9.2" r="1" fill={color} />
    <Circle cx="16.5" cy="8.0" r="1.1" fill={color} />
    <Circle cx="18.4" cy="9.0" r="1" fill={color} />
  </Svg>
);

