import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cosmicTheme } from '@/src/lib/theme';
import { Story } from '@/src/types/domain';

const COPIED_LABEL_RESET_MS = 1600;

export const StorySummaryCard = ({
  story,
  onLocate,
  onEdit,
  onDelete,
  deleting = false,
}: {
  story: Story;
  onLocate: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCoordinate = Boolean(story.coordinateCode);

  useEffect(
    () => () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    },
    []
  );

  const handleCopyCoordinate = async () => {
    if (!story.coordinateCode) {
      return;
    }

    await Clipboard.setStringAsync(story.coordinateCode);
    setCopied(true);

    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
    }

    copiedTimerRef.current = setTimeout(() => {
      setCopied(false);
      copiedTimerRef.current = null;
    }, COPIED_LABEL_RESET_MS);
  };

  return (
    <View style={styles.row}>
      <View style={[styles.colorDot, { backgroundColor: story.starColor }]} />
      <View style={styles.content}>
        <View style={styles.topLine}>
          <Text numberOfLines={1} style={styles.title}>
            {story.title || '未命名的星星'}
          </Text>
          <Text style={styles.visibility}>{story.visibility === 'public' ? '公开' : '私密'}</Text>
        </View>

        <Text numberOfLines={1} style={styles.body}>
          {story.body || '这颗星还没有正文。'}
        </Text>

        <Text numberOfLines={1} style={styles.meta}>
          {story.coordinateCode ?? '私密星不显示坐标'}
        </Text>

        <View style={styles.actions}>
          <Pressable onPress={onLocate} style={styles.actionButton}>
            <Text style={styles.actionLabel}>定位</Text>
          </Pressable>
          <Pressable disabled={!hasCoordinate} onPress={handleCopyCoordinate} style={styles.actionButton}>
            <Text style={[styles.actionLabel, !hasCoordinate && styles.actionLabelDisabled]}>
              {hasCoordinate ? (copied ? '已复制' : '复制坐标') : '无坐标'}
            </Text>
          </Pressable>
          <Pressable onPress={onEdit} style={styles.actionButton}>
            <Text style={styles.actionLabel}>编辑</Text>
          </Pressable>
          {onDelete ? (
            <Pressable disabled={deleting} onPress={onDelete} style={styles.actionButton}>
              <Text style={[styles.deleteLabel, deleting && styles.actionLabelDisabled]}>
                {deleting ? '删除中' : '删除'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.055)',
  },
  colorDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    marginTop: 9,
  },
  content: {
    flex: 1,
    gap: 7,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flex: 1,
    color: cosmicTheme.colors.text,
    fontFamily: cosmicTheme.fonts.heading,
    fontSize: 17,
    lineHeight: 23,
  },
  visibility: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 11,
  },
  body: {
    color: cosmicTheme.colors.textSoft,
    fontFamily: cosmicTheme.fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  meta: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.body,
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  actionButton: {
    paddingVertical: 4,
  },
  actionLabel: {
    color: cosmicTheme.colors.textSoft,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 12,
  },
  actionLabelDisabled: {
    color: cosmicTheme.colors.locked,
  },
  deleteLabel: {
    color: cosmicTheme.colors.danger,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 12,
  },
});
