import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StoryForm } from '@/src/components/story/story-form';
import { CosmicBackground } from '@/src/components/ui/cosmic-background';
import { GlassCard } from '@/src/components/ui/glass-card';
import { PrimaryButton } from '@/src/components/ui/primary-button';
import { SectionHeading } from '@/src/components/ui/section-heading';
import { useAppContext } from '@/src/context/app-context';
import { useUniverseFocusIntent } from '@/src/features/universe-runtime/universe-focus-intent';
import { getUserFacingErrorMessage } from '@/src/lib/error-message';
import { getStoryEditorValidationMessage, normalizeStoryEditorValues } from '@/src/lib/story-validation';
import { cosmicTheme } from '@/src/lib/theme';
import { StoryDetail, StoryEditorValues } from '@/src/types/domain';

const defaultValues: StoryEditorValues = {
  title: '',
  body: '',
  visibility: 'public',
  authorMode: 'named',
  starColor: '#E0E7EF',
};

const DAILY_STORY_LIMIT = 3;
const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

const getShanghaiDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Date(date.getTime() + SHANGHAI_UTC_OFFSET_MS).toISOString().slice(0, 10);
};

const getStoryFormValues = (story?: StoryDetail): StoryEditorValues =>
  story
    ? {
        title: story.title ?? '',
        body: story.body ?? '',
        visibility: story.visibility,
        authorMode: story.authorMode,
        starColor: story.starColor,
      }
    : { ...defaultValues };

export default function ComposeScreen() {
  const router = useRouter();
  const { draftNonce, mode, storyId } = useLocalSearchParams<{
    draftNonce?: string;
    mode?: 'edit' | 'new';
    storyId?: string;
  }>();
  const { findStory, myStories, saveStory } = useAppContext();
  const { requestFocus } = useUniverseFocusIntent();
  const isEditRoute = mode === 'edit' && Boolean(storyId);
  const editingStory = useMemo(
    () => (isEditRoute && storyId ? findStory(storyId) : undefined),
    [findStory, isEditRoute, storyId]
  );
  const publishedTodayCount = useMemo(() => {
    const todayKey = getShanghaiDateKey(new Date());
    return myStories.filter((story) => getShanghaiDateKey(story.createdAt) === todayKey).length;
  }, [myStories]);
  const remainingDailyStories = Math.max(0, DAILY_STORY_LIMIT - publishedTodayCount);
  const dailyLimitReached = !isEditRoute && remainingDailyStories <= 0;
  const [values, setValues] = useState<StoryEditorValues>(() => getStoryFormValues(editingStory));
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setValues(getStoryFormValues(editingStory));
    setFeedback(null);
    setSubmitting(false);
  }, [draftNonce, editingStory]);

  const handleSubmit = async () => {
    if (isEditRoute && !editingStory) {
      setFeedback('没有读取到这颗星，请回到我的星星重新进入编辑。');
      return;
    }

    if (dailyLimitReached) {
      setFeedback('今天最多发布 3 颗星星，明天再来。');
      return;
    }

    const normalizedValues = normalizeStoryEditorValues(values);
    const validationMessage = getStoryEditorValidationMessage(normalizedValues);
    if (validationMessage) {
      setFeedback(validationMessage);
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);
      const result = await saveStory(normalizedValues, editingStory);
      requestFocus(result.story.id, {
        message: isEditRoute ? '已保存。' : '已发布。',
      });
      setFeedback(result.moderation?.message ?? (isEditRoute ? '已保存。' : '已发布。'));
      router.replace('/');
    } catch (error) {
      const message = getUserFacingErrorMessage(error, '发布失败，请再试一次。');
      setFeedback(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <CosmicBackground />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SectionHeading
            eyebrow={isEditRoute ? 'Edit Story' : 'New Story'}
            title={isEditRoute ? '编辑星星' : '发布星星'}
          />

          <GlassCard>
            <StoryForm values={values} onChange={setValues} />
          </GlassCard>

          <Text style={[styles.quotaText, dailyLimitReached && styles.quotaWarningText]}>
            {editingStory
              ? '编辑不占用额度'
              : isEditRoute
                ? '正在读取编辑内容'
              : dailyLimitReached
                ? '今日额度已用完'
                : `今日还能发布 ${remainingDailyStories} 颗`}
          </Text>

          {feedback ? (
            <Text style={styles.feedbackText}>{feedback}</Text>
          ) : null}

          <View style={styles.actions}>
            <PrimaryButton
              label={submitting ? '正在保存...' : isEditRoute ? '保存这颗星' : '发布这颗星'}
              onPress={() => void handleSubmit()}
              disabled={submitting || dailyLimitReached || (isEditRoute && !editingStory)}
            />
            <PrimaryButton label="返回宇宙" variant="ghost" onPress={() => router.replace('/')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: cosmicTheme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 118,
    gap: 16,
  },
  quotaText: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.body,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 2,
  },
  quotaWarningText: {
    color: cosmicTheme.colors.danger,
  },
  feedbackText: {
    color: cosmicTheme.colors.textSoft,
    fontFamily: cosmicTheme.fonts.body,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 2,
  },
  actions: {
    gap: 12,
  },
});
