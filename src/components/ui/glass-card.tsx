import React, { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { cosmicTheme } from '@/src/lib/theme';

export const GlassCard = ({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) => {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: cosmicTheme.radius.sm,
    borderWidth: 1,
    borderColor: cosmicTheme.colors.cardBorder,
    backgroundColor: cosmicTheme.colors.card,
  },
  inner: {
    padding: 14,
  },
});
