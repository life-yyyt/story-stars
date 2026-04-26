import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cosmicTheme } from '@/src/lib/theme';

export const SectionHeading = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) => {
  return (
    <View style={styles.container}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  eyebrow: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: cosmicTheme.colors.text,
    fontFamily: cosmicTheme.fonts.headingBold,
    fontSize: 24,
    lineHeight: 31,
  },
  description: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.body,
    fontSize: 14,
    lineHeight: 22,
  },
});
