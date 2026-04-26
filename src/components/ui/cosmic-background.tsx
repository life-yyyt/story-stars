import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export const CosmicBackground = () => {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#05070B', '#05070B', '#07090D']}
        locations={[0, 0.64, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
};
