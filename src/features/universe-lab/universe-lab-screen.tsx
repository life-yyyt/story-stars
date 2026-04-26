import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppContext } from '@/src/context/app-context';
import { useUniverseFocusIntent } from '@/src/features/universe-runtime/universe-focus-intent';
import { getUserFacingErrorMessage } from '@/src/lib/error-message';
import { cosmicTheme } from '@/src/lib/theme';
import { createInitialUniverseWindowQuery } from '@/src/lib/universe-data';
import { StoryDetail } from '@/src/types/domain';

import { UniverseLabScene } from './universe-lab-scene';
import { UniverseLabStoryReader } from './universe-lab-story-reader';
import { UniverseLabStory } from './universe-lab-stories';
import { useUniverseLabScene } from './use-universe-lab-scene';

const toReaderStory = (story: StoryDetail): UniverseLabStory => ({
  id: story.id,
  starId: story.id,
  title: story.title || '未命名故事',
  body: story.body || '这颗星还没有留下正文。',
  authorLabel: story.authorMode === 'anonymous' ? '匿名旅人' : story.authorDisplayName || '无名星尘',
  coordinateLabel: story.coordinateCode || '私密星',
  coordinateCode: story.coordinateCode,
  visibility: story.visibility,
  likeCount: story.likeCount,
  viewCount: story.viewCount,
  likedByViewer: story.likedByViewer,
  isOwner: false,
});

const createLoadingStory = (storyId: string): UniverseLabStory => ({
  id: `loading-${storyId}`,
  starId: storyId,
  title: '星光正在抵达',
  body: '正在读取这颗星里的故事。',
  authorLabel: 'Story Stars',
  coordinateLabel: '读取中',
  coordinateCode: null,
  visibility: 'private',
  likeCount: 0,
  viewCount: 0,
  likedByViewer: false,
  isOwner: false,
});

const createUnavailableStory = (storyId: string): UniverseLabStory => ({
  id: `unavailable-${storyId}`,
  starId: storyId,
  title: '这颗星暂时不可读',
  body: '它可能是一颗私密星，或者故事还没有完成同步。',
  authorLabel: 'Story Stars',
  coordinateLabel: '不可读',
  coordinateCode: null,
  visibility: 'private',
  likeCount: 0,
  viewCount: 0,
  likedByViewer: false,
  isOwner: false,
});

const normalizeCoordinateInput = (value: string) => value.trim().toUpperCase();

export const UniverseLabScreen = () => {
  const router = useRouter();
  const {
    activeUniverseQuery,
    isBooting,
    loadStoryDetail,
    likeStory,
    locateByCoordinate,
    recordStoryView,
    session,
    syncUniverseWindow,
    visibleStars,
  } = useAppContext();
  const { clearFocusRequest, focusRequest } = useUniverseFocusIntent();
  const initialQueryRef = useRef(createInitialUniverseWindowQuery());
  const pendingCoordinateFocusRef = useRef<string | null>(null);
  const universeMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [readerStory, setReaderStory] = useState<UniverseLabStory | null>(null);
  const [isLocatorOpen, setIsLocatorOpen] = useState(false);
  const [coordinateInput, setCoordinateInput] = useState('');
  const [coordinateMessage, setCoordinateMessage] = useState<string | null>(null);
  const [universeMessage, setUniverseMessage] = useState<string | null>(null);
  const [readerActionMessage, setReaderActionMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const sceneStars = visibleStars;
  const scene = useUniverseLabScene(sceneStars);
  const { focusStarById } = scene;

  const activeReaderStory = readerStory ?? (scene.activeStoryId ? createLoadingStory(scene.activeStoryId) : null);

  const showUniverseMessage = useCallback((message: string) => {
    if (universeMessageTimerRef.current) {
      clearTimeout(universeMessageTimerRef.current);
    }

    setUniverseMessage(message);
    universeMessageTimerRef.current = setTimeout(() => {
      setUniverseMessage(null);
      universeMessageTimerRef.current = null;
    }, 1800);
  }, []);

  useEffect(
    () => () => {
      if (universeMessageTimerRef.current) {
        clearTimeout(universeMessageTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (isBooting || activeUniverseQuery) {
      return;
    }

    void syncUniverseWindow(initialQueryRef.current)
      .then(() => {
        setUniverseMessage(null);
      })
      .catch((error) => {
        setUniverseMessage(getUserFacingErrorMessage(error, '宇宙加载失败，请稍后再试。'));
      });
  }, [activeUniverseQuery, isBooting, syncUniverseWindow]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    if (focusStarById(focusRequest.storyId, { immediate: true, openReader: focusRequest.openReader })) {
      if (focusRequest.message) {
        showUniverseMessage(focusRequest.message);
      }
      clearFocusRequest();
    }
  }, [clearFocusRequest, focusRequest, focusStarById, showUniverseMessage]);

  useEffect(() => {
    const pendingStoryId = pendingCoordinateFocusRef.current;
    if (!pendingStoryId) {
      return;
    }

    if (focusStarById(pendingStoryId, { immediate: true })) {
      pendingCoordinateFocusRef.current = null;
      setCoordinateMessage(null);
      showUniverseMessage('已定位。');
    }
  }, [focusStarById, showUniverseMessage, visibleStars]);

  useEffect(() => {
    let disposed = false;

    if (!scene.activeStoryId) {
      setReaderStory(null);
      setReaderActionMessage(null);
      return () => {
        disposed = true;
      };
    }

    setReaderStory(null);
    setReaderActionMessage(null);
    void loadStoryDetail(scene.activeStoryId)
      .then((story) => {
        if (disposed) {
          return;
        }

        if (!story) {
          setReaderStory(createUnavailableStory(scene.activeStoryId!));
          return;
        }

        setReaderStory({
          ...toReaderStory(story),
          isOwner: session?.userId === story.authorId,
        });
        if (story.visibility === 'public') {
          void recordStoryView(story.id);
        }
      })
      .catch((error) => {
        if (disposed) {
          return;
        }

        setReaderStory({
          ...createUnavailableStory(scene.activeStoryId!),
          title: '故事暂时无法抵达',
          body: getUserFacingErrorMessage(error, '故事读取失败，请稍后再试。'),
        });
      });

    return () => {
      disposed = true;
    };
  }, [loadStoryDetail, recordStoryView, scene.activeStoryId, session?.userId]);

  const handleLikeActiveStory = async () => {
    const activeStory = readerStory;
    if (!activeStory || activeStory.visibility !== 'public' || activeStory.likedByViewer) {
      return;
    }

    setReaderActionMessage(null);

    try {
      const result = await likeStory(activeStory.starId);
      setReaderStory((current) =>
        current?.starId === activeStory.starId
          ? {
              ...current,
              likeCount: result.likeCount,
              likedByViewer: result.likedByViewer,
            }
          : current
      );
      setReaderActionMessage(result.didInsert ? '已点亮。' : '这颗星已经被你点亮过。');
    } catch (error) {
      const message = getUserFacingErrorMessage(error, '点亮失败，请稍后再试。');
      setReaderActionMessage(message);
      setUniverseMessage(message);
    }
  };

  const handleEditActiveStory = () => {
    if (!readerStory) {
      return;
    }

    scene.closeReader();
    router.push({
      pathname: '/compose',
      params: {
        mode: 'edit',
        storyId: readerStory.starId,
      },
    });
  };

  const handleCoordinateSubmit = async () => {
    const coordinateCode = normalizeCoordinateInput(coordinateInput);
    if (!coordinateCode) {
      setCoordinateMessage('请输入坐标码。');
      return;
    }

    Keyboard.dismiss();
    setIsLocating(true);
    setCoordinateMessage(null);

    try {
      const storyId = await locateByCoordinate(coordinateCode);
      if (!storyId) {
        setCoordinateMessage('没有找到这颗星。');
        return;
      }

      pendingCoordinateFocusRef.current = storyId;
      setIsLocatorOpen(false);
      setCoordinateInput('');
      if (focusStarById(storyId, { immediate: true })) {
        pendingCoordinateFocusRef.current = null;
        showUniverseMessage('已定位。');
      } else {
        setCoordinateMessage('正在靠近。');
      }
    } catch (error) {
      setCoordinateMessage(getUserFacingErrorMessage(error, '定位失败，请稍后再试。'));
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <View style={styles.screen}>
      <UniverseLabScene scene={scene} />

      <SafeAreaView pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View pointerEvents="box-none" style={styles.overlay}>
          <View pointerEvents="box-none" style={styles.topBar}>
            <View pointerEvents="none" style={styles.brandBlock}>
              <Text style={styles.eyebrow}>STARS</Text>
            </View>

            <Pressable
              onPress={() => {
                setIsLocatorOpen((current) => !current);
                setCoordinateMessage(null);
              }}
              style={({ pressed }) => [styles.locatorButton, pressed && styles.pressed]}>
              <Ionicons name="navigate-outline" color={cosmicTheme.colors.textSoft} size={15} />
              <Text style={styles.locatorButtonText}>坐标</Text>
            </Pressable>
          </View>

          {isLocatorOpen ? (
            <View style={styles.locatorPanel}>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isLocating}
                placeholder="STAR-RA8-L2Q"
                placeholderTextColor={cosmicTheme.colors.textMuted}
                value={coordinateInput}
                onChangeText={setCoordinateInput}
                onSubmitEditing={handleCoordinateSubmit}
                style={styles.coordinateInput}
              />
              <Pressable
                disabled={isLocating}
                onPress={handleCoordinateSubmit}
                style={({ pressed }) => [
                  styles.coordinateSubmit,
                  pressed && !isLocating && styles.pressed,
                  isLocating && styles.disabled,
                ]}>
                {isLocating ? (
                  <ActivityIndicator color={cosmicTheme.colors.text} size="small" />
                ) : (
                  <Text style={styles.coordinateSubmitText}>定位</Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {coordinateMessage ? (
            <View pointerEvents="none" style={styles.coordinateNotice}>
              <Text style={styles.coordinateNoticeText}>{coordinateMessage}</Text>
            </View>
          ) : null}

          {universeMessage ? (
            <View pointerEvents="none" style={styles.universeNotice}>
              <Text style={styles.universeNoticeText}>{universeMessage}</Text>
            </View>
          ) : null}

          {sceneStars.length === 0 ? (
            <View pointerEvents="none" style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>{isBooting ? '正在校准' : '暂无星星'}</Text>
              <Text style={styles.emptyDescription}>
                {isBooting ? '请稍候。' : '发布第一颗星。'}
              </Text>
            </View>
          ) : null}

        </View>
      </SafeAreaView>

      <UniverseLabStoryReader
        story={activeReaderStory}
        status={scene.readerStatus}
        actionMessage={readerActionMessage}
        onClose={scene.closeReader}
        onEdit={readerStory?.isOwner ? handleEditActiveStory : undefined}
        onLike={handleLikeActiveStory}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: cosmicTheme.colors.background,
  },
  overlay: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  brandBlock: {
    gap: 4,
  },
  eyebrow: {
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  locatorButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 13, 18, 0.48)',
    paddingHorizontal: 13,
  },
  locatorButtonText: {
    color: cosmicTheme.colors.textSoft,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 13,
  },
  locatorPanel: {
    position: 'absolute',
    top: 78,
    left: 28,
    right: 28,
    flexDirection: 'row',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(7, 9, 13, 0.82)',
    padding: 10,
  },
  coordinateInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: 13,
    color: cosmicTheme.colors.text,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  coordinateSubmit: {
    minWidth: 72,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  coordinateSubmitText: {
    color: cosmicTheme.colors.text,
    fontFamily: cosmicTheme.fonts.bodySemiBold,
    fontSize: 13,
  },
  coordinateNotice: {
    position: 'absolute',
    top: 132,
    alignSelf: 'center',
    maxWidth: 240,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(7, 9, 13, 0.76)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  coordinateNoticeText: {
    color: cosmicTheme.colors.textSoft,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 12,
  },
  universeNotice: {
    position: 'absolute',
    top: 156,
    left: 32,
    right: 32,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(7, 9, 13, 0.76)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  universeNoticeText: {
    color: cosmicTheme.colors.textSoft,
    fontFamily: cosmicTheme.fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyCopy: {
    position: 'absolute',
    top: 156,
    left: 32,
    right: 32,
    gap: 12,
  },
  emptyTitle: {
    color: cosmicTheme.colors.text,
    fontFamily: cosmicTheme.fonts.bodySemiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  emptyDescription: {
    maxWidth: 248,
    color: cosmicTheme.colors.textMuted,
    fontFamily: cosmicTheme.fonts.body,
    fontSize: 13,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.52,
  },
});
