import { Session } from '@supabase/supabase-js';

import { getUserFacingErrorMessage } from '@/src/lib/error-message';
import { normalizePhoneForAuth } from '@/src/lib/phone';
import { supabase } from '@/src/lib/supabase';
import {
  createBrightnessFromLikes,
  generateCoordinateCode,
  PRIVATE_STAR_FIXED_BRIGHTNESS,
  PUBLIC_STAR_BASE_BRIGHTNESS,
} from '@/src/lib/star-utils';
import { getStoryEditorValidationMessage, normalizeStoryEditorValues } from '@/src/lib/story-validation';
import { StoryBackend } from '@/src/services/backend';
import {
  Story,
  StoryLikeResult,
  StorySaveResult,
  StoryViewResult,
  UniverseCoordinateTarget,
  UniverseStar,
  UniverseStarState,
  UniverseWindowQuery,
  ViewerSession,
} from '@/src/types/domain';

type StoryRow = {
  id: string;
  author_id: string;
  title: string | null;
  body: string | null;
  visibility: 'public' | 'private';
  author_mode: 'named' | 'anonymous';
  author_display_name: string | null;
  star_color: string;
  star_size_factor: number;
  brightness_score: number;
  star_x: number;
  star_y: number;
  star_z: number;
  coordinate_code: string | null;
  created_at: string;
  updated_at: string;
  view_count: number;
  like_count: number;
  viewer_liked: boolean;
};

type UniverseWindowRow = {
  id: string;
  visibility: 'public' | 'private';
  star_color: string;
  star_size_factor: number;
  brightness_score: number;
  star_x: number;
  star_y: number;
  star_z: number;
  coordinate_code: string | null;
  is_owner: boolean;
};

type CoordinateTargetRow = {
  story_id: string;
  star_x: number;
  star_y: number;
  star_z: number;
  coordinate_code: string;
};

const getSessionDisplayName = (session: Session) =>
  session.user.user_metadata?.nickname ||
  session.user.user_metadata?.display_name ||
  (session.user.is_anonymous
    ? `星旅人-${session.user.id.slice(0, 4)}`
    : `星旅人-${session.user.phone?.slice(-4) ?? '成员'}`);

const mapSession = (session: Session | null): ViewerSession | null => {
  if (!session?.user) {
    return null;
  }

  return {
    userId: session.user.id,
    displayName: getSessionDisplayName(session),
    phone: session.user.phone ?? '',
    mode: 'supabase',
    isAnonymous: Boolean(session.user.is_anonymous),
  };
};

const mapStoryRow = (row: StoryRow): Story => ({
  id: row.id,
  authorId: row.author_id,
  title: row.title,
  body: row.body,
  visibility: row.visibility,
  authorMode: row.author_mode,
  authorDisplayName: row.author_display_name,
  starColor: row.star_color,
  starSizeFactor: row.star_size_factor,
  brightness: row.brightness_score,
  starPosition: {
    x: row.star_x,
    y: row.star_y,
    z: row.star_z,
  },
  coordinateCode: row.coordinate_code,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  viewCount: row.view_count,
  likeCount: row.like_count ?? 0,
  likedByViewer: row.viewer_liked ?? false,
});

const mapWindowRow = (row: UniverseWindowRow): UniverseStar => {
  const state: UniverseStarState =
    row.visibility === 'public' ? 'public' : row.is_owner ? 'private_owner' : 'private_locked';

  return {
    id: row.id,
    x: row.star_x,
    y: row.star_y,
    z: row.star_z,
    sizeFactor: row.star_size_factor,
    color: row.star_color,
    brightness: row.brightness_score,
    state,
    clickable: state !== 'private_locked',
    coordinateCode: state === 'private_locked' ? null : row.coordinate_code,
  };
};

const mapCoordinateTargetRow = (row: CoordinateTargetRow): UniverseCoordinateTarget => ({
  storyId: row.story_id,
  position: {
    x: row.star_x,
    y: row.star_y,
    z: row.star_z,
  },
  zoomTier: 'mid',
  coordinateCode: row.coordinate_code,
});

const assertClient = () => {
  if (!supabase) {
    throw new Error('Supabase 尚未配置。');
  }

  return supabase;
};

const storySelect =
  'id,author_id,title,body,visibility,author_mode,author_display_name,star_color,star_size_factor,brightness_score,star_x,star_y,star_z,coordinate_code,created_at,updated_at,view_count,like_count,viewer_liked';

const storyTableSelect = storySelect.replace(',viewer_liked', '');
const normalizeSupabaseError = (message: string, fallback = '云端操作失败，请稍后再试。') =>
  getUserFacingErrorMessage(message, fallback);

export const supabaseBackend: StoryBackend = {
  mode: 'supabase',
  isConfigured: true,

  async requestOtp(phone) {
    const client = assertClient();
    const authPhone = normalizePhoneForAuth(phone);
    const { error } = await client.auth.signInWithOtp({
      phone: authPhone,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      throw new Error(normalizeSupabaseError(error.message, '找回验证码发送失败，请稍后再试。'));
    }

    return '验证码已发送，请检查短信。';
  },

  async verifyOtp(phone, code) {
    const client = assertClient();
    const authPhone = normalizePhoneForAuth(phone);
    const { data, error } = await client.auth.verifyOtp({
      phone: authPhone,
      token: code,
      type: 'sms',
    });

    if (error) {
      throw new Error(normalizeSupabaseError(error.message, '验证码验证失败，请稍后再试。'));
    }

    return mapSession(data.session) as ViewerSession;
  },

  async requestPhoneBinding(phone, viewerFingerprint) {
    const client = assertClient();
    const authPhone = normalizePhoneForAuth(phone);
    const { data: existingSessionData, error: existingSessionError } = await client.auth.getSession();

    if (existingSessionError) {
      throw new Error(normalizeSupabaseError(existingSessionError.message, '发布身份读取失败，请稍后再试。'));
    }

    if (!existingSessionData.session) {
      const publishSession = await this.ensurePublishSession(viewerFingerprint);
      if (!publishSession) {
        throw new Error('无法创建可保护的宇宙身份，请稍后再试。');
      }
    }

    const { error } = await client.auth.updateUser({
      phone: authPhone,
      data: {
        display_name: `星旅人 ${authPhone.slice(-4)}`,
      },
    });

    if (error) {
      throw new Error(
        normalizeSupabaseError(
          error.message,
          '手机号验证码发送失败。请确认手机号格式正确，并在 Supabase 开启 Phone 登录和短信服务。'
        )
      );
    }

    return '验证码已发送。';
  },

  async verifyPhoneBinding(phone, code) {
    const client = assertClient();
    const authPhone = normalizePhoneForAuth(phone);
    const { data, error } = await client.auth.verifyOtp({
      phone: authPhone,
      token: code,
      type: 'phone_change',
    });

    if (error) {
      throw new Error(normalizeSupabaseError(error.message, '手机号绑定失败，请检查验证码后再试。'));
    }

    const session = mapSession(data.session);
    if (session) {
      return session;
    }

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
      throw new Error(normalizeSupabaseError(sessionError.message, '手机号已绑定，但身份刷新失败，请重启 App。'));
    }

    const refreshedSession = mapSession(sessionData.session);
    if (!refreshedSession) {
      throw new Error('手机号已绑定，但没有读取到新的登录状态，请重启 App。');
    }

    return refreshedSession;
  },

  async ensurePublishSession(_viewerFingerprint?: string | null) {
    const client = assertClient();
    const { data: existingSessionData, error: existingSessionError } = await client.auth.getSession();

    if (existingSessionError) {
      throw new Error(normalizeSupabaseError(existingSessionError.message, '发布身份读取失败，请稍后再试。'));
    }

    const existingSession = mapSession(existingSessionData.session);
    if (existingSession) {
      return existingSession;
    }

    const { data, error } = await client.auth.signInAnonymously({
      options: {
        data: {
          display_name: '星旅人',
        },
      },
    });

    if (error) {
      throw new Error(normalizeSupabaseError(error.message, '匿名发布身份创建失败，请稍后再试。'));
    }

    const session = mapSession(data.session);
    if (!session) {
      throw new Error('无法创建发布身份，请稍后再试。');
    }

    return session;
  },

  async getSession() {
    const client = assertClient();
    const { data } = await client.auth.getSession();
    return mapSession(data.session);
  },

  async signOut() {
    const client = assertClient();
    const { error } = await client.auth.signOut();
    if (error) {
      throw new Error(normalizeSupabaseError(error.message, '退出失败，请稍后再试。'));
    }
  },

  subscribeToAuth(listener) {
    const client = assertClient();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      listener(mapSession(session));
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  async loadUniverseWindow(_session, viewerFingerprint, query: UniverseWindowQuery) {
    const client = assertClient();
    const { data, error } = await client.rpc('get_universe_window_stars', {
      p_center_x: query.center.x,
      p_center_y: query.center.y,
      p_center_z: query.center.z,
      p_radius: query.radius,
      p_viewer_fingerprint: viewerFingerprint,
    });

    if (error) {
      throw new Error(normalizeSupabaseError(error.message, '宇宙星图加载失败，请稍后再试。'));
    }

    return ((data ?? []) as UniverseWindowRow[]).map(mapWindowRow);
  },

  async loadStoryDetail(_session, viewerFingerprint, storyId) {
    const client = assertClient();
    const { data, error } = await client.rpc('get_story_detail', {
      p_story_id: storyId,
      p_viewer_fingerprint: viewerFingerprint,
    });

    if (error) {
      throw new Error(normalizeSupabaseError(error.message, '故事读取失败，请稍后再试。'));
    }

    const row = Array.isArray(data) ? data[0] : data;
    return row ? mapStoryRow(row as StoryRow) : null;
  },

  async resolveCoordinateTarget(_session, viewerFingerprint, coordinateCode) {
    const client = assertClient();
    const { data, error } = await client.rpc('resolve_coordinate_target', {
      p_coordinate_code: coordinateCode.trim().toUpperCase(),
      p_viewer_fingerprint: viewerFingerprint,
    });

    if (error) {
      throw new Error(normalizeSupabaseError(error.message, '坐标定位失败，请稍后再试。'));
    }

    const row = Array.isArray(data) ? data[0] : data;
    return row ? mapCoordinateTargetRow(row as CoordinateTargetRow) : null;
  },

  async loadMyStories(session) {
    const client = assertClient();
    const { data, error } = await client
      .from('stories')
      .select(storyTableSelect)
      .eq('author_id', session.userId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(normalizeSupabaseError(error.message, '我的星星加载失败，请稍后再试。'));
    }

    return (((data ?? []) as unknown) as StoryRow[]).map((row) =>
      mapStoryRow({
        ...row,
        viewer_liked: false,
      })
    );
  },

  async saveStory(session, values, existingStory) {
    const client = assertClient();
    let moderation: StorySaveResult['moderation'];
    const draftValues = normalizeStoryEditorValues(values);
    const validationMessage = getStoryEditorValidationMessage(draftValues);
    if (validationMessage) {
      throw new Error(validationMessage);
    }

    if (existingStory) {
      const payload = {
        title: draftValues.title,
        body: draftValues.body,
        visibility: draftValues.visibility,
        author_mode: draftValues.authorMode,
        author_display_name: draftValues.authorMode === 'anonymous' ? '匿名旅人' : session.displayName,
        star_color: draftValues.starColor,
        coordinate_code:
          draftValues.visibility === 'public'
            ? existingStory.coordinateCode ?? generateCoordinateCode()
            : null,
        brightness_score:
          draftValues.visibility === 'public'
            ? createBrightnessFromLikes(existingStory.likeCount)
            : PRIVATE_STAR_FIXED_BRIGHTNESS,
      };

      const { data, error } = await client
        .from('stories')
        .update(payload)
        .eq('id', existingStory.id)
        .select(storyTableSelect)
        .single();

      if (error) {
        throw new Error(normalizeSupabaseError(error.message, '故事保存失败，请稍后再试。'));
      }

      return {
        story: mapStoryRow({ ...((data as unknown) as StoryRow), viewer_liked: existingStory.likedByViewer }),
        moderation,
      };
    }

    const { data: placement, error: placementError } = await client.rpc('reserve_story_coordinate');

    if (placementError) {
      throw new Error(normalizeSupabaseError(placementError.message, '星星坐标生成失败，请稍后再试。'));
    }

    const reserved = Array.isArray(placement) ? placement[0] : placement;

    const insertPayload = {
      author_id: session.userId,
      title: draftValues.title,
      body: draftValues.body,
      visibility: draftValues.visibility,
      author_mode: draftValues.authorMode,
      author_display_name: draftValues.authorMode === 'anonymous' ? '匿名旅人' : session.displayName,
      star_color: draftValues.starColor,
      star_x: reserved.star_x,
      star_y: reserved.star_y,
      star_z: reserved.star_z,
      star_size_factor: reserved.star_size_factor,
      coordinate_code: draftValues.visibility === 'public' ? reserved.coordinate_code : null,
      brightness_score:
        draftValues.visibility === 'public' ? PUBLIC_STAR_BASE_BRIGHTNESS : PRIVATE_STAR_FIXED_BRIGHTNESS,
      like_count: 0,
    };

    const { data, error } = await client
      .from('stories')
      .insert(insertPayload)
      .select(storyTableSelect)
      .single();

    if (error) {
      throw new Error(normalizeSupabaseError(error.message, '发布失败，请稍后再试。'));
    }

    return {
      story: mapStoryRow({ ...((data as unknown) as StoryRow), viewer_liked: false }),
      moderation,
    };
  },

  async deleteStory(_session, storyId) {
    const client = assertClient();
    const { data, error } = await client.rpc('retire_story_to_remnant', {
      p_story_id: storyId,
    });

    if (error) {
      throw new Error(normalizeSupabaseError(error.message, '删除失败，请稍后再试。'));
    }

    if (!data) {
      throw new Error('只能删除你自己发布的星星。');
    }
  },

  async recordStoryView(storyId, viewerFingerprint) {
    const client = assertClient();
    const { data, error } = await client.rpc('record_story_view', {
      p_story_id: storyId,
      p_viewer_fingerprint: viewerFingerprint,
    });

    if (error) {
      throw new Error(normalizeSupabaseError(error.message, '浏览记录同步失败。'));
    }

    const row = Array.isArray(data) ? data[0] : data;

    return {
      didInsert: Boolean(row?.did_insert),
      viewCount: row?.view_count ?? 0,
    } satisfies StoryViewResult;
  },

  async likeStory(storyId, viewerFingerprint) {
    const client = assertClient();
    const { data, error } = await client.rpc('record_story_like', {
      p_story_id: storyId,
      p_viewer_fingerprint: viewerFingerprint,
    });

    if (error) {
      throw new Error(normalizeSupabaseError(error.message, '点亮失败，请稍后再试。'));
    }

    const row = Array.isArray(data) ? data[0] : data;

    return {
      didInsert: Boolean(row?.did_insert),
      likeCount: row?.like_count ?? 0,
      brightness: row?.brightness_score ?? PUBLIC_STAR_BASE_BRIGHTNESS,
      likedByViewer: Boolean(row?.viewer_liked),
    } satisfies StoryLikeResult;
  },
};
