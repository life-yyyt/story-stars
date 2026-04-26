export type StoryVisibility = 'public' | 'private';
export type StoryAuthorMode = 'named' | 'anonymous';
export type UniverseStarState = 'public' | 'private_locked' | 'private_owner';
export type BackendMode = 'demo' | 'supabase';
export type UniverseZoomTier = 'far' | 'mid' | 'near';
export type UniverseHeroNodeKind = 'aggregate' | 'representative_star' | 'story_star' | 'ambient';

export interface StarPosition {
  x: number;
  y: number;
  z: number;
}

export interface ModerationResult {
  status: 'approved' | 'rejected';
  reasonCode: string;
  message: string;
  suggestion: string;
  ruleHits?: string[];
  llmLabel?: string;
}

export interface StoryEditorValues {
  title: string;
  body: string;
  visibility: StoryVisibility;
  authorMode: StoryAuthorMode;
  starColor: string;
}

export interface Story {
  id: string;
  authorId: string;
  title: string | null;
  body: string | null;
  visibility: StoryVisibility;
  authorMode: StoryAuthorMode;
  authorDisplayName: string | null;
  starColor: string;
  starSizeFactor: number;
  brightness: number;
  starPosition: StarPosition;
  coordinateCode: string | null;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  likeCount: number;
  likedByViewer: boolean;
}

export type StoryDetail = Story;

export interface UniverseStarPreview {
  id: string;
  x: number;
  y: number;
  z: number;
  sizeFactor: number;
  color: string;
  brightness: number;
  state: UniverseStarState;
  clickable: boolean;
  coordinateCode: string | null;
}

export type UniverseStar = UniverseStarPreview;

export interface UniverseHeroNode {
  id: string;
  x: number;
  y: number;
  z: number;
  depth: number;
  kind: UniverseHeroNodeKind;
  brightness: number;
  color: string;
  clickable: boolean;
  radius: number;
  storyId?: string | null;
  state?: UniverseStarState;
}

export interface UniverseHeroViewport {
  centerX: number;
  centerY: number;
  zoom: number;
  velocity: number;
}

export interface CameraSystemState extends UniverseHeroViewport {
  driftOffsetX: number;
  driftOffsetY: number;
}

export interface UniverseLayerConfig {
  kind: UniverseHeroNodeKind;
  parallax: number;
  baseOpacity: number;
  scaleResponse: number;
  interactive: boolean;
}

export interface UniverseRuntimeSnapshot {
  viewport: UniverseHeroViewport;
  nodes: UniverseHeroNode[];
  activeQuery: UniverseWindowQuery | null;
}

export interface UniverseWindowQuery {
  center: StarPosition;
  radius: number;
  zoomTier: UniverseZoomTier;
  prefetch?: boolean;
}

export interface UniverseCoordinateTarget {
  storyId: string;
  position: StarPosition;
  zoomTier: UniverseZoomTier;
  coordinateCode: string;
}

export interface ViewerSession {
  userId: string;
  displayName: string;
  phone: string;
  mode: BackendMode;
  isAnonymous?: boolean;
}

export interface FocusRequest {
  storyId: string;
  nonce: number;
  message?: string;
  openReader?: boolean;
}

export interface StoryViewResult {
  didInsert: boolean;
  viewCount: number;
}

export interface StoryLikeResult {
  didInsert: boolean;
  likeCount: number;
  brightness: number;
  likedByViewer: boolean;
}

export interface StorySaveResult {
  story: Story;
  moderation?: ModerationResult;
}

export type StorySheetStatus = 'closed' | 'opening' | 'open' | 'closing';

export interface StorySheetState {
  storyId: string | null;
  status: StorySheetStatus;
}
