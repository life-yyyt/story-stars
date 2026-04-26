import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cosmicTheme } from '@/src/lib/theme';

export const EmptyState = ({ title, body }: { title: string; body: string }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
    alignItems: 'center',
    paddingVertical: 28,
  },
  title: {
    color: cosmicTheme.colors.text,
    fontFamily: cosmicTheme.fonts.heading,
    fontSize: 18,
  },
  body: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.body,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
});
