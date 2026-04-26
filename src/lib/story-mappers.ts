import { Story, UniverseStarPreview, UniverseStarState, ViewerSession } from '@/src/types/domain';

export const toStarState = (story: Story, session: ViewerSession | null): UniverseStarState => {
  if (story.visibility === 'public') {
    return 'public';
  }

  return session?.userId === story.authorId ? 'private_owner' : 'private_locked';
};

export const toUniverseStarPreview = (
  story: Story,
  session: ViewerSession | null
): UniverseStarPreview => {
  const state = toStarState(story, session);

  return {
    id: story.id,
    x: story.starPosition.x,
    y: story.starPosition.y,
    z: story.starPosition.z,
    sizeFactor: story.starSizeFactor,
    color: story.starColor,
    brightness: story.brightness,
    state,
    clickable: state !== 'private_locked',
    coordinateCode: state === 'private_locked' ? null : story.coordinateCode,
  };
};

export const toUniverseStar = toUniverseStarPreview;
