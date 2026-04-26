import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cosmicTheme } from '@/src/lib/theme';

import { UniverseLabReaderStatus } from './use-universe-lab-scene';
import { UniverseLabStory } from './universe-lab-stories';

const TAB_BAR_CLEARANCE = 112;

interface UniverseLabStoryReaderProps {
  story: UniverseLabStory | null;
  status: UniverseLabReaderStatus;
  actionMessage?: string | null;
  onClose: () => void;
  onEdit?: () => void;
  onLike?: () => Promise<void> | void;
}

export const UniverseLabStoryReader = ({
  story,
  status,
  actionMessage,
  onClose,
  onEdit,
  onLike,
}: UniverseLabStoryReaderProps) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(620)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);
  const [likePending, setLikePending] = useState(false);

  useEffect(() => {
    const isVisible = status === 'opening' || status === 'open';

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: isVisible ? 0 : 620,
        duration: isVisible ? 300 : 230,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: isVisible ? 1 : 0,
        duration: isVisible ? 240 : 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, status, translateY]);

  useEffect(
    () => () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    },
    []
  );

  if (!story || status === 'closed') {
    return null;
  }

  const canLike = story.visibility === 'public' && !story.likedByViewer;
  const likeLabel = story.likedByViewer ? '已点亮' : '点亮';
  const metaItems = [
    story.authorLabel,
    story.visibility === 'public' ? `阅读 ${story.viewCount}` : '私密',
    story.visibility === 'public' ? `点亮 ${story.likeCount}` : null,
  ].filter(Boolean);

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
    }, 1500);
  };

  const handleLike = async () => {
    if (!canLike || !onLike || likePending) {
      return;
    }

    try {
      setLikePending(true);
      await onLike();
    } finally {
      setLikePending(false);
    }
  };

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <Animated.View pointerEvents="none" style={[styles.scrim, { opacity }]} />
      <Pressable onPress={onClose} style={styles.scrimTapTarget} />

      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: Math.max(insets.bottom, 18) + TAB_BAR_CLEARANCE,
            transform: [{ translateY }],
          },
        ]}>
        <LinearGradient
          colors={['rgba(5,7,11,0)', 'rgba(5,7,11,0.72)', 'rgba(9,12,18,0.98)']}
          pointerEvents="none"
          style={styles.fadeTop}
        />

        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{story.coordinateLabel}</Text>
            <Text style={styles.title}>{story.title}</Text>
            <Text style={styles.meta}>{metaItems.join(' · ')}</Text>
          </View>

          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeLabel}>关闭</Text>
          </Pressable>
        </View>

        <ScrollView
          bounces
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}>
          <Text style={styles.body}>{story.body}</Text>
        </ScrollView>

        <View style={styles.actions}>
          {story.visibility === 'public' ? (
            <Pressable
              disabled={!canLike || likePending}
              onPress={handleLike}
              style={[styles.actionButton, (!canLike || likePending) && styles.actionButtonMuted]}>
              <Text style={[styles.actionLabel, (!canLike || likePending) && styles.actionLabelMuted]}>
                {likePending ? '点亮中' : likeLabel}
              </Text>
            </Pressable>
          ) : null}

          {story.coordinateCode ? (
            <Pressable onPress={handleCopyCoordinate} style={styles.actionButton}>
              <Text style={styles.actionLabel}>{copied ? '已复制' : '复制坐标'}</Text>
            </Pressable>
          ) : null}

          {story.isOwner && onEdit ? (
            <Pressable onPress={onEdit} style={styles.actionButton}>
              <Text style={styles.actionLabel}>编辑</Text>
            </Pressable>
          ) : null}
        </View>

        {actionMessage ? <Text style={styles.actionMessage}>{actionMessage}</Text> : null}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 4, 9, 0.24)',
  },
  scrimTapTarget: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    minHeight: '88%',
    maxHeight: '96%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: 'rgba(9, 12, 18, 0.96)',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 22,
    paddingTop: 12,
    overflow: 'hidden',
  },
  fadeTop: {
    position: 'absolute',
    top: -40,
    left: 0,
    right: 0,
    height: 74,
  },
  handleWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  header: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  headerCopy: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
  },
  title: {
    color: cosmicTheme.colors.text,
    fontFamily: cosmicTheme.fonts.headingBold,
    fontSize: 25,
    lineHeight: 32,
  },
  meta: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 13,
  },
  closeButton: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: cosmicTheme.colors.accentLine,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  closeLabel: {
    color: cosmicTheme.colors.textSoft,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 12,
  },
  scroll: {
    flex: 1,
    marginTop: 22,
  },
  scrollContent: {
    paddingBottom: 18,
  },
  body: {
    color: cosmicTheme.colors.textSoft,
    fontFamily: cosmicTheme.fonts.body,
    fontSize: 16,
    lineHeight: 29,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  actionButtonMuted: {
    opacity: 0.52,
  },
  actionLabel: {
    color: cosmicTheme.colors.textSoft,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 13,
  },
  actionLabelMuted: {
    color: cosmicTheme.colors.textMuted,
  },
  actionMessage: {
    marginTop: 12,
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
