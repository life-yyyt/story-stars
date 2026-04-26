import React, {
  createContext,
  PropsWithChildren,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getOrCreateDeviceId } from '@/src/lib/storage';
import { getUserFacingErrorMessage } from '@/src/lib/error-message';
import { createUniverseWindowQuery } from '@/src/lib/universe-data';
import { PRIVATE_STAR_FIXED_BRIGHTNESS } from '@/src/lib/star-utils';
import { backend } from '@/src/services';
import {
  StoryDetail,
  StoryEditorValues,
  StoryLikeResult,
  StorySaveResult,
  UniverseStarPreview,
  UniverseWindowQuery,
  ViewerSession,
} from '@/src/types/domain';

interface AppContextValue {
  backendMode: 'demo' | 'supabase';
  isBooting: boolean;
  isConfigured: boolean;
  session: ViewerSession | null;
  viewerFingerprint: string | null;
  loginHint: string | null;
  visibleStars: UniverseStarPreview[];
  myStories: StoryDetail[];
  activeUniverseQuery: UniverseWindowQuery | null;
  refreshMyStories: () => Promise<void>;
  syncUniverseWindow: (query: UniverseWindowQuery) => Promise<void>;
  loadStoryDetail: (storyId: string) => Promise<StoryDetail | undefined>;
  locateByCoordinate: (coordinateCode: string) => Promise<string | null>;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  requestPhoneBinding: (phone: string) => Promise<void>;
  verifyPhoneBinding: (phone: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveStory: (values: StoryEditorValues, existingStory?: StoryDetail) => Promise<StorySaveResult>;
  deleteStory: (storyId: string) => Promise<void>;
  findStory: (storyId: string) => StoryDetail | undefined;
  requestLocateStory: (storyId: string) => Promise<string | null>;
  recordStoryView: (storyId: string) => Promise<void>;
  likeStory: (storyId: string) => Promise<StoryLikeResult>;
  debugResetUniverse: (options?: { clearDemoCache?: boolean }) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const sortStories = (stories: StoryDetail[]) =>
  [...stories].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

const upsertStory = (stories: StoryDetail[], nextStory: StoryDetail) =>
  sortStories([nextStory, ...stories.filter((story) => story.id !== nextStory.id)]);

const toVisibleStarPreview = (
  story: StoryDetail,
  viewerSession: ViewerSession | null
): UniverseStarPreview => {
  const state: UniverseStarPreview['state'] =
    story.visibility === 'public'
      ? 'public'
      : viewerSession?.userId === story.authorId
        ? 'private_owner'
        : 'private_locked';
  const isLocked = state === 'private_locked';

  return {
    id: story.id,
    x: story.starPosition.x,
    y: story.starPosition.y,
    z: story.starPosition.z,
    sizeFactor: story.starSizeFactor,
    color: story.starColor,
    brightness: story.brightness,
    state,
    clickable: !isLocked,
    coordinateCode: isLocked ? null : story.coordinateCode,
  };
};

const upsertVisibleStarPreview = (
  stars: UniverseStarPreview[],
  story: StoryDetail,
  viewerSession: ViewerSession | null
) => {
  const nextStar = toVisibleStarPreview(story, viewerSession);
  return [nextStar, ...stars.filter((star) => star.id !== nextStar.id)];
};

export const AppProvider = ({ children }: PropsWithChildren) => {
  const [isBooting, setIsBooting] = useState(true);
  const [session, setSession] = useState<ViewerSession | null>(null);
  const [viewerFingerprint, setViewerFingerprint] = useState<string | null>(null);
  const [loginHint, setLoginHint] = useState<string | null>(
    backend.mode === 'demo' ? '演示模式会自动创建本地匿名发布身份。' : null
  );
  const [visibleStars, setVisibleStars] = useState<UniverseStarPreview[]>([]);
  const [myStories, setMyStories] = useState<StoryDetail[]>([]);
  const [storyDetailCache, setStoryDetailCache] = useState<Record<string, StoryDetail>>({});
  const [activeUniverseQuery, setActiveUniverseQuery] = useState<UniverseWindowQuery | null>(null);
  const detailCacheRef = useRef<Record<string, StoryDetail>>({});
  const sessionRef = useRef<ViewerSession | null>(null);
  const viewerFingerprintRef = useRef<string | null>(null);
  const bootedRef = useRef(false);
  const universeRequestRef = useRef(0);
  const bootstrapRequestRef = useRef(0);

  useEffect(() => {
    detailCacheRef.current = storyDetailCache;
  }, [storyDetailCache]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    viewerFingerprintRef.current = viewerFingerprint;
  }, [viewerFingerprint]);

  const primeStoryDetail = useCallback(
    (story: StoryDetail) => {
      setStoryDetailCache((current) => ({ ...current, [story.id]: story }));
      const activeSession = sessionRef.current ?? session;
      if (activeSession?.userId === story.authorId) {
        setMyStories((current) => upsertStory(current, story));
      }
    },
    [session]
  );

  const refreshMyStories = useCallback(
    async (
      targetSession: ViewerSession | null = sessionRef.current,
      targetViewerFingerprint: string | null = viewerFingerprintRef.current
    ) => {
      if (!targetSession) {
        startTransition(() => {
          setMyStories([]);
        });
        return;
      }

      try {
        const nextStories = await backend.loadMyStories(targetSession, targetViewerFingerprint);
        startTransition(() => {
          setMyStories(sortStories(nextStories));
          setStoryDetailCache((current) => {
            const nextCache = { ...current };
            nextStories.forEach((story) => {
              nextCache[story.id] = story;
            });
            return nextCache;
          });
        });
      } catch (error) {
        console.warn(
          'refreshMyStories failed',
          getUserFacingErrorMessage(error, '我的星星暂时刷新失败，已保留当前列表。')
        );
      }
    },
    []
  );

  const syncUniverseWindow = useCallback(async (query: UniverseWindowQuery) => {
    const requestId = universeRequestRef.current + 1;
    universeRequestRef.current = requestId;

    const stars = await backend.loadUniverseWindow(sessionRef.current, viewerFingerprintRef.current, query);
    if (universeRequestRef.current !== requestId) {
      return;
    }

    startTransition(() => {
      setVisibleStars(stars);
      setActiveUniverseQuery(query);
    });
  }, []);

  const bootstrapUniverse = useCallback(
    async ({ clearDemoCache = false }: { clearDemoCache?: boolean } = {}) => {
      const requestId = bootstrapRequestRef.current + 1;
      bootstrapRequestRef.current = requestId;
      universeRequestRef.current += 1;

      startTransition(() => {
        setIsBooting(true);
        setStoryDetailCache({});
        setVisibleStars([]);
        setActiveUniverseQuery(null);
      });

      if (clearDemoCache) {
        await backend.debugClearDemoCache?.();
      }

      try {
        const [currentSession, deviceId] = await Promise.all([backend.getSession(), getOrCreateDeviceId()]);
        if (bootstrapRequestRef.current !== requestId) {
          return;
        }

        sessionRef.current = currentSession;
        viewerFingerprintRef.current = deviceId;

        startTransition(() => {
          setSession(currentSession);
          setViewerFingerprint(deviceId);
          setMyStories([]);
          setVisibleStars([]);
          setActiveUniverseQuery(null);
          setIsBooting(false);
        });

        if (currentSession) {
          void refreshMyStories(currentSession, deviceId);
        }
      } catch {
        if (bootstrapRequestRef.current === requestId) {
          startTransition(() => {
            setIsBooting(false);
          });
        }
      }
    },
    [refreshMyStories]
  );

  useEffect(() => {
    if (bootedRef.current) {
      return;
    }

    bootedRef.current = true;
    void bootstrapUniverse();
  }, [bootstrapUniverse]);

  useEffect(() => {
    const unsubscribe = backend.subscribeToAuth((nextSession) => {
      const currentSession = sessionRef.current;
      const isSameSession =
        currentSession?.userId === nextSession?.userId && currentSession?.phone === nextSession?.phone;

      if (isSameSession) {
        return;
      }

      sessionRef.current = nextSession;
      setSession(nextSession);
      void refreshMyStories(nextSession, viewerFingerprintRef.current);
    });

    return () => {
      unsubscribe();
    };
  }, [refreshMyStories]);

  const requestOtp = useCallback(async (phone: string) => {
    const hint = await backend.requestOtp(phone);
    setLoginHint(hint);
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, code: string) => {
      const nextSession = await backend.verifyOtp(phone, code);
      sessionRef.current = nextSession;
      setSession(nextSession);
      setLoginHint('已找回你的星星。');
      await refreshMyStories(nextSession, viewerFingerprintRef.current);
    },
    [refreshMyStories]
  );

  const requestPhoneBinding = useCallback(async (phone: string) => {
    const hint = await backend.requestPhoneBinding(phone, viewerFingerprintRef.current);
    setLoginHint(hint);
  }, []);

  const verifyPhoneBinding = useCallback(
    async (phone: string, code: string) => {
      const nextSession = await backend.verifyPhoneBinding(phone, code);
      sessionRef.current = nextSession;
      setSession(nextSession);
      setLoginHint('手机号已绑定，你的星星已经被保护。');
      await refreshMyStories(nextSession, viewerFingerprintRef.current);
    },
    [refreshMyStories]
  );

  const signOut = useCallback(async () => {
    await backend.signOut();
    sessionRef.current = null;
    setSession(null);
    startTransition(() => {
      setMyStories([]);
      setStoryDetailCache({});
      setVisibleStars([]);
      setActiveUniverseQuery(null);
    });
  }, []);

  const getActiveViewerFingerprint = useCallback(async () => {
    const currentFingerprint = viewerFingerprintRef.current;
    if (currentFingerprint) {
      return currentFingerprint;
    }

    const nextFingerprint = await getOrCreateDeviceId();
    viewerFingerprintRef.current = nextFingerprint;
    setViewerFingerprint(nextFingerprint);
    return nextFingerprint;
  }, []);

  const loadStoryDetail = useCallback(
    async (storyId: string) => {
      const cachedStory = detailCacheRef.current[storyId];
      if (cachedStory) {
        return cachedStory;
      }

      const story = await backend.loadStoryDetail(sessionRef.current, viewerFingerprintRef.current, storyId);
      if (!story) {
        return undefined;
      }

      primeStoryDetail(story);
      return story;
    },
    [primeStoryDetail]
  );

  const findStory = useCallback(
    (storyId: string) => detailCacheRef.current[storyId] ?? myStories.find((story) => story.id === storyId),
    [myStories]
  );

  const requestLocateStory = useCallback(
    async (storyId: string) => {
      const story = findStory(storyId);
      if (!story) {
        return null;
      }

      const locateQuery = createUniverseWindowQuery(story.starPosition, 220, true);
      await syncUniverseWindow(locateQuery);
      return storyId;
    },
    [findStory, syncUniverseWindow]
  );

  const locateByCoordinate = useCallback(
    async (coordinateCode: string) => {
      const target = await backend.resolveCoordinateTarget(
        sessionRef.current,
        viewerFingerprintRef.current,
        coordinateCode
      );
      if (!target) {
        return null;
      }

      await syncUniverseWindow(createUniverseWindowQuery(target.position, 220, true));
      return target.storyId;
    },
    [syncUniverseWindow]
  );

  const saveStory = useCallback(
    async (values: StoryEditorValues, existingStory?: StoryDetail) => {
      const publishSession = await backend.ensurePublishSession(viewerFingerprintRef.current);
      sessionRef.current = publishSession;
      setSession(publishSession);

      const result = await backend.saveStory(publishSession, values, existingStory);
      primeStoryDetail(result.story);

      startTransition(() => {
        setVisibleStars((current) => upsertVisibleStarPreview(current, result.story, publishSession));
      });

      void refreshMyStories(publishSession, viewerFingerprintRef.current).catch((error) => {
        console.warn(
          'refreshMyStories after save failed',
          getUserFacingErrorMessage(error, '故事已发布，我的星星稍后会自动刷新。')
        );
      });

      void syncUniverseWindow(createUniverseWindowQuery(result.story.starPosition, 220, true)).catch((error) => {
        console.warn(
          'syncUniverseWindow after save failed',
          getUserFacingErrorMessage(error, '故事已发布，宇宙稍后会自动刷新。')
        );
      });

      return result;
    },
    [primeStoryDetail, refreshMyStories, syncUniverseWindow]
  );

  const deleteStory = useCallback(
    async (storyId: string) => {
      const activeSession = sessionRef.current;
      if (!activeSession) {
        throw new Error('当前没有可用的宇宙身份。');
      }

      await backend.deleteStory(activeSession, storyId);

      startTransition(() => {
        setMyStories((current) => current.filter((story) => story.id !== storyId));
        setStoryDetailCache((current) => {
          const nextCache = { ...current };
          delete nextCache[storyId];
          return nextCache;
        });
        setVisibleStars((current) =>
          current.map((star) =>
            star.id === storyId
              ? {
                  ...star,
                  brightness: Math.min(star.brightness, PRIVATE_STAR_FIXED_BRIGHTNESS),
                  clickable: false,
                  coordinateCode: null,
                  state: 'private_locked',
                }
              : star
          )
        );
      });
    },
    []
  );

  const recordStoryView = useCallback(
    async (storyId: string) => {
      let result;
      const activeViewerFingerprint = await getActiveViewerFingerprint();

      try {
        result = await backend.recordStoryView(storyId, activeViewerFingerprint, sessionRef.current);
      } catch (error) {
        console.warn('recordStoryView failed', error);
        return;
      }

      if (!result.didInsert) {
        return;
      }

      setStoryDetailCache((current) => {
        const story = current[storyId];
        if (!story) {
          return current;
        }

        return {
          ...current,
          [storyId]: {
            ...story,
            viewCount: result.viewCount,
          },
        };
      });

      setMyStories((current) =>
        current.map((story) =>
          story.id === storyId
            ? {
                ...story,
                viewCount: result.viewCount,
              }
            : story
        )
      );
    },
    [getActiveViewerFingerprint]
  );

  const likeStory = useCallback(
    async (storyId: string) => {
      const activeViewerFingerprint = await getActiveViewerFingerprint();
      const cachedStory = detailCacheRef.current[storyId];
      const result = await backend.likeStory(storyId, activeViewerFingerprint, sessionRef.current);

      if (!result.didInsert && !result.likedByViewer && !cachedStory?.likedByViewer) {
        throw new Error('云端点亮函数还没有完成更新，请先执行最新 Supabase SQL。');
      }

      const nextResult =
        result.didInsert && cachedStory && result.likeCount <= cachedStory.likeCount
          ? {
              ...result,
              likeCount: cachedStory.likeCount + 1,
              likedByViewer: true,
            }
          : result;

      startTransition(() => {
        setStoryDetailCache((current) => {
          const story = current[storyId];
          if (!story) {
            return current;
          }

          return {
            ...current,
            [storyId]: {
              ...story,
              likeCount: nextResult.likeCount,
              brightness: nextResult.brightness,
              likedByViewer: nextResult.likedByViewer,
            },
          };
        });

        setVisibleStars((current) =>
          current.map((star) =>
            star.id === storyId
              ? {
                  ...star,
                  brightness: nextResult.brightness,
                }
              : star
          )
        );

        setMyStories((current) =>
          current.map((story) =>
            story.id === storyId
              ? {
                  ...story,
                  likeCount: nextResult.likeCount,
                  brightness: nextResult.brightness,
                  likedByViewer: nextResult.likedByViewer,
                }
              : story
          )
        );
      });

      return nextResult;
    },
    [getActiveViewerFingerprint]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      backendMode: backend.mode,
      isBooting,
      isConfigured: backend.isConfigured,
      session,
      viewerFingerprint,
      loginHint,
      visibleStars,
      myStories,
      activeUniverseQuery,
      refreshMyStories: () => refreshMyStories(session, viewerFingerprint),
      syncUniverseWindow,
      loadStoryDetail,
      locateByCoordinate,
      requestOtp,
      verifyOtp,
      requestPhoneBinding,
      verifyPhoneBinding,
      signOut,
      saveStory,
      deleteStory,
      findStory,
      requestLocateStory,
      recordStoryView,
      likeStory,
      debugResetUniverse: bootstrapUniverse,
    }),
    [
      activeUniverseQuery,
      bootstrapUniverse,
      deleteStory,
      findStory,
      isBooting,
      likeStory,
      loadStoryDetail,
      locateByCoordinate,
      loginHint,
      myStories,
      recordStoryView,
      refreshMyStories,
      requestLocateStory,
      requestOtp,
      requestPhoneBinding,
      saveStory,
      session,
      signOut,
      syncUniverseWindow,
      verifyPhoneBinding,
      verifyOtp,
      viewerFingerprint,
      visibleStars,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppContext 必须在 AppProvider 内部使用。');
  }

  return context;
};
