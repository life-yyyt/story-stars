import AsyncStorage from '@react-native-async-storage/async-storage';

import { demoSeedStories, DEMO_SEED_VERSION } from '@/src/lib/demo-seed';
import { moderateDraftLocally } from '@/src/lib/moderation';
import { normalizePhoneForAuth } from '@/src/lib/phone';
import {
  createBrightnessFromLikes,
  generateCoordinateCode,
  generateSizeFactor,
  generateStarPlacement,
  PRIVATE_STAR_FIXED_BRIGHTNESS,
  PUBLIC_STAR_BASE_BRIGHTNESS,
} from '@/src/lib/star-utils';
import { getStoryEditorValidationMessage, normalizeStoryEditorValues } from '@/src/lib/story-validation';
import { buildCoordinateTarget, selectWindowStories } from '@/src/lib/universe-data';
import { StoryBackend } from '@/src/services/backend';
import { Story, StoryEditorValues, UniverseWindowQuery, ViewerSession } from '@/src/types/domain';

const STORIES_KEY = 'story-stars/demo/stories';
const SEED_VERSION_KEY = 'story-stars/demo/seed-version';
const SESSION_KEY = 'story-stars/demo/session';
const OTP_PHONE_KEY = 'story-stars/demo/otp-phone';
const PHONE_SESSION_PREFIX = 'story-stars/demo/phone-session/';
const VIEW_LOG_KEY = 'story-stars/demo/views';
const LIKE_LOG_KEY = 'story-stars/demo/likes';
const STAR_REMNANT_AUTHOR_ID = 'demo-star-remnant';
const DEMO_CACHE_TTL_MS = 800;
const FORCE_DEV_RESEED = __DEV__;
const DEMO_SEED_STORIES_ENABLED = false;
const DAILY_STORY_LIMIT = 3;
const DAILY_STORY_LIMIT_MESSAGE = '今天最多发布 3 颗星星，明天再来。';

let storiesCachePromise: Promise<Story[]> | null = null;
let storiesCacheExpiresAt = 0;
let likeLogCachePromise: Promise<Record<string, true>> | null = null;
let likeLogCacheExpiresAt = 0;

const clearDemoRuntimeCaches = () => {
  storiesCachePromise = null;
  storiesCacheExpiresAt = 0;
  likeLogCachePromise = null;
  likeLogCacheExpiresAt = 0;
};

const clearDemoPersistentData = async () => {
  await AsyncStorage.multiRemove([STORIES_KEY, SEED_VERSION_KEY, VIEW_LOG_KEY, LIKE_LOG_KEY]);
  clearDemoRuntimeCaches();
};

const cloneStories = (stories: Story[]) => JSON.parse(JSON.stringify(stories)) as Story[];
const cloneInitialDemoStories = () => (DEMO_SEED_STORIES_ENABLED ? cloneStories(demoSeedStories) : []);

const normalizeStoredStory = (story: Story): Story => ({
  ...story,
  brightness:
    story.visibility === 'public'
      ? createBrightnessFromLikes(story.likeCount ?? 0)
      : PRIVATE_STAR_FIXED_BRIGHTNESS,
  likeCount: story.likeCount ?? 0,
  likedByViewer: false,
});

const loadStoriesFromStorage = async () => {
  const raw = await AsyncStorage.getItem(STORIES_KEY);
  const storedSeedVersion = await AsyncStorage.getItem(SEED_VERSION_KEY);

  if (raw) {
    const parsed = (JSON.parse(raw) as Story[]).map(normalizeStoredStory);

    if (storedSeedVersion === DEMO_SEED_VERSION && !FORCE_DEV_RESEED) {
      return DEMO_SEED_STORIES_ENABLED ? parsed : parsed.filter((story) => !story.id.startsWith('seed-story-'));
    }

    const userStories = parsed.filter((story) => !story.id.startsWith('seed-story-'));
    const reseeded = [...cloneInitialDemoStories(), ...userStories];
    await AsyncStorage.setItem(STORIES_KEY, JSON.stringify(reseeded));
    await AsyncStorage.setItem(SEED_VERSION_KEY, DEMO_SEED_VERSION);
    return reseeded;
  }

  const seeded = cloneInitialDemoStories().map(normalizeStoredStory);
  await AsyncStorage.setItem(STORIES_KEY, JSON.stringify(seeded));
  await AsyncStorage.setItem(SEED_VERSION_KEY, DEMO_SEED_VERSION);
  return seeded;
};

const saveStoriesToStorage = async (stories: Story[]) => {
  await AsyncStorage.setItem(STORIES_KEY, JSON.stringify(stories));
  storiesCachePromise = Promise.resolve(stories);
  storiesCacheExpiresAt = Date.now() + DEMO_CACHE_TTL_MS;
};

const displayNameForStory = (session: ViewerSession, authorMode: StoryEditorValues['authorMode']) =>
  authorMode === 'anonymous' ? '匿名旅人' : session.displayName;

const normalizeSession = (raw: string | null): ViewerSession | null => {
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as ViewerSession;
};

const nowIso = () => new Date().toISOString();

const toLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const countStoriesPublishedToday = (stories: Story[], authorId: string) => {
  const today = toLocalDateKey(new Date());
  return stories.filter((story) => story.authorId === authorId && toLocalDateKey(story.createdAt) === today).length;
};

const getViewLog = async () => {
  const raw = await AsyncStorage.getItem(VIEW_LOG_KEY);
  return raw ? (JSON.parse(raw) as Record<string, true>) : {};
};

const getLikeLog = async () => {
  if (likeLogCachePromise && Date.now() < likeLogCacheExpiresAt) {
    return likeLogCachePromise;
  }

  const raw = await AsyncStorage.getItem(LIKE_LOG_KEY);
  likeLogCachePromise = Promise.resolve(raw ? (JSON.parse(raw) as Record<string, true>) : {});
  likeLogCacheExpiresAt = Date.now() + DEMO_CACHE_TTL_MS;
  return likeLogCachePromise;
};

const withViewerLikes = (stories: Story[], viewerFingerprint: string | null, likeLog: Record<string, true>) =>
  stories.map((story) => ({
    ...story,
    likedByViewer: viewerFingerprint ? Boolean(likeLog[`${story.id}:${viewerFingerprint}`]) : false,
  }));

const updateStory = (stories: Story[], nextStory: Story) =>
  stories.map((story) => (story.id === nextStory.id ? nextStory : story));

const createStoryRemnant = (story: Story, timestamp: string): Story => ({
  id: `remnant-${story.id}`,
  authorId: STAR_REMNANT_AUTHOR_ID,
  title: null,
  body: null,
  visibility: 'private',
  authorMode: 'anonymous',
  authorDisplayName: null,
  starColor: story.starColor,
  starSizeFactor: story.starSizeFactor,
  brightness: PRIVATE_STAR_FIXED_BRIGHTNESS,
  starPosition: story.starPosition,
  coordinateCode: null,
  createdAt: story.createdAt,
  updatedAt: timestamp,
  viewCount: 0,
  likeCount: 0,
  likedByViewer: false,
});

const loadStoriesFromStorageCached = async () => {
  if (storiesCachePromise && Date.now() < storiesCacheExpiresAt) {
    return storiesCachePromise;
  }

  storiesCachePromise = loadStoriesFromStorage();
  storiesCacheExpiresAt = Date.now() + DEMO_CACHE_TTL_MS;
  return storiesCachePromise;
};

const loadStoriesForViewer = async (viewerFingerprint: string | null) => {
  const [stories, likeLog] = await Promise.all([loadStoriesFromStorageCached(), getLikeLog()]);
  return withViewerLikes(stories, viewerFingerprint, likeLog).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

const canReadStory = (story: Story, session: ViewerSession | null) =>
  story.visibility === 'public' || session?.userId === story.authorId;

const normalizeCoordinateCode = (value: string) => value.trim().toUpperCase();

const createAnonymousDemoSession = (viewerFingerprint: string | null): ViewerSession => {
  const suffix = (viewerFingerprint ?? Date.now().toString(36)).replace(/[^a-zA-Z0-9]/g, '').slice(-6) || '000000';

  return {
    userId: `demo-anon-${suffix}`,
    displayName: `星旅人-${suffix.slice(-4)}`,
    phone: '',
    mode: 'demo',
    isAnonymous: true,
  };
};

export const demoBackend: StoryBackend = {
  mode: 'demo',
  isConfigured: false,
  debugClearDemoCache: clearDemoPersistentData,

  async requestOtp(phone) {
    await AsyncStorage.setItem(OTP_PHONE_KEY, normalizePhoneForAuth(phone));
    return '演示模式验证码固定为 000000。';
  },

  async verifyOtp(phone, code) {
    const authPhone = normalizePhoneForAuth(phone);
    const pendingPhone = await AsyncStorage.getItem(OTP_PHONE_KEY);

    if (pendingPhone !== authPhone || code !== '000000') {
      throw new Error('验证码不正确。演示模式请使用 000000。');
    }

    const storedSession = normalizeSession(await AsyncStorage.getItem(`${PHONE_SESSION_PREFIX}${authPhone}`));
    if (!storedSession) {
      throw new Error('没有找到这个手机号保护的星星。');
    }

    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(storedSession));
    return storedSession;
  },

  async requestPhoneBinding(phone, viewerFingerprint) {
    const authPhone = normalizePhoneForAuth(phone);
    const existingSession = normalizeSession(await AsyncStorage.getItem(SESSION_KEY));
    const session = existingSession ?? createAnonymousDemoSession(viewerFingerprint);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    await AsyncStorage.setItem(OTP_PHONE_KEY, authPhone);
    return '演示模式验证码固定为 000000。';
  },

  async verifyPhoneBinding(phone, code) {
    const authPhone = normalizePhoneForAuth(phone);
    const pendingPhone = await AsyncStorage.getItem(OTP_PHONE_KEY);
    const existingSession = normalizeSession(await AsyncStorage.getItem(SESSION_KEY));

    if (pendingPhone !== authPhone || code !== '000000') {
      throw new Error('验证码不正确。演示模式请使用 000000。');
    }

    if (!existingSession) {
      throw new Error('当前没有可保护的宇宙身份。');
    }

    const protectedSession: ViewerSession = {
      ...existingSession,
      phone: authPhone,
      displayName: `星旅人 ${authPhone.slice(-4) || '0000'}`,
      isAnonymous: false,
    };

    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(protectedSession));
    await AsyncStorage.setItem(`${PHONE_SESSION_PREFIX}${authPhone}`, JSON.stringify(protectedSession));
    return protectedSession;
  },

  async ensurePublishSession(viewerFingerprint) {
    const existingSession = normalizeSession(await AsyncStorage.getItem(SESSION_KEY));
    if (existingSession) {
      return existingSession;
    }

    const session = createAnonymousDemoSession(viewerFingerprint);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },

  async getSession() {
    return normalizeSession(await AsyncStorage.getItem(SESSION_KEY));
  },

  async signOut() {
    await AsyncStorage.removeItem(SESSION_KEY);
  },

  subscribeToAuth(listener) {
    let disposed = false;
    this.getSession().then((session) => {
      if (!disposed) {
        listener(session);
      }
    });

    return () => {
      disposed = true;
    };
  },

  async loadUniverseWindow(session, viewerFingerprint, query: UniverseWindowQuery) {
    const stories = await loadStoriesForViewer(viewerFingerprint);
    return selectWindowStories(stories, query, session);
  },

  async loadStoryDetail(session, viewerFingerprint, storyId) {
    const stories = await loadStoriesForViewer(viewerFingerprint);
    const story = stories.find((item) => item.id === storyId);

    if (!story || !canReadStory(story, session)) {
      return null;
    }

    return story;
  },

  async resolveCoordinateTarget(session, viewerFingerprint, coordinateCode) {
    const normalized = normalizeCoordinateCode(coordinateCode);
    const stories = await loadStoriesForViewer(viewerFingerprint);
    const story = stories.find(
      (item) => item.coordinateCode?.toUpperCase() === normalized && canReadStory(item, session)
    );

    return story ? buildCoordinateTarget(story) : null;
  },

  async loadMyStories(session, viewerFingerprint) {
    const stories = await loadStoriesForViewer(viewerFingerprint);
    return stories.filter((story) => story.authorId === session.userId);
  },

  async saveStory(session, values, existingStory) {
    const draftValues = normalizeStoryEditorValues(values);
    const validationMessage = getStoryEditorValidationMessage(draftValues);
    if (validationMessage) {
      throw new Error(validationMessage);
    }

    if (draftValues.visibility === 'public') {
      const moderation = moderateDraftLocally(draftValues.title, draftValues.body);
      if (moderation.status === 'rejected') {
        throw Object.assign(new Error(moderation.message), { moderation });
      }
    }

    const stories = await loadStoriesFromStorage();
    const timestamp = nowIso();

    if (existingStory) {
      if (existingStory.authorId !== session.userId) {
        throw new Error('你只能编辑自己的星星。');
      }

      const nextStory: Story = {
        ...existingStory,
        title: draftValues.title,
        body: draftValues.body,
        visibility: draftValues.visibility,
        authorMode: draftValues.authorMode,
        authorDisplayName: displayNameForStory(session, draftValues.authorMode),
        starColor: draftValues.starColor,
        coordinateCode:
          draftValues.visibility === 'public'
            ? existingStory.coordinateCode ?? generateCoordinateCode()
            : null,
        brightness:
          draftValues.visibility === 'public'
            ? createBrightnessFromLikes(existingStory.likeCount)
            : PRIVATE_STAR_FIXED_BRIGHTNESS,
        updatedAt: timestamp,
      };

      const nextStories = updateStory(stories, nextStory);
      await saveStoriesToStorage(nextStories);
      return { story: nextStory };
    }

    if (countStoriesPublishedToday(stories, session.userId) >= DAILY_STORY_LIMIT) {
      throw new Error(DAILY_STORY_LIMIT_MESSAGE);
    }

    const newStory: Story = {
      id: `story-${Date.now().toString(36)}`,
      authorId: session.userId,
      title: draftValues.title,
      body: draftValues.body,
      visibility: draftValues.visibility,
      authorMode: draftValues.authorMode,
      authorDisplayName: displayNameForStory(session, draftValues.authorMode),
      starColor: draftValues.starColor,
      starSizeFactor: generateSizeFactor(),
      brightness: draftValues.visibility === 'public' ? PUBLIC_STAR_BASE_BRIGHTNESS : PRIVATE_STAR_FIXED_BRIGHTNESS,
      starPosition: generateStarPlacement(stories),
      coordinateCode: draftValues.visibility === 'public' ? generateCoordinateCode() : null,
      createdAt: timestamp,
      updatedAt: timestamp,
      viewCount: 0,
      likeCount: 0,
      likedByViewer: false,
    };

    const nextStories = [newStory, ...stories];
    await saveStoriesToStorage(nextStories);
    return { story: newStory };
  },

  async deleteStory(session, storyId) {
    const stories = await loadStoriesFromStorage();
    const target = stories.find((story) => story.id === storyId);

    if (!target || target.authorId !== session.userId) {
      throw new Error('只能删除你自己发布的星星。');
    }

    const timestamp = nowIso();
    const remnant = createStoryRemnant(target, timestamp);
    const nextStories = [remnant, ...stories.filter((story) => story.id !== storyId && story.id !== remnant.id)];
    await saveStoriesToStorage(nextStories);
  },

  async recordStoryView(storyId, viewerFingerprint) {
    const viewLog = await getViewLog();
    const bucket = `${storyId}:${viewerFingerprint}:${new Date().toISOString().slice(0, 10)}`;

    if (viewLog[bucket]) {
      const stories = await loadStoriesFromStorage();
      const story = stories.find((item) => item.id === storyId);
      return {
        didInsert: false,
        viewCount: story?.viewCount ?? 0,
      };
    }

    viewLog[bucket] = true;
    await AsyncStorage.setItem(VIEW_LOG_KEY, JSON.stringify(viewLog));

    const stories = await loadStoriesFromStorage();
    const target = stories.find((story) => story.id === storyId);

    if (!target || target.visibility !== 'public') {
      return { didInsert: false, viewCount: target?.viewCount ?? 0 };
    }

    const nextStory = {
      ...target,
      viewCount: target.viewCount + 1,
    };

    await saveStoriesToStorage(updateStory(stories, nextStory));

    return {
      didInsert: true,
      viewCount: nextStory.viewCount,
    };
  },

  async likeStory(storyId, viewerFingerprint) {
    const likeLog = await getLikeLog();
    const bucket = `${storyId}:${viewerFingerprint}`;
    const stories = await loadStoriesFromStorage();
    const target = stories.find((story) => story.id === storyId);

    if (!target || target.visibility !== 'public') {
      return {
        didInsert: false,
        likeCount: target?.likeCount ?? 0,
        brightness: target?.brightness ?? PUBLIC_STAR_BASE_BRIGHTNESS,
        likedByViewer: Boolean(likeLog[bucket]),
      };
    }

    if (likeLog[bucket]) {
      return {
        didInsert: false,
        likeCount: target.likeCount,
        brightness: target.brightness,
        likedByViewer: true,
      };
    }

    likeLog[bucket] = true;
    await AsyncStorage.setItem(LIKE_LOG_KEY, JSON.stringify(likeLog));
    likeLogCachePromise = Promise.resolve(likeLog);
    likeLogCacheExpiresAt = Date.now() + DEMO_CACHE_TTL_MS;

    const nextStory: Story = {
      ...target,
      likeCount: target.likeCount + 1,
      brightness: createBrightnessFromLikes(target.likeCount + 1),
      likedByViewer: true,
    };

    await saveStoriesToStorage(updateStory(stories, nextStory));

    return {
      didInsert: true,
      likeCount: nextStory.likeCount,
      brightness: nextStory.brightness,
      likedByViewer: true,
    };
  },
};
