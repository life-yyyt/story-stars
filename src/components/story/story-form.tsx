import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ColorPicker } from '@/src/components/story/color-picker';
import { GlassInput } from '@/src/components/ui/glass-input';
import { cosmicTheme } from '@/src/lib/theme';
import { StoryEditorValues, StoryVisibility } from '@/src/types/domain';

const visibilityOptions: { key: StoryVisibility; label: string }[] = [
  {
    key: 'public',
    label: '公开',
  },
  {
    key: 'private',
    label: '私密',
  },
];

export const StoryForm = ({
  values,
  onChange,
}: {
  values: StoryEditorValues;
  onChange: (next: StoryEditorValues) => void;
}) => {
  return (
    <View style={styles.container}>
      <Field label="标题">
        <GlassInput
          placeholder="给这颗星命名"
          value={values.title}
          onChangeText={(title) => onChange({ ...values, title })}
        />
      </Field>

      <Field label="正文">
        <GlassInput
          multiline
          placeholder="写下故事"
          value={values.body}
          onChangeText={(body) => onChange({ ...values, body })}
        />
      </Field>

      <Field label="署名">
        <View style={styles.toggleRow}>
          <ToggleButton
            active={values.authorMode === 'named'}
            label="署名"
            onPress={() => onChange({ ...values, authorMode: 'named' })}
          />
          <ToggleButton
            active={values.authorMode === 'anonymous'}
            label="匿名"
            onPress={() => onChange({ ...values, authorMode: 'anonymous' })}
          />
        </View>
      </Field>

      <Field label="权限">
        <View style={styles.visibilityRow}>
          {visibilityOptions.map((option) => {
            const active = values.visibility === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => onChange({ ...values, visibility: option.key })}
                style={[styles.visibilityCard, active && styles.visibilityCardActive]}>
                <Text style={styles.visibilityLabel}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label="颜色">
        <ColorPicker value={values.starColor} onChange={(starColor) => onChange({ ...values, starColor })} />
      </Field>
    </View>
  );
};

const Field = ({ label, children }: React.PropsWithChildren<{ label: string }>) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

const ToggleButton = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={[styles.toggleButton, active && styles.toggleButtonActive]}>
    <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  field: {
    gap: 10,
  },
  label: {
    color: cosmicTheme.colors.textSoft,
    fontFamily: cosmicTheme.fonts.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: cosmicTheme.colors.accentLine,
    backgroundColor: 'rgba(255,255,255,0.025)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  toggleLabel: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 14,
  },
  toggleLabelActive: {
    color: cosmicTheme.colors.text,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  visibilityCard: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: cosmicTheme.colors.accentLine,
    backgroundColor: 'rgba(255,255,255,0.025)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  visibilityCardActive: {
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.075)',
  },
  visibilityLabel: {
    color: cosmicTheme.colors.text,
    fontFamily: cosmicTheme.fonts.bodySemiBold,
    fontSize: 14,
  },
});
