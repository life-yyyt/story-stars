import {
  StoryDetail,
  StoryEditorValues,
  StoryLikeResult,
  StorySaveResult,
  StoryViewResult,
  UniverseCoordinateTarget,
  UniverseStarPreview,
  UniverseWindowQuery,
  ViewerSession,
} from '@/src/types/domain';

export interface StoryBackend {
  mode: 'demo' | 'supabase';
  isConfigured: boolean;
  debugClearDemoCache?: () => Promise<void>;
  requestOtp: (phone: string) => Promise<string>;
  verifyOtp: (phone: string, code: string) => Promise<ViewerSession>;
  requestPhoneBinding: (phone: string, viewerFingerprint: string | null) => Promise<string>;
  verifyPhoneBinding: (phone: string, code: string) => Promise<ViewerSession>;
  ensurePublishSession: (viewerFingerprint: string | null) => Promise<ViewerSession>;
  getSession: () => Promise<ViewerSession | null>;
  signOut: () => Promise<void>;
  subscribeToAuth: (listener: (session: ViewerSession | null) => void) => () => void;
  loadUniverseWindow: (
    session: ViewerSession | null,
    viewerFingerprint: string | null,
    query: UniverseWindowQuery
  ) => Promise<UniverseStarPreview[]>;
  loadStoryDetail: (
    session: ViewerSession | null,
    viewerFingerprint: string | null,
    storyId: string
  ) => Promise<StoryDetail | null>;
  resolveCoordinateTarget: (
    session: ViewerSession | null,
    viewerFingerprint: string | null,
    coordinateCode: string
  ) => Promise<UniverseCoordinateTarget | null>;
  loadMyStories: (session: ViewerSession, viewerFingerprint: string | null) => Promise<StoryDetail[]>;
  saveStory: (
    session: ViewerSession,
    values: StoryEditorValues,
    existingStory?: StoryDetail
  ) => Promise<StorySaveResult>;
  deleteStory: (session: ViewerSession, storyId: string) => Promise<void>;
  recordStoryView: (
    storyId: string,
    viewerFingerprint: string,
    session: ViewerSession | null
  ) => Promise<StoryViewResult>;
  likeStory: (
    storyId: string,
    viewerFingerprint: string,
    session: ViewerSession | null
  ) => Promise<StoryLikeResult>;
}
