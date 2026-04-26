import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StorySummaryCard } from '@/src/components/story/story-summary-card';
import { CosmicBackground } from '@/src/components/ui/cosmic-background';
import { EmptyState } from '@/src/components/ui/empty-state';
import { GlassCard } from '@/src/components/ui/glass-card';
import { PrimaryButton } from '@/src/components/ui/primary-button';
import { SectionHeading } from '@/src/components/ui/section-heading';
import { useAppContext } from '@/src/context/app-context';
import { useUniverseFocusIntent } from '@/src/features/universe-runtime/universe-focus-intent';
import { getUserFacingErrorMessage } from '@/src/lib/error-message';
import { productFlags } from '@/src/lib/product-flags';
import { cosmicTheme } from '@/src/lib/theme';

export default function MyStarsScreen() {
  const router = useRouter();
  const { deleteStory, myStories, requestLocateStory, session, signOut } = useAppContext();
  const { requestFocus } = useUniverseFocusIntent();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);
  const phoneTail = session?.phone ? session.phone.slice(-4) : null;

  const handleSignOut = () => {
    Alert.alert('退出当前设备？', '云端故事不会被删除。退出后，可以用已绑定手机号重新找回星星。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => {
          void signOut().catch((error) => {
            setFeedback(getUserFacingErrorMessage(error, '退出失败，请稍后再试。'));
          });
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <CosmicBackground />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <SectionHeading
              eyebrow="My Stars"
              title="我的星星"
            />
          </View>

          <Text style={styles.profileSub}>{session ? session.displayName ?? '星旅人' : '未创建身份'}</Text>

          {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}

          {session?.isAnonymous ? (
            <GlassCard style={styles.protectCard}>
              <View style={styles.protectCopy}>
                <Text style={styles.protectTitle}>
                  {productFlags.phoneAuthEnabled ? '保护你的星星' : '当前设备'}
                </Text>
                <Text style={styles.protectText}>
                  {productFlags.phoneAuthEnabled ? '换设备可找回。' : '手机号找回稍后开放。'}
                </Text>
              </View>
              {productFlags.phoneAuthEnabled ? (
                <PrimaryButton label="绑定手机号" variant="secondary" onPress={() => router.push('/login')} />
              ) : null}
            </GlassCard>
          ) : null}

          {session && !session.isAnonymous ? (
            <GlassCard style={styles.identityCard}>
              <View style={styles.protectCopy}>
                <Text style={styles.protectTitle}>当前身份已保护</Text>
                <Text style={styles.protectText}>
                  {phoneTail ? `尾号 ${phoneTail}` : '可通过手机号找回'}
                </Text>
              </View>
              <PrimaryButton label="退出当前设备" variant="ghost" onPress={handleSignOut} />
            </GlassCard>
          ) : null}

          {myStories.length === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyState title="还没有星星" body="发布后会出现在这里。" />
              <PrimaryButton
                label="发布故事"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/compose',
                    params: {
                      draftNonce: Date.now().toString(),
                      mode: 'new',
                    },
                  })
                }
              />
              {productFlags.phoneAuthEnabled ? (
                <PrimaryButton label="找回已有星星" variant="ghost" onPress={() => router.push('/login')} />
              ) : null}
            </View>
          ) : (
            <View style={styles.list}>
              {myStories.map((story) => (
                <StorySummaryCard
                  key={story.id}
                  story={story}
                  onLocate={async () => {
                    try {
                      const focusStoryId = await requestLocateStory(story.id);
                      if (focusStoryId) {
                        requestFocus(focusStoryId, { message: '已定位。' });
                      }
                      router.replace('/');
                    } catch (error) {
                      setFeedback(getUserFacingErrorMessage(error, '定位失败，请稍后再试。'));
                    }
                  }}
                  onEdit={() =>
                    router.push({
                      pathname: '/compose',
                      params: {
                        mode: 'edit',
                        storyId: story.id,
                      },
                    })
                  }
                  onDelete={() => {
                    Alert.alert('删除这颗星？', '故事内容会被删除，但星体会作为一颗沉默的星继续留在宇宙里。', [
                      { text: '取消', style: 'cancel' },
                      {
                        text: '删除',
                        style: 'destructive',
                        onPress: () => {
                          setDeletingStoryId(story.id);
                          setFeedback(null);
                          void deleteStory(story.id)
                            .then(() => {
                              setFeedback('已删除，星体会继续留在宇宙里。');
                            })
                            .catch((error) => {
                              setFeedback(getUserFacingErrorMessage(error, '删除失败，请稍后再试。'));
                            })
                            .finally(() => {
                              setDeletingStoryId((current) => (current === story.id ? null : current));
                            });
                        },
                      },
                    ]);
                  }}
                  deleting={deletingStoryId === story.id}
                />
              ))}
            </View>
          )}
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
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 116,
    gap: 18,
  },
  header: {
    gap: 16,
  },
  profileSub: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.body,
    fontSize: 12,
    paddingHorizontal: 2,
  },
  feedbackText: {
    color: cosmicTheme.colors.textSoft,
    fontFamily: cosmicTheme.fonts.body,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 2,
  },
  protectCard: {
    gap: 14,
    borderColor: 'rgba(255,255,255,0.075)',
  },
  identityCard: {
    gap: 14,
    borderColor: 'rgba(255,255,255,0.055)',
  },
  protectCopy: {
    gap: 6,
  },
  protectTitle: {
    color: cosmicTheme.colors.text,
    fontFamily: cosmicTheme.fonts.bodySemiBold,
    fontSize: 15,
  },
  protectText: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyWrap: {
    gap: 16,
    paddingTop: 24,
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.055)',
  },
});
