import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { cosmicTheme } from '@/src/lib/theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export const PrimaryButton = ({
  label,
  onPress,
  disabled,
  variant = 'primary',
  style,
}: PrimaryButtonProps) => {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  label: {
    fontFamily: cosmicTheme.fonts.bodySemiBold,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.988 }],
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: '#F4F6F8',
    borderColor: '#F4F6F8',
  },
  secondary: {
    backgroundColor: 'rgba(10, 13, 18, 0.44)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  danger: {
    backgroundColor: 'rgba(255, 142, 142, 0.08)',
    borderColor: 'rgba(255, 142, 142, 0.24)',
  },
});

const labelStyles = StyleSheet.create({
  primary: {
    color: '#05070B',
  },
  secondary: {
    color: cosmicTheme.colors.text,
  },
  ghost: {
    color: cosmicTheme.colors.textSoft,
  },
  danger: {
    color: cosmicTheme.colors.danger,
  },
});
