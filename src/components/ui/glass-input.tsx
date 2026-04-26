import React from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';

import { cosmicTheme } from '@/src/lib/theme';

export const GlassInput = (props: TextInputProps) => {
  return (
    <TextInput
      placeholderTextColor={cosmicTheme.colors.textMuted}
      style={[styles.input, props.multiline && styles.multiline, props.style]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: cosmicTheme.colors.accentLine,
    backgroundColor: 'rgba(255,255,255,0.025)',
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: cosmicTheme.colors.text,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 14,
  },
  multiline: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
});
